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
 * Drop-in replacement for fetch() that auto-injects:
 * - X-API-Key header (always, when key exists)
 * - X-CSRF-Token header (on POST/PUT/DELETE/PATCH)
 * - credentials: 'include' (so csrf_token cookie is sent)
 *
 * On 403 with CSRF error code, auto-retries once after refreshing the token.
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

    // P2.6: Auto-refresh CSRF token on 403 CSRF error (one retry)
    if (response.status === 403 && CSRF_PROTECTED_METHODS.has(method)) {
        try {
            const errorData = await response.clone().json();
            if (errorData.error_code?.startsWith('CSRF_')) {
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

