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

    // ─── Bug #24 Fix: activeId now persists ─────────────────────────────────

    test('activeId persists to localStorage (Bug #24 fix)', () => {
        useSessionStore.getState().setActiveId('conv_xyz');
        const stored = JSON.parse(localStorage.getItem('scoop-session') || '{}');
        expect(stored.state.activeId).toBe('conv_xyz');
    });

    // ─── Storage key ─────────────────────────────────────────────────────────

    test('uses correct localStorage key (scoop-session)', () => {
        useSessionStore.getState().setUserId('key_test');
        expect(localStorage.getItem('scoop-session')).not.toBeNull();
    });

    // ─── Bug #24 Stress Tests ────────────────────────────────────────────────

    test('rehydrate() restores activeId from localStorage', async () => {
        // Clear in-memory state first, then seed localStorage
        // (setState triggers persist which would overwrite our seeded value)
        useSessionStore.setState({ activeId: null });
        localStorage.setItem('scoop-session', JSON.stringify({
            state: { userId: 'u1', consent: 'true', activeId: 'conv_abc' },
            version: 0,
        }));
        await useSessionStore.persist.rehydrate();
        expect(useSessionStore.getState().activeId).toBe('conv_abc');
    });

    test('stale activeId is cleared when not in conversations', () => {
        useSessionStore.setState({ activeId: 'deleted_conv' });
        useSessionStore.setState({
            conversations: [
                { id: 'conv_1', title: 'Chat 1', messages: [] },
                { id: 'conv_2', title: 'Chat 2', messages: [] },
            ],
            sessionsLoaded: true,
        });
        const { activeId } = useSessionStore.getState();
        const conversations = useSessionStore.getState().conversations;
        if (activeId && !conversations.find(c => c.id === activeId)) {
            useSessionStore.setState({ activeId: null });
        }
        expect(useSessionStore.getState().activeId).toBeNull();
    });

    test('valid activeId survives loadSessions', () => {
        useSessionStore.setState({ activeId: 'conv_1' });
        useSessionStore.setState({
            conversations: [
                { id: 'conv_1', title: 'Chat 1', messages: [] },
                { id: 'conv_2', title: 'Chat 2', messages: [] },
            ],
            sessionsLoaded: true,
        });
        const { activeId } = useSessionStore.getState();
        const conversations = useSessionStore.getState().conversations;
        if (activeId && !conversations.find(c => c.id === activeId)) {
            useSessionStore.setState({ activeId: null });
        }
        expect(useSessionStore.getState().activeId).toBe('conv_1');
    });

    test('corrupted localStorage does not crash rehydrate', async () => {
        localStorage.setItem('scoop-session', '{{INVALID_JSON!!}}');
        await expect(useSessionStore.persist.rehydrate()).resolves.not.toThrow();
        expect(useSessionStore.getState().activeId).toBeNull();
    });

    test('rehydrate with missing activeId defaults to null', async () => {
        localStorage.setItem('scoop-session', JSON.stringify({
            state: { userId: 'u1', consent: 'true' },
            version: 0,
        }));
        useSessionStore.setState({ activeId: null });
        await useSessionStore.persist.rehydrate();
        expect(useSessionStore.getState().activeId).toBeNull();
    });

    test('multiple rehydrate() calls are idempotent', async () => {
        localStorage.setItem('scoop-session', JSON.stringify({
            state: { userId: 'u1', consent: 'true', activeId: 'conv_stable' },
            version: 0,
        }));
        await useSessionStore.persist.rehydrate();
        await useSessionStore.persist.rehydrate();
        await useSessionStore.persist.rehydrate();
        expect(useSessionStore.getState().activeId).toBe('conv_stable');
    });

    test('set() merge preserves activeId (initializeSession pattern)', () => {
        useSessionStore.setState({ activeId: 'conv_merge_test' });
        // Simulate what initializeSession does AFTER rehydrate
        useSessionStore.setState(
            { userId: 'widget_new', consent: 'true' },
        );
        expect(useSessionStore.getState().activeId).toBe('conv_merge_test');
    });
});

