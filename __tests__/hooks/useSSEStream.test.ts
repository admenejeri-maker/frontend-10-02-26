/**
 * useSSEStream Hook Tests
 *
 * Tests the SSE streaming hook's event parsing and dispatch logic.
 * Uses renderHook + a fake ReadableStream to simulate backend responses.
 */

import { renderHook, act } from '@testing-library/react'
import { useSSEStream } from '@/hooks/useSSEStream'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build a ReadableStream from an array of SSE event strings */
function fakeSSEStream(events: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    // Join with double-newline separator (SSE event boundary)
    const raw = events.join('\n\n') + '\n\n'
    return new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(raw))
            controller.close()
        },
    })
}

/** Create a mock Response wrapping a ReadableStream */
function mockResponse(stream: ReadableStream<Uint8Array>, status = 200): Response {
    return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } })
}

// ── mocks ────────────────────────────────────────────────────────────────────

// Mock apiFetch globally so we control the response
vi.mock('@/lib/apiClient', () => ({
    apiFetch: vi.fn(),
}))

import { apiFetch } from '@/lib/apiClient'
const mockedApiFetch = vi.mocked(apiFetch)

// ── tests ────────────────────────────────────────────────────────────────────

describe('useSSEStream', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('dispatches text event content to onText handler', async () => {
        const sseEvents = [
            'event: text\ndata: {"content":"Hello from Scoop"}',
        ]
        mockedApiFetch.mockResolvedValue(mockResponse(fakeSSEStream(sseEvents)))

        const onText = vi.fn()
        const onDone = vi.fn()
        const handlers = {
            onText,
            onProducts: vi.fn(),
            onTip: vi.fn(),
            onThinking: vi.fn(),
            onQuickReplies: vi.fn(),
            onDone,
            onError: vi.fn(),
        }

        const { result } = renderHook(() => useSSEStream())

        await act(async () => {
            await result.current.streamMessage({
                url: '/api/chat',
                body: { message: 'hi' },
                handlers,
            })
        })

        expect(onText).toHaveBeenCalledWith('Hello from Scoop')
    })

    it('dispatches done event with session_id to onDone handler', async () => {
        const sseEvents = [
            'event: text\ndata: {"content":"reply"}',
            'event: done\ndata: {"session_id":"sess-123"}',
        ]
        mockedApiFetch.mockResolvedValue(mockResponse(fakeSSEStream(sseEvents)))

        const onDone = vi.fn()
        const handlers = {
            onText: vi.fn(),
            onProducts: vi.fn(),
            onTip: vi.fn(),
            onThinking: vi.fn(),
            onQuickReplies: vi.fn(),
            onDone,
            onError: vi.fn(),
        }

        const { result } = renderHook(() => useSSEStream())

        await act(async () => {
            await result.current.streamMessage({
                url: '/api/chat',
                body: { message: 'hi' },
                handlers,
            })
        })

        expect(onDone).toHaveBeenCalledWith('sess-123')
    })

    it('strips [TIP]...[/TIP] from text event content', async () => {
        const sseEvents = [
            'event: text\ndata: {"content":"Use this[TIP]some tip[/TIP] for best results"}',
        ]
        mockedApiFetch.mockResolvedValue(mockResponse(fakeSSEStream(sseEvents)))

        const onText = vi.fn()
        const handlers = {
            onText,
            onProducts: vi.fn(),
            onTip: vi.fn(),
            onThinking: vi.fn(),
            onQuickReplies: vi.fn(),
            onDone: vi.fn(),
            onError: vi.fn(),
        }

        const { result } = renderHook(() => useSSEStream())

        await act(async () => {
            await result.current.streamMessage({
                url: '/api/chat',
                body: { message: 'hi' },
                handlers,
            })
        })

        expect(onText).toHaveBeenCalledWith('Use this for best results')
    })

    // ── P2.4: Auto-Reconnect Tests ──────────────────────────────────────────

    /** Helper to create handlers with all required callbacks */
    function makeHandlers(overrides: Partial<Parameters<typeof vi.fn>[0]> = {}) {
        return {
            onText: vi.fn(),
            onProducts: vi.fn(),
            onTip: vi.fn(),
            onThinking: vi.fn(),
            onQuickReplies: vi.fn(),
            onDone: vi.fn(),
            onError: vi.fn(),
            onReconnecting: vi.fn(),
            ...overrides,
        }
    }

    it('retries on network error with exponential backoff and succeeds', async () => {
        vi.useFakeTimers()

        const successEvents = [
            'event: text\ndata: {"content":"Recovered!"}',
            'event: done\ndata: {"session_id":"sess-retry"}',
        ]

        // Fail twice with network error, succeed on 3rd attempt
        mockedApiFetch
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce(mockResponse(fakeSSEStream(successEvents)))

        const handlers = makeHandlers()
        const { result } = renderHook(() => useSSEStream())

        const streamPromise = act(async () => {
            const p = result.current.streamMessage({
                url: '/api/chat',
                body: { message: 'retry-me' },
                handlers,
            })
            // Advance past backoff delays (1s, then 2s)
            await vi.advanceTimersByTimeAsync(1000)
            await vi.advanceTimersByTimeAsync(2000)
            return p
        })

        await streamPromise

        expect(mockedApiFetch).toHaveBeenCalledTimes(3)
        expect(handlers.onReconnecting).toHaveBeenCalledTimes(2)
        expect(handlers.onReconnecting).toHaveBeenCalledWith(1, 3)
        expect(handlers.onReconnecting).toHaveBeenCalledWith(2, 3)
        expect(handlers.onText).toHaveBeenCalledWith('Recovered!')
        expect(handlers.onDone).toHaveBeenCalledWith('sess-retry')

        vi.useRealTimers()
    })

    it('retries on 503 server error and succeeds', async () => {
        vi.useFakeTimers()

        const successEvents = [
            'event: text\ndata: {"content":"Back online"}',
            'event: done\ndata: {"session_id":"sess-503"}',
        ]

        // First call returns 503, second succeeds
        mockedApiFetch
            .mockResolvedValueOnce(new Response(null, { status: 503 }))
            .mockResolvedValueOnce(mockResponse(fakeSSEStream(successEvents)))

        const handlers = makeHandlers()
        const { result } = renderHook(() => useSSEStream())

        const streamPromise = act(async () => {
            const p = result.current.streamMessage({
                url: '/api/chat',
                body: { message: 'hi' },
                handlers,
            })
            await vi.advanceTimersByTimeAsync(1000)
            return p
        })

        await streamPromise

        expect(mockedApiFetch).toHaveBeenCalledTimes(2)
        expect(handlers.onReconnecting).toHaveBeenCalledWith(1, 3)
        expect(handlers.onText).toHaveBeenCalledWith('Back online')

        vi.useRealTimers()
    })

    it('does not retry on AbortError (user cancel)', async () => {
        const abortError = new DOMException('Aborted', 'AbortError')
        mockedApiFetch.mockRejectedValueOnce(abortError)

        const handlers = makeHandlers()
        const { result } = renderHook(() => useSSEStream())

        await act(async () => {
            await result.current.streamMessage({
                url: '/api/chat',
                body: { message: 'hi' },
                handlers,
            })
        })

        // Should NOT retry — AbortError exits immediately
        expect(mockedApiFetch).toHaveBeenCalledTimes(1)
        expect(handlers.onReconnecting).not.toHaveBeenCalled()
    })

    it('does not retry on 4xx client error', async () => {
        mockedApiFetch.mockResolvedValueOnce(new Response(null, { status: 400 }))

        const handlers = makeHandlers()
        const { result } = renderHook(() => useSSEStream())

        await expect(
            act(async () => {
                await result.current.streamMessage({
                    url: '/api/chat',
                    body: { message: 'hi' },
                    handlers,
                })
            })
        ).rejects.toThrow('HTTP 400')

        expect(mockedApiFetch).toHaveBeenCalledTimes(1)
        expect(handlers.onReconnecting).not.toHaveBeenCalled()
    })

    it('throws after max retry attempts exhausted', async () => {
        vi.useFakeTimers()

        // All 3 attempts fail with network error
        mockedApiFetch
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))

        const handlers = makeHandlers()
        const { result } = renderHook(() => useSSEStream())

        // Start the stream but don't await yet — let the retry loop begin
        let streamError: Error | undefined
        let streamPromise: Promise<void> | undefined

        await act(async () => {
            streamPromise = result.current.streamMessage({
                url: '/api/chat',
                body: { message: 'doomed' },
                handlers,
            }).catch((e: Error) => { streamError = e })
        })

        // After first rejection, advance timers for the first backoff (1s)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1500)
        })

        // After second rejection, advance timers for the second backoff (2s)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2500)
        })

        // Allow any remaining microtasks to settle
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100)
        })

        expect(streamError).toBeDefined()
        expect(streamError!.message).toBe('Failed to fetch')
        expect(mockedApiFetch).toHaveBeenCalledTimes(3)
        // onReconnecting called before attempt 2 and 3 (not after final failure)
        expect(handlers.onReconnecting).toHaveBeenCalledTimes(2)
        expect(handlers.onReconnecting).toHaveBeenCalledWith(1, 3)
        expect(handlers.onReconnecting).toHaveBeenCalledWith(2, 3)

        vi.useRealTimers()
    })
})

