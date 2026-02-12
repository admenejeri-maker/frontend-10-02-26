'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

// Silence detection constants (tuned for natural Georgian speech pauses)
const SILENCE_THRESHOLD = 0.03;       // 3% normalized RMS — lower = less aggressive
const SILENCE_DURATION_MS = 3500;     // 3.5 seconds of continuous silence to auto-stop
const SILENCE_CHECK_INTERVAL = 200;   // Poll volume 5x/second
const MIN_RECORDING_MS = 2000;        // Don't auto-stop in first 2 seconds

type VoiceState = 'idle' | 'requesting' | 'recording' | 'processing' | 'error';

interface VoiceInputProps {
    onTranscription: (text: string) => void;
    disabled?: boolean;
    userId: string;
    sessionId?: string;
}

// Get supported MIME type for MediaRecorder
function getSupportedMimeType(): string {
    const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm'; // Fallback
}

// Calculate Root Mean Square of audio data for volume detection
function calculateRMS(dataArray: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128; // Center at 0, range -1..1
        sum += normalized * normalized;
    }
    return Math.sqrt(sum / dataArray.length);
}

export function VoiceInput({ onTranscription, disabled, userId, sessionId }: VoiceInputProps) {
    const [state, setState] = useState<VoiceState>('idle');
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(0);
    const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const processRecordingRef = useRef<() => void>(() => { });
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const silenceStartRef = useRef<number | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (autoStopRef.current) clearTimeout(autoStopRef.current);
            if (silenceTimerRef.current) clearInterval(silenceTimerRef.current);
            if (audioContextRef.current) audioContextRef.current.close();
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const startRecording = useCallback(async () => {
        try {
            setState('requesting');
            setError(null);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mimeType = getSupportedMimeType();
            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => processRecordingRef.current();

            recorder.start();
            startTimeRef.current = Date.now();
            setState('recording');

            // Start duration timer
            timerRef.current = setInterval(() => {
                setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 100);

            // M4: Auto-stop after max duration (120s)
            autoStopRef.current = setTimeout(() => {
                stopRecording();
            }, 120 * 1000);

            // Silence detection: setup Web Audio analyser
            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            analyserRef.current = analyser;
            silenceStartRef.current = null;

            const dataArray = new Uint8Array(analyser.fftSize);

            silenceTimerRef.current = setInterval(() => {
                analyser.getByteTimeDomainData(dataArray);
                const rms = calculateRMS(dataArray);
                const elapsed = Date.now() - startTimeRef.current;

                if (rms < SILENCE_THRESHOLD) {
                    if (silenceStartRef.current === null) {
                        silenceStartRef.current = Date.now();
                    } else if (
                        Date.now() - silenceStartRef.current >= SILENCE_DURATION_MS &&
                        elapsed >= MIN_RECORDING_MS
                    ) {
                        stopRecording();
                    }
                } else {
                    silenceStartRef.current = null;
                }
            }, SILENCE_CHECK_INTERVAL);

        } catch (err) {
            console.error('Microphone access denied:', err);
            setState('error');
            setError('მიკროფონზე წვდომა უარყოფილია');
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (autoStopRef.current) {
            clearTimeout(autoStopRef.current);
            autoStopRef.current = null;
        }

        // Silence detection cleanup
        if (silenceTimerRef.current) {
            clearInterval(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        silenceStartRef.current = null;
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        setState('processing');
    }, []);

    const processRecording = useCallback(async () => {
        // Guard: prevent API call if userId is not yet initialized
        if (!userId) {
            setError('სესია ჯერ არ ინიციალიზებულა');
            setState('error');
            return;
        }

        const chunks = chunksRef.current;
        if (chunks.length === 0) {
            setState('idle');
            setDuration(0);
            return;
        }

        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });

        // Validate duration (minimum 0.5s)
        const recordedDuration = (Date.now() - startTimeRef.current) / 1000;
        if (recordedDuration < 0.5) {
            setError('ჩანაწერი ძალიან მოკლეა');
            setState('idle');
            setDuration(0);
            return;
        }

        // Validate size (max 10MB)
        if (blob.size > 10 * 1024 * 1024) {
            setError('ფაილი ძალიან დიდია');
            setState('idle');
            setDuration(0);
            return;
        }

        // Send to backend
        const formData = new FormData();
        // L3: Dynamic filename based on MIME type
        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
        formData.append('audio', blob, `recording.${ext}`);
        formData.append('user_id', userId);
        if (sessionId) formData.append('session_id', sessionId);

        try {
            const response = await apiFetch(`${BACKEND_URL}/api/v1/chat/audio`, {
                method: 'POST',
                body: formData,
                // Note: Don't set Content-Type header - browser sets it with boundary
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData.error?.message || errorData.detail || 'Transcription failed';
                throw new Error(message);
            }

            const result = await response.json();
            onTranscription(result.text);
            setState('idle');
            setDuration(0);

        } catch (err) {
            console.error('Transcription error:', err, '| Response status:', err instanceof Error ? err.message : 'unknown');
            setError(err instanceof Error ? err.message : 'ტრანსკრიფცია ვერ მოხერხდა');
            setState('error');
        }
    }, [userId, sessionId, onTranscription]);

    // Keep ref in sync so MediaRecorder.onstop always calls latest version
    useEffect(() => {
        processRecordingRef.current = processRecording;
    }, [processRecording]);

    const handleClick = useCallback(() => {
        if (state === 'idle' || state === 'error') {
            startRecording();
        } else if (state === 'recording') {
            stopRecording();
        }
    }, [state, startRecording, stopRecording]);

    // Don't render if MediaRecorder not supported
    if (typeof window !== 'undefined' && !window.MediaRecorder) {
        return null;
    }

    const isRecording = state === 'recording';
    const isProcessing = state === 'processing';

    return (
        <div className="relative flex items-center">
            {/* Duration badge (recording only) */}
            {isRecording && (
                <span
                    className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
                >
                    {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
                </span>
            )}

            {/* Error tooltip */}
            {error && state === 'error' && (
                <span
                    className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded whitespace-nowrap"
                    style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}
                >
                    {error}
                </span>
            )}

            <button
                type="button"
                onClick={handleClick}
                disabled={disabled || isProcessing || !userId}
                aria-label={isRecording ? 'შეჩერება' : 'ხმით შეყვანა'}
                className="flex items-center justify-center p-2 rounded-lg transition-all duration-150"
                style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: isRecording ? '#FEE2E2' : 'transparent',
                    border: isRecording ? '1px solid #FECACA' : '1px solid transparent',
                    opacity: disabled || isProcessing || !userId ? 0.5 : 1,
                    cursor: disabled || isProcessing || !userId ? 'not-allowed' : 'pointer',
                }}
            >
                {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#6B7280' }} />
                ) : isRecording ? (
                    <Square className="w-4 h-4" style={{ color: '#DC2626' }} fill="#DC2626" />
                ) : (
                    <Mic
                        className="w-5 h-5"
                        style={{ color: state === 'error' ? '#DC2626' : '#6B7280' }}
                    />
                )}
            </button>
        </div>
    );
}

export default VoiceInput;
