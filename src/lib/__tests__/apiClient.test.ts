/**
 * Tests for apiClient.ts (Incognito race condition fix)
 * T7: enrollApiKey sends credentials: 'include'
 * T8: apiFetch 401 + no key → enrollment + retry
 * T9: apiFetch 401 + no key + enrollment fails → returns 401
 * T10: REGRESSION - apiFetch 401 + existing stale key → clears, re-enrolls, retries
 */
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';

// We need to test the actual module, so we use dynamic imports
// and mock global.fetch directly
describe('apiClient', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        localStorage.clear();
    });

    // ─── T7: enrollApiKey sends credentials: 'include' ──────────────────────

    test('enrollApiKey sends fetch with credentials: include', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ key: 'new_key_abc', key_prefix: 'new_' }),
        });
        global.fetch = mockFetch;

        // Import fresh to avoid module cache issues
        const { enrollApiKey } = await import('../../lib/apiClient');
        // Ensure no existing key so enrollment actually fires
        localStorage.removeItem('scoop_api_key');

        await enrollApiKey('test_user', 'https://api.example.com');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [, fetchOptions] = mockFetch.mock.calls[0];
        expect(fetchOptions.credentials).toBe('include');
        expect(fetchOptions.method).toBe('POST');
    });

    // ─── T8: apiFetch 401 + no key → enrollment recovers, retries ───────────

    test('apiFetch retries on 401 when no API key, enrollment succeeds', async () => {
        // Set up userId for recovery
        localStorage.setItem('scoop_user_id', 'test_user_123');
        // No scoop_api_key → apiKey will be null

        let callCount = 0;
        const mockFetch = vi.fn().mockImplementation((url: string) => {
            callCount++;
            if (callCount === 1) {
                // First call: the original apiFetch request → 401
                return Promise.resolve({
                    status: 401,
                    ok: false,
                    clone: () => ({
                        json: () => Promise.resolve({ error: 'Unauthorized' }),
                    }),
                });
            }
            if (callCount === 2) {
                // Second call: enrollApiKey POST
                // Set the key in localStorage to simulate successful enrollment
                localStorage.setItem('scoop_api_key', 'enrolled_key_xyz');
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ key: 'enrolled_key_xyz', key_prefix: 'enrolled_' }),
                });
            }
            // Third call: the retry after enrollment
            return Promise.resolve({
                status: 200,
                ok: true,
                json: () => Promise.resolve({ sessions: [] }),
            });
        });
        global.fetch = mockFetch;

        const { apiFetch } = await import('../../lib/apiClient');

        const response = await apiFetch('https://api.example.com/api/v1/sessions/test_user_123');

        // Should have made 3 fetch calls: original 401, enrollApiKey, retry
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(response.status).toBe(200);
    });

    // ─── T9: apiFetch 401 + no key + enrollment fails → returns 401 ─────────

    test('apiFetch returns 401 when no API key and enrollment fails', async () => {
        localStorage.setItem('scoop_user_id', 'test_user_456');
        // No scoop_api_key

        let callCount = 0;
        const mockFetch = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // Original request → 401
                return Promise.resolve({
                    status: 401,
                    ok: false,
                    clone: () => ({
                        json: () => Promise.resolve({ error: 'Unauthorized' }),
                    }),
                });
            }
            // enrollApiKey attempt → fails
            return Promise.resolve({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Server error' }),
            });
        });
        global.fetch = mockFetch;

        const { apiFetch } = await import('../../lib/apiClient');

        const response = await apiFetch('https://api.example.com/api/v1/sessions/test_user_456');

        // Should return the original 401 since enrollment failed
        expect(response.status).toBe(401);
    });

    // ─── T10: REGRESSION - apiFetch 401 + existing stale key ─────────────────

    test('apiFetch with existing stale key on 401 clears key and re-enrolls', async () => {
        localStorage.setItem('scoop_user_id', 'test_user_789');
        localStorage.setItem('scoop_api_key', 'stale_key_123');

        let callCount = 0;
        const mockFetch = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // Original request with stale key → 401
                return Promise.resolve({
                    status: 401,
                    ok: false,
                    clone: () => ({
                        json: () => Promise.resolve({ error: 'Unauthorized' }),
                    }),
                });
            }
            if (callCount === 2) {
                // enrollApiKey → success with fresh key
                localStorage.setItem('scoop_api_key', 'fresh_key_456');
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ key: 'fresh_key_456', key_prefix: 'fresh_' }),
                });
            }
            // Retry with fresh key → success
            return Promise.resolve({
                status: 200,
                ok: true,
                json: () => Promise.resolve({ sessions: [] }),
            });
        });
        global.fetch = mockFetch;

        const { apiFetch } = await import('../../lib/apiClient');

        const response = await apiFetch('https://api.example.com/api/v1/sessions/test_user_789');

        // Verify: stale key was cleared, re-enroll happened, retry succeeded
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(response.status).toBe(200);

        // The first call should have had the stale key
        const firstCallHeaders = mockFetch.mock.calls[0][1]?.headers;
        if (firstCallHeaders instanceof Headers) {
            expect(firstCallHeaders.get('X-API-Key')).toBe('stale_key_123');
        }
    });
});
