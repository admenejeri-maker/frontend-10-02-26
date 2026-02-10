/**
 * Sidebar E2E Tests
 *
 * Tests sidebar open/close, loading conversations from history,
 * creating new chats, and conversation item rendering.
 *
 * NOTE: Uses mobile viewport (375x812) because the sidebar toggle
 * and close button are lg:hidden — only visible on mobile viewports.
 * On desktop (≥1024px), the sidebar is always visible.
 */
import { test, expect } from '@playwright/test';
import {
    setupAllMocks,
    setupFreshUserMocks,
    MOCK_SESSIONS,
    MOCK_HISTORY,
} from './fixtures/sse-mocks';

// Mobile viewport — sidebar toggle is lg:hidden
test.use({ viewport: { width: 375, height: 812 } });

test.describe('Sidebar', () => {

    test('open and close sidebar via menu button', async ({ page }) => {
        await setupAllMocks(page);
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

        // Sidebar should slide away (becomes invisible due to -translate-x-full)
        // On mobile, the overlay and sidebar slide off-screen
        await page.waitForTimeout(500); // wait for animation
    });

    test('sidebar shows conversation list from backend', async ({ page }) => {
        await setupAllMocks(page);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Open sidebar
        await page.getByTestId('chat-menu-button').click();
        const sidebar = page.getByTestId('sidebar-container');
        await expect(sidebar).toBeVisible({ timeout: 5000 });

        // Both mock sessions should be listed
        const conv1 = page.getByTestId(`sidebar-conversation-${MOCK_SESSIONS.sessions[0].session_id}`);
        const conv2 = page.getByTestId(`sidebar-conversation-${MOCK_SESSIONS.sessions[1].session_id}`);
        await expect(conv1).toBeVisible({ timeout: 3000 });
        await expect(conv2).toBeVisible({ timeout: 3000 });
    });

    test('click conversation loads history messages', async ({ page }) => {
        await setupAllMocks(page);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Open sidebar
        await page.getByTestId('chat-menu-button').click();
        await page.getByTestId('sidebar-container').waitFor({ state: 'visible', timeout: 5000 });

        // Click first conversation
        const conv1 = page.getByTestId(`sidebar-conversation-${MOCK_SESSIONS.sessions[0].session_id}`);
        await conv1.click();

        // History messages should appear in the message list
        const messageList = page.getByTestId('chat-message-list');
        await expect(messageList).toBeVisible({ timeout: 5000 });

        // Should contain text from mock history
        await expect(messageList).toContainText(MOCK_HISTORY.messages[0].content, { timeout: 5000 });
    });

    test('new chat button resets to welcome screen', async ({ page }) => {
        await setupAllMocks(page);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Open sidebar and click a conversation first
        await page.getByTestId('chat-menu-button').click();
        await page.getByTestId('sidebar-container').waitFor({ state: 'visible', timeout: 5000 });
        await page.getByTestId(`sidebar-conversation-${MOCK_SESSIONS.sessions[0].session_id}`).click();

        // Wait for messages to appear
        await page.getByTestId('chat-message-list').waitFor({ state: 'visible', timeout: 5000 });

        // Now open sidebar again and click "new chat"
        await page.getByTestId('chat-menu-button').click();
        await page.getByTestId('sidebar-container').waitFor({ state: 'visible', timeout: 5000 });
        const newChatBtn = page.getByTestId('sidebar-new-chat');
        await newChatBtn.click();

        // Welcome section should reappear
        const welcome = page.getByTestId('welcome-section');
        await expect(welcome).toBeVisible({ timeout: 5000 });
    });

    test('sidebar shows no conversations for fresh user', async ({ page }) => {
        await setupFreshUserMocks(page);
        await page.goto('/');
        await page.getByTestId('welcome-section').waitFor({ state: 'visible', timeout: 15000 });

        // Open sidebar
        await page.getByTestId('chat-menu-button').click();
        const sidebar = page.getByTestId('sidebar-container');
        await expect(sidebar).toBeVisible({ timeout: 5000 });

        // No conversation items should exist
        const conversations = page.locator('[data-testid^="sidebar-conversation-"]');
        await expect(conversations).toHaveCount(0);
    });
});
