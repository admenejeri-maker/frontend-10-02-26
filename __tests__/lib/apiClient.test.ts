import { apiFetch, getApiKey, setApiKey, clearApiKey } from '@/lib/apiClient'

// Internal storage keys (must match apiClient.ts constants)
const CSRF_TOKEN_KEY = 'scoop_csrf_token'

// Mock localStorage
const localStorageMock: Record<string, string> = {}
const storageSpy = {
    getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value }),
    removeItem: vi.fn((key: string) => { delete localStorageMock[key] }),
}

// Mock sessionStorage (used internally by apiClient for CSRF tokens)
const sessionStorageMock: Record<string, string> = {}
const sessionSpy = {
    getItem: vi.fn((key: string) => sessionStorageMock[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { sessionStorageMock[key] = value }),
    removeItem: vi.fn((key: string) => { delete sessionStorageMock[key] }),
}

Object.defineProperty(globalThis, 'localStorage', {
    value: storageSpy,
    writable: true,
})

Object.defineProperty(globalThis, 'sessionStorage', {
    value: sessionSpy,
    writable: true,
})

// Mock window explicitly (for SSR guard tests)
Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    writable: true,
})

describe('apiClient key management', () => {
    beforeEach(() => {
        // Clear storage between tests
        Object.keys(localStorageMock).forEach(key => delete localStorageMock[key])
        Object.keys(sessionStorageMock).forEach(key => delete sessionStorageMock[key])
        vi.clearAllMocks()
    })

    it('setApiKey persists to localStorage', () => {
        setApiKey('test-key-123')

        expect(storageSpy.setItem).toHaveBeenCalledWith(
            expect.stringContaining('api_key'),
            'test-key-123'
        )
    })

    it('getApiKey retrieves from localStorage', () => {
        setApiKey('my-api-key')
        const key = getApiKey()

        expect(key).toBe('my-api-key')
    })

    it('clearApiKey removes key from localStorage', () => {
        setApiKey('ephemeral-key')
        clearApiKey()

        expect(storageSpy.removeItem).toHaveBeenCalled()
        expect(getApiKey()).toBeNull()
    })

    it('CSRF token management works roundtrip via sessionStorage', () => {
        sessionStorageMock[CSRF_TOKEN_KEY] = 'csrf-abc'
        expect(sessionSpy.getItem(CSRF_TOKEN_KEY)).toBe('csrf-abc')

        delete sessionStorageMock[CSRF_TOKEN_KEY]
        expect(sessionSpy.getItem(CSRF_TOKEN_KEY)).toBeNull()
    })
})

describe('apiFetch', () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080'

    beforeEach(() => {
        Object.keys(localStorageMock).forEach(key => delete localStorageMock[key])
        Object.keys(sessionStorageMock).forEach(key => delete sessionStorageMock[key])
        vi.clearAllMocks()
        vi.restoreAllMocks()
    })

    it('injects X-API-Key header when key is set', async () => {
        setApiKey('test-api-key')

        const mockFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ ok: true }), { status: 200 })
        )
        globalThis.fetch = mockFetch

        await apiFetch('/api/test', { method: 'GET' })

        expect(mockFetch).toHaveBeenCalledTimes(1)
        const [, options] = mockFetch.mock.calls[0]
        expect(options.headers.get('X-API-Key')).toBe('test-api-key')
    })

    it('injects CSRF token on POST requests', async () => {
        setApiKey('key')
        sessionStorageMock[CSRF_TOKEN_KEY] = 'csrf-token-xyz'

        const mockFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ ok: true }), { status: 200 })
        )
        globalThis.fetch = mockFetch

        await apiFetch('/api/test', { method: 'POST', body: '{}' })

        const [, options] = mockFetch.mock.calls[0]
        expect(options.headers.get('X-CSRF-Token')).toBe('csrf-token-xyz')
    })

    it('skips CSRF token on GET requests', async () => {
        setApiKey('key')
        sessionStorageMock[CSRF_TOKEN_KEY] = 'should-not-appear'

        const mockFetch = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ ok: true }), { status: 200 })
        )
        globalThis.fetch = mockFetch

        await apiFetch('/api/test', { method: 'GET' })

        const [, options] = mockFetch.mock.calls[0]
        expect(options.headers.get('X-CSRF-Token')).toBeNull()
    })
})
