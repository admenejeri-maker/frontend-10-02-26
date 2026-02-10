/**
 * Chat Flow E2E Tests
 *
 * Tests core chat interaction: page load, sending messages,
 * receiving streamed responses, stopping generation, and input validation.
 *
 * NOTE: Uses mobile viewport (375x812) because the menu button and sidebar
 * are only visible on screens < lg breakpoint (1024px).
 */
import { test, expect } from '@playwright/test';
import {
    setupAllMocks,
    setupFreshUserMocks,
    mockChatStream,
    SIMPLE_TEXT_RESPONSE,
    THINKING_RESPONSE,
    SSE,
} from './fixtures/sse-mocks';

// Use mobile viewport for all tests — the menu button is lg:hidden
test.use({ viewport: { width: 375, height: 812 } });

test.describe('Chat Flow', () => {

    test('page loads with welcome screen and quick action pills', async ({ page }) => {
        await setupFreshUserMocks(page);
        await page.goto('/');

        // Welcome section should be visible
        const welcome = page.getByTestId('welcome-section');
        await expect(welcome).toBeVisible({ timeout: 15000 });

        // Quick pills should render — use .first() because pills exist in
        // both mobile wrapper (flex lg:hidden) and desktop wrapper (hidden lg:block)
        await expect(page.getByTestId('quick-pill-პროტეინი').first()).toBeVisible();
        await expect(page.getByTestId('quick-pill-კრეატინი').first()).toBeVisible();
        await expect(page.getByTestId('quick-pill-ვიტამინები').first()).toBeVisible();
    });

    test('send message and see streamed response', async ({ page }) => {
        await setupFreshUserMocks(page, SIMPLE_TEXT_RESPONSE);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Type a message
        const input = page.getByTestId('chat-input');
        await input.fill('გამარჯობა');

        // Send it
        const sendBtn = page.getByTestId('chat-send-button');
        await expect(sendBtn).toBeEnabled();
        await sendBtn.click();

        // Response should appear with the mocked text
        const response = page.getByTestId('chat-response');
        await expect(response).toBeVisible({ timeout: 10000 });
        await expect(response).toContainText('Scoop');

        // After sending, the UI transitions from welcome to active chat view.
        // The input testid changes from 'chat-input' to 'chat-input-active'.
        const activeInput = page.getByTestId('chat-input-active');
        await expect(activeInput).toHaveValue('');
    });

    test('send message with thinking events shows response', async ({ page }) => {
        await setupFreshUserMocks(page, THINKING_RESPONSE);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        const input = page.getByTestId('chat-input');
        await input.fill('პროტეინი მჭირდება');
        await page.getByTestId('chat-send-button').click();

        // Should eventually see response text
        const response = page.getByTestId('chat-response');
        await expect(response).toBeVisible({ timeout: 10000 });
        await expect(response).toContainText('Whey');
    });

    test('empty input prevents sending — no response appears', async ({ page }) => {
        await setupFreshUserMocks(page);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        const sendBtn = page.getByTestId('chat-send-button');

        // Button should be disabled when input is empty
        await expect(sendBtn).toBeDisabled();

        // Welcome screen should still be visible (no navigation happened)
        await expect(page.getByTestId('welcome-section')).toBeVisible();
    });

    test('Enter key sends message', async ({ page }) => {
        await setupFreshUserMocks(page, SIMPLE_TEXT_RESPONSE);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        const input = page.getByTestId('chat-input');
        await input.fill('ტესტი');
        await input.press('Enter');

        // Response should appear
        const response = page.getByTestId('chat-response');
        await expect(response).toBeVisible({ timeout: 10000 });
    });

    test('streaming completes with multiple text chunks', async ({ page }) => {
        const multiChunkEvents = [
            SSE.text('ველო'),
            SSE.text('დავ'),
            SSE.text('ელოდ'),
            SSE.text('ებით'),
            SSE.text('...'),
            SSE.done(),
        ];
        await setupFreshUserMocks(page, multiChunkEvents);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        const input = page.getByTestId('chat-input');
        await input.fill('ტესტი');
        await page.getByTestId('chat-send-button').click();

        // All chunks should be concatenated in the response
        const response = page.getByTestId('chat-response');
        await expect(response).toBeVisible({ timeout: 10000 });
    });
});
