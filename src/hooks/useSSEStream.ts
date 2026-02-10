/**
 * useSSEStream - Custom hook for Server-Sent Events streaming
 * 
 * Extracted from Chat.tsx to improve component readability and testability.
 * Handles SSE parsing, buffer management, and event type dispatch.
 * 
 * @see implementation_plan.md Step 1: P0 Priority - Frontend Hook Extraction
 */

import { useCallback, useRef } from 'react';
import { apiFetch } from '../lib/apiClient';
import type {
    QuickReply,
    SSEEventHandlers,
    SSEStreamOptions,
    UseSSEStreamReturn,
} from '@/types/api';

// Re-export types for backward compatibility
export type { QuickReply, SSEEventHandlers, SSEStreamOptions, UseSSEStreamReturn };

// ============================================================================
// Reconnect Configuration
// ============================================================================

const RECONNECT_CONFIG = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    backoffMultiplier: 2,
} as const;

/** HTTP status codes that indicate a transient server error worth retrying */
const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);

/**
 * Determine if an error is retryable (transient network/server issue)
 * AbortError and client errors (4xx) are NOT retryable.
 */
function isRetryableError(error: unknown): boolean {
    if (error instanceof Error && error.name === 'AbortError') return false;
    // Network errors (fetch rejects with TypeError for network failures)
    if (error instanceof TypeError) return true;
    // Our own retryable HTTP status errors (thrown as Error with status in message)
    if (error instanceof Error && error.message.startsWith('HTTP ')) {
        const status = parseInt(error.message.slice(5), 10);
        return RETRYABLE_HTTP_STATUSES.has(status);
    }
    return false;
}

/**
 * Abortable delay — resolves after `ms` milliseconds,
 * but rejects immediately if the AbortController signal fires.
 */
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const timer = setTimeout(resolve, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSSEStream(): UseSSEStreamReturn {
    const abortControllerRef = useRef<AbortController | null>(null);
    const isStreamingRef = useRef(false);

    /**
     * Parse a single SSE event from raw event string
     * Handles both "event:" header and data.type fallback
     */
    const parseSSEEvent = (eventString: string): { type: string; data: Record<string, unknown> } | null => {
        const lines = eventString.split('\n');
        const eventLine = lines.find(line => line.startsWith('event: '));
        const dataLine = lines.find(line => line.startsWith('data: '));

        if (!dataLine) return null;

        try {
            const data = JSON.parse(dataLine.slice(6));
            // SSE event type takes priority, fallback to data.type
            const type = eventLine ? eventLine.slice(7).trim() : (data.type || 'unknown');
            return { type, data };
        } catch {
            return null;
        }
    };

    /**
     * Process parsed SSE events and dispatch to handlers
     */
    const dispatchEvent = (
        type: string,
        data: Record<string, unknown>,
        handlers: SSEEventHandlers
    ): boolean => {
        switch (type) {
            case 'text': {
                const content = data.content as string | undefined;
                if (!content) return false;
                // Bug #19 Fix: Strip [TIP]...[/TIP] from incoming text stream
                const cleanContent = content.replace(/\[TIP\][\s\S]*?\[\/TIP\]/g, '');
                handlers.onText(cleanContent);
                return true;
            }

            case 'products': {
                const content = data.content as string | undefined;
                if (content) handlers.onProducts('\n\n' + content);
                return true;
            }

            case 'tip': {
                // Bug #29 Fix: Backend sends {text: "..."}, wrap with tags
                const tipText = (data.text || data.content) as string | undefined;
                if (!tipText) return false;
                const tipWithTags = `\n\n[TIP]\n${tipText}\n[/TIP]`;
                handlers.onTip(tipWithTags);
                return true;
            }

            case 'thinking': {
                const thought = data.content as string | undefined;
                if (thought) handlers.onThinking(thought);
                return true;
            }

            case 'quick_replies': {
                // Bug #30 Fix: Backend sends {options: [...]} not {replies: [...]}
                const repliesData = (data.options || data.replies || data.content) as Array<{ title: string; payload: string }> | undefined;
                if (!Array.isArray(repliesData) || repliesData.length === 0) return false;
                const quickReplies: QuickReply[] = repliesData.map(qr => ({
                    title: qr.title,
                    payload: qr.payload,
                }));
                handlers.onQuickReplies(quickReplies);
                return true;
            }

            case 'done': {
                const sessionId = data.session_id as string | undefined;
                handlers.onDone(sessionId);
                return true;
            }

            case 'error': {
                const message = (data.message || data.content || 'დაფიქსირდა შეცდომა. გთხოვთ სცადოთ თავიდან.') as string;
                handlers.onError(message);
                return true;
            }

            case 'truncation_warning': {
                const finishReason = data.finish_reason as string | undefined;
                handlers.onTruncationWarning?.(finishReason || 'MAX_TOKENS');
                return true;
            }

            default:
                console.warn('[useSSEStream] Unknown event type:', type);
                return false;
        }
    };

    /**
     * Main streaming function - handles fetch, buffering, and event dispatch
     */
    const streamMessage = useCallback(async (options: SSEStreamOptions): Promise<void> => {
        const { url, body, handlers, onStreamEnd } = options;

        // Abort any existing stream
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        isStreamingRef.current = true;

        const { maxAttempts, baseDelayMs, backoffMultiplier } = RECONNECT_CONFIG;
        let lastError: unknown = null;

        try {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const response = await apiFetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                        signal: abortControllerRef.current.signal,
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    const reader = response.body?.getReader();
                    if (!reader) {
                        throw new Error('No response body');
                    }

                    const decoder = new TextDecoder();
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();

                        // Decode chunk if present
                        if (value) {
                            buffer += decoder.decode(value, { stream: true });
                        }

                        // BUG FIX #23: Flush TextDecoder's internal buffer on stream end
                        // Georgian UTF-8 chars are 3 bytes - chunk boundaries may split mid-character
                        if (done) {
                            buffer += decoder.decode(); // Final flush
                        }

                        // SSE events are separated by double newline
                        const events = buffer.split('\n\n');
                        // Keep incomplete event in buffer
                        buffer = events.pop() || '';

                        for (const eventString of events) {
                            const parsed = parseSSEEvent(eventString);
                            if (!parsed) continue;

                            // Enhanced debug logging
                            console.log(
                                '[DEBUG SSE]',
                                parsed.type,
                                'keys=' + Object.keys(parsed.data).join(','),
                                (parsed.data.content as string)?.slice?.(0, 50) ||
                                (parsed.data.text as string)?.slice?.(0, 50) ||
                                ((parsed.data.options as unknown[])?.length ? `${(parsed.data.options as unknown[]).length} options` : '') ||
                                JSON.stringify(parsed.data).slice(0, 60)
                            );

                            dispatchEvent(parsed.type, parsed.data, handlers);
                            if (parsed.type === 'done') break;
                        }

                        // Exit loop after processing final buffer
                        if (done) break;
                    }

                    // Stream completed successfully — exit retry loop
                    return;

                } catch (error) {
                    lastError = error;

                    // AbortError = user clicked Stop — exit immediately, no retry
                    if (error instanceof Error && error.name === 'AbortError') {
                        console.log('[useSSEStream] Stream aborted by user');
                        return;
                    }

                    // Non-retryable error — throw immediately
                    if (!isRetryableError(error)) {
                        throw error;
                    }

                    // Max attempts reached — throw
                    if (attempt >= maxAttempts) {
                        console.error(`[useSSEStream] All ${maxAttempts} attempts exhausted`);
                        throw error;
                    }

                    // Notify UI about reconnection attempt
                    const delayMs = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
                    console.warn(
                        `[useSSEStream] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms...`,
                        error
                    );
                    handlers.onReconnecting?.(attempt, maxAttempts);

                    // Wait with exponential backoff (abortable)
                    try {
                        await abortableDelay(delayMs, abortControllerRef.current.signal);
                    } catch (delayError) {
                        // User aborted during backoff wait
                        if (delayError instanceof Error && delayError.name === 'AbortError') {
                            console.log('[useSSEStream] Reconnect aborted by user during backoff');
                            return;
                        }
                        throw delayError;
                    }
                }
            }
        } finally {
            isStreamingRef.current = false;
            abortControllerRef.current = null;
            onStreamEnd?.();
        }
    }, []);

    /**
     * Abort the current stream
     */
    const abortStream = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        isStreamingRef.current = false;
    }, []);

    return {
        streamMessage,
        abortStream,
        get isStreaming() {
            return isStreamingRef.current;
        },
    };
}

export default useSSEStream;
