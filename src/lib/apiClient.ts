/**
 * Centralized API Client — P0.1 Auth (Step 7)
 *
 * Wraps fetch() to inject the X-API-Key header from localStorage.
 * Graceful degradation: when no key is stored, the header is omitted
 * and the backend falls through to its REQUIRE_API_KEY feature flag logic.
 */

const API_KEY_STORAGE_KEY = 'scoop_api_key';

/** Read the API key from localStorage (null if absent). */
export function getApiKey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(API_KEY_STORAGE_KEY);
}

/** Persist an API key to localStorage. */
export function setApiKey(key: string): void {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

/** Remove the stored API key. */
export function clearApiKey(): void {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
}

/**
 * Auto-enroll: generate an API key on first visit.
 * Idempotent — no-op if a key already exists in localStorage.
 * Fire-and-forget: failures are logged, never block the UI.
 */
export async function enrollApiKey(
    userId: string,
    backendUrl: string,
): Promise<void> {
    if (typeof window === 'undefined') return;
    if (getApiKey()) return; // Already enrolled

    try {
        const res = await fetch(`${backendUrl}/auth/key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId }),
        });

        if (!res.ok) {
            console.warn(`[Scoop] Key enrollment failed: ${res.status}`);
            return;
        }

        const data = await res.json();
        if (data.key) {
            setApiKey(data.key);
            console.log(`[Scoop] API key enrolled (prefix: ${data.key_prefix})`);
        }
    } catch (err) {
        console.warn('[Scoop] Key enrollment network error:', err);
    }
}

/**
 * Drop-in replacement for fetch() that auto-injects X-API-Key.
 * All existing RequestInit options (headers, method, body, signal, etc.)
 * are preserved — only the auth header is added when a key exists.
 */
export async function apiFetch(
    url: string,
    options: RequestInit = {},
): Promise<Response> {
    const apiKey = getApiKey();
    const headers = new Headers(options.headers);

    if (apiKey) {
        headers.set('X-API-Key', apiKey);
    }

    return fetch(url, { ...options, headers });
}
