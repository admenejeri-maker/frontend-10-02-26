/**
 * Error Handling & Responsive E2E Tests
 *
 * Tests network error scenarios and mobile viewport behavior.
 */
import { test, expect } from '@playwright/test';
import {
    setupFreshUserMocks,
    mockCsrfToken,
    mockApiKeyEnroll,
    mockSessionsList,
    mockDeleteUserData,
    ERROR_RESPONSE,
} from './fixtures/sse-mocks';

// Mobile viewport for all tests
test.use({ viewport: { width: 375, height: 812 } });

test.describe('Error Handling', () => {

    test('SSE error event shows error in UI', async ({ page }) => {
        await setupFreshUserMocks(page, ERROR_RESPONSE);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Send a message
        const input = page.getByTestId('chat-input');
        await input.fill('ტესტი');
        await page.getByTestId('chat-send-button').click();

        // Should see error message in the response area
        const response = page.getByTestId('chat-response');
        await expect(response).toBeVisible({ timeout: 10000 });
        await expect(response).toContainText('კავშირი', { timeout: 5000 });
    });

    test('network failure (HTTP 500) keeps input usable', async ({ page }) => {
        // Set up only non-stream mocks; the stream itself will fail
        await mockCsrfToken(page);
        await mockApiKeyEnroll(page);
        await mockSessionsList(page, { sessions: [] });
        await mockDeleteUserData(page);

        // Mock chat stream to return 500 (with CORS preflight handling)
        const BACKEND_URL = 'http://localhost:8080';
        await page.route(`${BACKEND_URL}/api/v1/chat/stream`, async (route) => {
            if (route.request().method() === 'OPTIONS') {
                await route.fulfill({
                    status: 204,
                    headers: {
                        'Access-Control-Allow-Origin': 'http://localhost:3000',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-CSRF-Token',
                        'Access-Control-Allow-Credentials': 'true',
                    },
                });
                return;
            }
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:3000',
                    'Access-Control-Allow-Credentials': 'true',
                },
                body: JSON.stringify({ error: 'Internal Server Error' }),
            });
        });

        await page.addInitScript(() => {
            localStorage.setItem('scoop_user_id', 'widget_testuser123');
            localStorage.setItem('scoop_history_consent', 'true');
        });

        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Send a message
        const input = page.getByTestId('chat-input');
        await input.fill('ტესტი');
        await page.getByTestId('chat-send-button').click();

        // Wait for the error to be processed (SSE has retry logic with backoff)
        await page.waitForTimeout(8000);

        // After sending a message, UI transitions from welcome to active chat view.
        // The input testid changes from 'chat-input' to 'chat-input-active'.
        const activeInput = page.getByTestId('chat-input-active');
        await expect(activeInput).toBeVisible();
    });
});

test.describe('Mobile Responsive', () => {

    test('sidebar toggle works on mobile viewport', async ({ page }) => {
        await setupFreshUserMocks(page);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Menu button should be visible on mobile
        const menuBtn = page.getByTestId('chat-menu-button');
        await expect(menuBtn).toBeVisible();

        // Open sidebar
        await menuBtn.click();
        const sidebar = page.getByTestId('sidebar-container');
        await expect(sidebar).toBeVisible({ timeout: 5000 });

        // Close sidebar
        const closeBtn = page.getByTestId('sidebar-close');
        await closeBtn.click();

        // Wait for slide animation
        await page.waitForTimeout(500);
    });

    test('chat input is usable on mobile viewport', async ({ page }) => {
        await setupFreshUserMocks(page);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Input should be visible and fillable
        const input = page.getByTestId('chat-input');
        await expect(input).toBeVisible();
        await input.fill('მობილური ტესტი');
        await expect(input).toHaveValue('მობილური ტესტი');

        // Send button should be visible
        const sendBtn = page.getByTestId('chat-send-button');
        await expect(sendBtn).toBeVisible();
    });
});
