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
})
