import { describe, test, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../useSessionStore';

describe('useSessionStore persist', () => {
    beforeEach(() => {
        // Clear localStorage and reset store
        localStorage.clear();
        useSessionStore.setState({
            conversations: [],
            activeId: null,
            userId: '',
            consent: 'true',
            sessionsLoaded: false,
            isLoadingHistory: false,
        });
    });

    // ─── Partialize: userId + consent persist ────────────────────────────────

    test('userId persists to localStorage', () => {
        useSessionStore.getState().setUserId('test_user_123');
        const stored = JSON.parse(localStorage.getItem('scoop-session') || '{}');
        expect(stored.state.userId).toBe('test_user_123');
    });

    test('consent persists to localStorage', () => {
        useSessionStore.getState().handleRejectConsent();
        const stored = JSON.parse(localStorage.getItem('scoop-session') || '{}');
        expect(stored.state.consent).toBe('false');
    });

    test('handleAcceptConsent persists true to localStorage', () => {
        useSessionStore.setState({ consent: null });
        useSessionStore.getState().handleAcceptConsent();
        const stored = JSON.parse(localStorage.getItem('scoop-session') || '{}');
        expect(stored.state.consent).toBe('true');
    });

    // ─── Partialize: conversations do NOT persist ────────────────────────────

    test('conversations do NOT persist (not in partialize)', () => {
        useSessionStore.getState().createConversation();
        const stored = JSON.parse(localStorage.getItem('scoop-session') || '{}');
        expect(stored.state.conversations).toBeUndefined();
    });

    test('activeId does NOT persist (not in partialize)', () => {
        useSessionStore.getState().setActiveId('conv_xyz');
        const stored = JSON.parse(localStorage.getItem('scoop-session') || '{}');
        expect(stored.state.activeId).toBeUndefined();
    });

    // ─── Storage key ─────────────────────────────────────────────────────────

    test('uses correct localStorage key (scoop-session)', () => {
        useSessionStore.getState().setUserId('key_test');
        expect(localStorage.getItem('scoop-session')).not.toBeNull();
    });
});
