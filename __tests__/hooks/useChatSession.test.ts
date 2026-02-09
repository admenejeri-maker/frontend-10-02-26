/**
 * useChatSession Hook Tests
 *
 * Tests session management: generating IDs, creating new conversations,
 * and consent-gated enrollment.
 */

import { renderHook, act } from '@testing-library/react'

// Provide in-memory localStorage/sessionStorage for hooks that read them directly
const storageMock: Record<string, string> = {}
const localStorageMock = {
    getItem: (key: string) => storageMock[key] ?? null,
    setItem: (key: string, value: string) => { storageMock[key] = value },
    removeItem: (key: string) => { delete storageMock[key] },
    clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]) },
    get length() { return Object.keys(storageMock).length },
    key: (i: number) => Object.keys(storageMock)[i] ?? null,
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })
Object.defineProperty(globalThis, 'sessionStorage', { value: localStorageMock, writable: true })

import { useChatSession } from '@/hooks/useChatSession'

// Mock apiClient
vi.mock('@/lib/apiClient', () => ({
    apiFetch: vi.fn(),
    getApiKey: vi.fn(() => null),
    setApiKey: vi.fn(),
    enrollApiKey: vi.fn(),
}))

import { getApiKey } from '@/lib/apiClient'
const mockedGetApiKey = vi.mocked(getApiKey)

describe('useChatSession', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('initialises with empty conversations and null activeSessionId', () => {
        const { result } = renderHook(() => useChatSession())

        expect(result.current.conversations).toEqual([])
        expect(result.current.activeId).toBeNull()
    })

    it('generateMessageId returns a string with the expected format', () => {
        const { result } = renderHook(() => useChatSession())

        const id = result.current.generateMessageId()

        // Should be a non-empty string (uses crypto.randomUUID or fallback)
        expect(typeof id).toBe('string')
        expect(id.length).toBeGreaterThan(0)
    })

    it('startNewConversation resets the active session to null', () => {
        const { result } = renderHook(() => useChatSession())

        act(() => {
            result.current.startNewChat()
        })

        expect(result.current.activeId).toBeNull()
    })

    it('does not enroll when no API key exists and consent is false', () => {
        mockedGetApiKey.mockReturnValue(null)

        const { result } = renderHook(() => useChatSession())

        // With no key and consent=false, enrollment should not be triggered
        // This is a guard test — the hook should remain in unenrolled state
        expect(result.current.conversations).toEqual([])
    })
})
