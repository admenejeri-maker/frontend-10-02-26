/**
 * Centralized API Client — P0.1 Auth (Step 7) + P2.6 CSRF Protection
 *
 * Wraps fetch() to inject:
 * - X-API-Key header from localStorage (P0.1 Auth)
 * - X-CSRF-Token header for state-changing requests (P2.6 CSRF)
 *
 * Graceful degradation: when no key/token is stored, headers are omitted
 * and the backend falls through to its feature flag logic.
 */

const API_KEY_STORAGE_KEY = 'scoop_api_key';
const CSRF_TOKEN_KEY = 'scoop_csrf_token';

// State-changing HTTP methods that require CSRF token
const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

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

// =============================================================================
// P2.6: CSRF Token Management
// =============================================================================

/** Read cached CSRF token from sessionStorage (null if absent). */
function getCsrfToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(CSRF_TOKEN_KEY);
}

/** Cache a CSRF token in sessionStorage. */
function setCsrfToken(token: string): void {
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);
}

/** Clear the cached CSRF token (forces re-fetch). */
function clearCsrfToken(): void {
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
}

/**
 * Fetch a CSRF token from the backend.
 * Called lazily on first state-changing request, or after a 403 CSRF error.
 * Returns the token string, or null on failure.
 */
export async function fetchCsrfToken(backendUrl: string): Promise<string | null> {
    try {
        const res = await fetch(`${backendUrl}/csrf-token`, {
            method: 'GET',
            credentials: 'include', // Accept Set-Cookie from backend
        });

        if (!res.ok) {
            console.warn(`[Scoop] CSRF token fetch failed: ${res.status}`);
            return null;
        }

        const data = await res.json();
        if (data.csrf_token) {
            setCsrfToken(data.csrf_token);
            return data.csrf_token;
        }
        return null;
    } catch (err) {
        console.warn('[Scoop] CSRF token fetch error:', err);
        return null;
    }
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
        const res = await fetch(`${backendUrl}/api/v1/auth/key`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',  // Ensure cookies sent cross-origin
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
 * Drop-in replacement for fetch() that auto-injects:
 * - X-API-Key header (always, when key exists)
 * - X-CSRF-Token header (on POST/PUT/DELETE/PATCH)
 * - credentials: 'include' (so csrf_token cookie is sent)
 *
 * Auto-recovery:
 * - On 401 with stale API key: clears key, re-enrolls, retries once
 * - On 403 with CSRF error: refreshes token, retries once
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

    // P2.6: Inject CSRF token for state-changing methods
    const method = (options.method || 'GET').toUpperCase();
    if (CSRF_PROTECTED_METHODS.has(method)) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            headers.set('X-CSRF-Token', csrfToken);
        }
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Send csrf_token cookie
    });

    // P0 Fix: Auto-recovery on 401 with stale API key
    // If we sent a key and got 401, the key was deleted from MongoDB (stale key cleanup)
    // Clear the stale key, re-enroll, and retry once
    if (response.status === 401 && apiKey) {
        console.warn('[Scoop] 401 detected — stale API key, attempting re-enrollment...');
        clearApiKey();

        // Get userId from localStorage to re-enroll
        const userId = typeof window !== 'undefined'
            ? localStorage.getItem('scoop_user_id')
            : null;

        if (userId) {
            // Extract backend URL from the request URL
            const urlObj = new URL(url);
            const backendUrl = `${urlObj.protocol}//${urlObj.host}`;

            // Re-enroll (now proceeds since we cleared the key)
            await enrollApiKey(userId, backendUrl);

            const newKey = getApiKey();
            if (newKey) {
                console.log('[Scoop] Re-enrollment successful, retrying request...');

                // Build new headers with fresh key
                const retryHeaders = new Headers(options.headers);
                retryHeaders.set('X-API-Key', newKey);

                // Re-inject CSRF token if needed
                if (CSRF_PROTECTED_METHODS.has(method)) {
                    const csrfToken = getCsrfToken();
                    if (csrfToken) {
                        retryHeaders.set('X-CSRF-Token', csrfToken);
                    }
                }

                // Retry the request once with new key
                return fetch(url, {
                    ...options,
                    headers: retryHeaders,
                    credentials: 'include',
                });
            } else {
                console.warn('[Scoop] Re-enrollment failed, returning original 401');
            }
        } else {
            console.warn('[Scoop] No userId found, cannot re-enroll');
        }
    }

    // Incognito race condition fix: 401 with NO API key
    // Attempt enrollment and retry once before giving up
    if (response.status === 401 && !apiKey) {
        console.warn('[Scoop] 401 with no API key — attempting enrollment...');

        const userId = typeof window !== 'undefined'
            ? localStorage.getItem('scoop_user_id')
            : null;

        if (userId) {
            const urlObj = new URL(url);
            const backendUrl = `${urlObj.protocol}//${urlObj.host}`;

            await enrollApiKey(userId, backendUrl);

            const newKey = getApiKey();
            if (newKey) {
                console.log('[Scoop] Enrollment recovered, retrying request...');

                const retryHeaders = new Headers(options.headers);
                retryHeaders.set('X-API-Key', newKey);

                if (CSRF_PROTECTED_METHODS.has(method)) {
                    const csrfToken = getCsrfToken();
                    if (csrfToken) {
                        retryHeaders.set('X-CSRF-Token', csrfToken);
                    }
                }

                return fetch(url, {
                    ...options,
                    headers: retryHeaders,
                    credentials: 'include',
                });
            } else {
                console.warn('[Scoop] Enrollment failed, returning original 401');
            }
        } else {
            console.warn('[Scoop] No userId found, cannot enroll');
        }
    }

    // P2.6: Auto-refresh CSRF token on 403 CSRF error (one retry)
    if (response.status === 403 && CSRF_PROTECTED_METHODS.has(method)) {
        try {
            const errorData = await response.clone().json();
            if (errorData.error?.code?.startsWith('CSRF_')) {
                console.warn('[Scoop] CSRF token rejected, refreshing...');
                clearCsrfToken();

                // Extract backend URL from the request URL
                const urlObj = new URL(url);
                const backendUrl = `${urlObj.protocol}//${urlObj.host}`;
                const newToken = await fetchCsrfToken(backendUrl);

                if (newToken) {
                    headers.set('X-CSRF-Token', newToken);
                    return fetch(url, {
                        ...options,
                        headers,
                        credentials: 'include',
                    });
                }
            }
        } catch {
            // If error parsing fails, return original response
        }
    }

    return response;
}

