import { describe, test, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../useSessionStore';

describe('useSessionStore', () => {
    beforeEach(() => {
        // Reset store to clean state before each test
        useSessionStore.setState({
            conversations: [],
            activeId: null,
            userId: '',
            consent: 'true',
            sessionsLoaded: false,
            isLoadingHistory: false,
        });
    });

    // ─── Conversation CRUD ──────────────────────────────────────────────────

    test('createConversation adds new conversation and sets activeId', () => {
        const id = useSessionStore.getState().createConversation();
        const { conversations, activeId } = useSessionStore.getState();
        expect(conversations).toHaveLength(1);
        expect(activeId).toBe(id);
        expect(conversations[0].id).toBe(id);
        expect(conversations[0].title).toBe('ახალი საუბარი');
        expect(conversations[0].messages).toEqual([]);
    });

    test('createConversation prepends new conversation', () => {
        const id1 = useSessionStore.getState().createConversation();
        const id2 = useSessionStore.getState().createConversation();
        const { conversations } = useSessionStore.getState();
        expect(conversations).toHaveLength(2);
        // Most recent first
        expect(conversations[0].id).toBe(id2);
        expect(conversations[1].id).toBe(id1);
    });

    test('startNewChat resets activeId to null', () => {
        useSessionStore.getState().createConversation();
        expect(useSessionStore.getState().activeId).not.toBeNull();
        useSessionStore.getState().startNewChat();
        expect(useSessionStore.getState().activeId).toBeNull();
    });

    test('setActiveId updates the active conversation', () => {
        useSessionStore.getState().setActiveId('conv_123');
        expect(useSessionStore.getState().activeId).toBe('conv_123');
    });

    test('setConversations replaces the entire list', () => {
        const convs = [
            { id: 'c1', title: 'Test 1', messages: [] },
            { id: 'c2', title: 'Test 2', messages: [] },
        ];
        useSessionStore.getState().setConversations(convs);
        expect(useSessionStore.getState().conversations).toEqual(convs);
    });

    // ─── Message Updates ────────────────────────────────────────────────────

    test('updateConversationMessages updates correct conversation', () => {
        const id = useSessionStore.getState().createConversation();
        const msg = { id: 'm1', role: 'user' as const, content: 'hello' };
        useSessionStore.getState().updateConversationMessages(id, [msg]);
        const conv = useSessionStore.getState().conversations.find((c) => c.id === id);
        expect(conv?.messages).toEqual([msg]);
    });

    test('updateConversationMessages does not affect other conversations', () => {
        const id1 = useSessionStore.getState().createConversation();
        const id2 = useSessionStore.getState().createConversation();
        const msg = { id: 'm1', role: 'user' as const, content: 'hello' };
        useSessionStore.getState().updateConversationMessages(id1, [msg]);
        const conv2 = useSessionStore.getState().conversations.find((c) => c.id === id2);
        expect(conv2?.messages).toEqual([]);
    });

    // ─── Consent ────────────────────────────────────────────────────────────

    test('handleAcceptConsent sets consent to true', () => {
        useSessionStore.setState({ consent: null });
        useSessionStore.getState().handleAcceptConsent();
        expect(useSessionStore.getState().consent).toBe('true');
    });

    test('handleRejectConsent sets consent to false', () => {
        useSessionStore.getState().handleRejectConsent();
        expect(useSessionStore.getState().consent).toBe('false');
    });

    // ─── User Identity ─────────────────────────────────────────────────────

    test('setUserId updates userId', () => {
        useSessionStore.getState().setUserId('test_user_abc');
        expect(useSessionStore.getState().userId).toBe('test_user_abc');
    });

    // ─── Loading States ─────────────────────────────────────────────────────

    test('setSessionsLoaded updates sessionsLoaded flag', () => {
        useSessionStore.getState().setSessionsLoaded(true);
        expect(useSessionStore.getState().sessionsLoaded).toBe(true);
    });

    test('setIsLoadingHistory updates isLoadingHistory flag', () => {
        useSessionStore.getState().setIsLoadingHistory(true);
        expect(useSessionStore.getState().isLoadingHistory).toBe(true);
    });

    // ─── Utility ────────────────────────────────────────────────────────────

    test('generateMessageId returns a string', () => {
        const id = useSessionStore.getState().generateMessageId();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    test('generateMessageId returns unique values', () => {
        const id1 = useSessionStore.getState().generateMessageId();
        const id2 = useSessionStore.getState().generateMessageId();
        expect(id1).not.toBe(id2);
    });
});
