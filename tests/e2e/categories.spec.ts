/**
 * Quick Action Pills E2E Tests
 *
 * Tests the welcome screen quick action pill buttons.
 * Clicking a pill sends the text directly (pills call sendMessage, not setInput).
 *
 * NOTE: Chat.tsx renders QuickActionPills twice — once in a mobile wrapper
 * (flex lg:hidden) and once in a desktop wrapper (hidden lg:block).
 * On mobile viewport, `hidden` hides the desktop pills visually but Playwright
 * still sees them in the DOM. We use `.first()` to target the visible mobile pill.
 */
import { test, expect } from '@playwright/test';
import {
    setupFreshUserMocks,
    SIMPLE_TEXT_RESPONSE,
} from './fixtures/sse-mocks';

test.use({ viewport: { width: 375, height: 812 } });

test.describe('Quick Action Pills', () => {

    test('quick pills are visible on welcome screen', async ({ page }) => {
        await setupFreshUserMocks(page);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Use .first() because pills are rendered twice (mobile + desktop)
        // On mobile, the first instance (mobile wrapper) is visible
        await expect(page.getByTestId('quick-pill-პროტეინი').first()).toBeVisible();
        await expect(page.getByTestId('quick-pill-კრეატინი').first()).toBeVisible();
        await expect(page.getByTestId('quick-pill-ვიტამინები').first()).toBeVisible();
        await expect(page.getByTestId('quick-pill-ჯანმრთელობა').first()).toBeVisible();
        await expect(page.getByTestId('quick-pill-წონა').first()).toBeVisible();
    });

    test('clicking პროტეინი pill triggers chat response', async ({ page }) => {
        await setupFreshUserMocks(page, SIMPLE_TEXT_RESPONSE);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Click the visible mobile pill
        await page.getByTestId('quick-pill-პროტეინი').first().click();

        // Should get a response (pill sends message directly)
        const response = page.getByTestId('chat-response');
        await expect(response).toBeVisible({ timeout: 10000 });
    });

    test('clicking კრეატინი pill triggers chat response', async ({ page }) => {
        await setupFreshUserMocks(page, SIMPLE_TEXT_RESPONSE);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        await page.getByTestId('quick-pill-კრეატინი').first().click();

        const response = page.getByTestId('chat-response');
        await expect(response).toBeVisible({ timeout: 10000 });
    });

    test('clicking ვიტამინები pill triggers chat response', async ({ page }) => {
        await setupFreshUserMocks(page, SIMPLE_TEXT_RESPONSE);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        await page.getByTestId('quick-pill-ვიტამინები').first().click();

        const response = page.getByTestId('chat-response');
        await expect(response).toBeVisible({ timeout: 10000 });
    });

    test('pills disappear after sending a message', async ({ page }) => {
        await setupFreshUserMocks(page, SIMPLE_TEXT_RESPONSE);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Send via pill
        await page.getByTestId('quick-pill-პროტეინი').first().click();

        // After response appears, welcome screen (with pills) should be gone
        await page.getByTestId('chat-response').waitFor({ state: 'visible', timeout: 10000 });
        await expect(page.getByTestId('welcome-section')).not.toBeVisible({ timeout: 5000 });
    });
});
