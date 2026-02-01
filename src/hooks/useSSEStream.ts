/**
 * useSSEStream - Custom hook for Server-Sent Events streaming
 * 
 * Extracted from Chat.tsx to improve component readability and testability.
 * Handles SSE parsing, buffer management, and event type dispatch.
 * 
 * @see implementation_plan.md Step 1: P0 Priority - Frontend Hook Extraction
 */

import { useCallback, useRef } from 'react';
import type {
    QuickReply,
    SSEEventHandlers,
    SSEStreamOptions,
    UseSSEStreamReturn,
} from '@/types/api';

// Re-export types for backward compatibility
export type { QuickReply, SSEEventHandlers, SSEStreamOptions, UseSSEStreamReturn };

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

        try {
            const response = await fetch(url, {
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

                    const shouldBreak = dispatchEvent(parsed.type, parsed.data, handlers);
                    if (parsed.type === 'done') break;
                }

                // Exit loop after processing final buffer
                if (done) break;
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
