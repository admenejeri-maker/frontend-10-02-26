/**
 * SSE Mock Fixtures for E2E Testing
 *
 * Provides mock SSE event streams and API response interceptors
 * for deterministic Playwright tests without a live backend.
 *
 * Event types mirror the real SSE protocol used by useSSEStream.ts:
 *   text | products | tip | thinking | quick_replies | done | error | truncation_warning
 */
import { Page, Route } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════════

const BACKEND_URL = 'http://localhost:8080';

/** Standard CORS headers for cross-origin requests from localhost:3000 → 8080 */
const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-CSRF-Token',
    'Access-Control-Allow-Credentials': 'true',
};

/** Handle CORS preflight (OPTIONS) requests. Returns true if handled. */
async function handleCors(route: Route): Promise<boolean> {
    if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers: CORS_HEADERS });
        return true;
    }
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SSE Event Builders
// ═══════════════════════════════════════════════════════════════════════════════

export interface SSEEvent {
    type: string;
    data: Record<string, unknown>;
    /** Optional delay in ms before sending this event (simulates streaming) */
    delay?: number;
}

/** Build a raw SSE string from type + data */
function formatSSE(event: SSEEvent): string {
    return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/** Concatenate SSE events into a single response body */
function buildSSEBody(events: SSEEvent[]): string {
    return events.map(formatSSE).join('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pre-built SSE Event Factories
// ═══════════════════════════════════════════════════════════════════════════════

export const SSE = {
    /** Text chunk event — the main content stream */
    text: (content: string): SSEEvent => ({
        type: 'text',
        data: { content },
    }),

    /** Product recommendations embedded in response */
    products: (content: string): SSEEvent => ({
        type: 'products',
        data: { content },
    }),

    /** Tip event from backend */
    tip: (text: string): SSEEvent => ({
        type: 'tip',
        data: { text },
    }),

    /** Thinking/reasoning step */
    thinking: (content: string): SSEEvent => ({
        type: 'thinking',
        data: { content },
    }),

    /** Quick reply suggestions */
    quickReplies: (options: Array<{ title: string; payload: string }>): SSEEvent => ({
        type: 'quick_replies',
        data: { options },
    }),

    /** Stream completion — includes the session ID for persistence */
    done: (sessionId: string = 'mock-session-001'): SSEEvent => ({
        type: 'done',
        data: { session_id: sessionId },
    }),

    /** Error event */
    error: (message: string = 'დაფიქსირდა შეცდომა. გთხოვთ სცადოთ თავიდან.'): SSEEvent => ({
        type: 'error',
        data: { message },
    }),

    /** Truncation warning */
    truncationWarning: (finishReason: string = 'MAX_TOKENS'): SSEEvent => ({
        type: 'truncation_warning',
        data: { finish_reason: finishReason },
    }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// Pre-built SSE Scenarios (common test fixtures)
// ═══════════════════════════════════════════════════════════════════════════════

/** Simple text response followed by done — the most common scenario */
export const SIMPLE_TEXT_RESPONSE: SSEEvent[] = [
    SSE.text('გამარჯობა! '),
    SSE.text('მე ვარ Scoop, '),
    SSE.text('თქვენი სპორტული კონსულტანტი.'),
    SSE.done('mock-session-001'),
];

/** Response with thinking → text → done */
export const THINKING_RESPONSE: SSEEvent[] = [
    SSE.thinking('ანალიზი: მომხმარებელი ეძებს პროტეინს...'),
    SSE.text('კუნთის ზრდისთვის გირჩევთ Whey პროტეინს.'),
    SSE.done('mock-session-001'),
];

/** Response with products embedded */
export const PRODUCT_RESPONSE: SSEEvent[] = [
    SSE.text('აქ არის რეკომენდაციები: '),
    SSE.products('**Whey Protein** - ₾89.99\n**BCAA** - ₾45.00'),
    SSE.done('mock-session-001'),
];

/** Response with quick replies */
export const QUICK_REPLY_RESPONSE: SSEEvent[] = [
    SSE.text('რა ტიპის ვარჯიში გაქვთ?'),
    SSE.quickReplies([
        { title: 'ძალოვანი', payload: 'ძალოვანი ვარჯიშებს ვაკეთებ' },
        { title: 'კარდიო', payload: 'კარდიო ვარჯიშებს ვაკეთებ' },
    ]),
    SSE.done('mock-session-001'),
];

/** Error scenario */
export const ERROR_RESPONSE: SSEEvent[] = [
    SSE.error('სერვერთან კავშირი ვერ მოხერხდა.'),
];

// ═══════════════════════════════════════════════════════════════════════════════
// Mock API Responses
// ═══════════════════════════════════════════════════════════════════════════════

export const MOCK_SESSIONS = {
    sessions: [
        {
            session_id: 'session-aaa-111',
            title: 'პროტეინის შესახებ',
            created_at: '2026-02-10T10:00:00Z',
            updated_at: '2026-02-10T10:05:00Z',
        },
        {
            session_id: 'session-bbb-222',
            title: 'ვარჯიშის პროგრამა',
            created_at: '2026-02-09T14:00:00Z',
            updated_at: '2026-02-09T14:30:00Z',
        },
    ],
};

export const MOCK_HISTORY = {
    messages: [
        { role: 'user', content: 'რა პროტეინი მირჩევ?' },
        { role: 'assistant', content: 'გირჩევთ Whey პროტეინს კუნთის ზრდისთვის.' },
        { role: 'user', content: 'რამდენი უნდა მივიღო?' },
        { role: 'assistant', content: 'დღეში 25-30 გრამი საკმარისია ვარჯიშის შემდეგ.' },
    ],
};

export const MOCK_CSRF = {
    csrf_token: 'mock-csrf-token-e2e',
};

export const MOCK_API_KEY = {
    key: 'mock-api-key-e2e',
    key_prefix: 'mock',
    user_id: 'widget_testuser123',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Playwright Route Interceptors
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Intercept a POST to /api/v1/chat/stream and respond with mock SSE events.
 *
 * @param page  Playwright page
 * @param events  Array of SSE events to stream back
 */
export async function mockChatStream(page: Page, events: SSEEvent[] = SIMPLE_TEXT_RESPONSE): Promise<void> {
    await page.route(`${BACKEND_URL}/api/v1/chat/stream`, async (route: Route) => {
        if (await handleCors(route)) return;
        const body = buildSSEBody(events);
        await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            headers: {
                ...CORS_HEADERS,
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
            body,
        });
    });
}

/**
 * Mock the /sessions/{userId} endpoint with a list of conversations.
 */
export async function mockSessionsList(page: Page, sessions = MOCK_SESSIONS): Promise<void> {
    await page.route(`${BACKEND_URL}/api/v1/sessions/**`, async (route: Route) => {
        if (await handleCors(route)) return;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: CORS_HEADERS,
            body: JSON.stringify(sessions),
        });
    });
}

/**
 * Mock the /session/{sessionId}/history endpoint with message history.
 */
export async function mockSessionHistory(page: Page, history = MOCK_HISTORY): Promise<void> {
    await page.route(`${BACKEND_URL}/api/v1/session/*/history`, async (route: Route) => {
        if (await handleCors(route)) return;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: CORS_HEADERS,
            body: JSON.stringify(history),
        });
    });
}

/**
 * Mock the CSRF token endpoint.
 */
export async function mockCsrfToken(page: Page): Promise<void> {
    await page.route(`${BACKEND_URL}/csrf-token`, async (route: Route) => {
        if (await handleCors(route)) return;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: CORS_HEADERS,
            body: JSON.stringify(MOCK_CSRF),
        });
    });
}

/**
 * Mock the API key enrollment endpoint.
 */
export async function mockApiKeyEnroll(page: Page): Promise<void> {
    await page.route(`${BACKEND_URL}/api/v1/auth/key`, async (route: Route) => {
        if (await handleCors(route)) return;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: CORS_HEADERS,
            body: JSON.stringify(MOCK_API_KEY),
        });
    });
}

/**
 * Mock the delete user data endpoint.
 */
export async function mockDeleteUserData(page: Page): Promise<void> {
    await page.route(`${BACKEND_URL}/api/v1/user/*/data`, async (route: Route) => {
        if (await handleCors(route)) return;
        if (route.request().method() === 'DELETE') {
            await route.fulfill({ status: 200, contentType: 'application/json', headers: CORS_HEADERS, body: '{"status":"ok"}' });
        } else {
            await route.fallback();
        }
    });
}

/**
 * Set up ALL common mocks for a standard test page.
 * Call this in beforeEach to avoid repetition.
 *
 * @param page Playwright page
 * @param sseEvents Optional SSE events for chat stream (defaults to SIMPLE_TEXT_RESPONSE)
 */
export async function setupAllMocks(
    page: Page,
    sseEvents: SSEEvent[] = SIMPLE_TEXT_RESPONSE,
): Promise<void> {
    await mockCsrfToken(page);
    await mockApiKeyEnroll(page);
    await mockSessionsList(page);
    await mockSessionHistory(page);
    await mockChatStream(page, sseEvents);
    await mockDeleteUserData(page);

    // Set localStorage values before navigation so the app finds them
    await page.addInitScript(() => {
        localStorage.setItem('scoop_user_id', 'widget_testuser123');
        localStorage.setItem('scoop_history_consent', 'true');
    });
}

/**
 * Set up mocks for a "fresh user" who has no prior sessions.
 */
export async function setupFreshUserMocks(
    page: Page,
    sseEvents: SSEEvent[] = SIMPLE_TEXT_RESPONSE,
): Promise<void> {
    await mockCsrfToken(page);
    await mockApiKeyEnroll(page);
    await mockSessionsList(page, { sessions: [] });
    await mockChatStream(page, sseEvents);
    await mockDeleteUserData(page);

    await page.addInitScript(() => {
        localStorage.setItem('scoop_user_id', 'widget_testuser123');
        localStorage.setItem('scoop_history_consent', 'true');
    });
}
