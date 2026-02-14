import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Conversation, Message } from '@/types/api';
import { apiFetch, enrollApiKey } from '../lib/apiClient';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

// Legacy localStorage keys (preserved for backward compatibility)
const LS_KEY_USER_ID = 'scoop_user_id';
const LS_KEY_CONSENT = 'scoop_history_consent';

// ─────────────────────────────────────────────────────────────────────────────
// Generate unique ID (mirrors useChatSession.ts pattern)
// ─────────────────────────────────────────────────────────────────────────────
const generateId = () => Math.random().toString(36).substring(2, 15);

// ─────────────────────────────────────────────────────────────────────────────
// State Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionState {
    // Core state
    conversations: Conversation[];
    activeId: string | null;
    userId: string;
    consent: string | null;

    // Initialization gate (Incognito race condition fix)
    isSessionReady: boolean;

    // Loading states
    sessionsLoaded: boolean;
    isLoadingHistory: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionActions {
    // Conversation CRUD
    createConversation: () => string;
    startNewChat: () => void;
    updateConversationMessages: (id: string, messages: Message[]) => void;
    setConversations: (conversations: Conversation[]) => void;
    setActiveId: (id: string | null) => void;

    // Granular updates (for SSE streaming)
    updateMessage: (convId: string, msgId: string, patch: Partial<Message>) => void;
    updateConversation: (convId: string, patch: Partial<Conversation>) => void;

    // User identity
    setUserId: (userId: string) => void;

    // Consent (with legacy localStorage side-effects)
    handleAcceptConsent: () => void;
    handleRejectConsent: () => void;

    // Async operations (migrated from useChatSession)
    initializeSession: () => Promise<void>;
    loadSessions: () => Promise<void>;
    loadSessionHistory: (sessionId: string) => Promise<void>;
    handleDeleteData: () => Promise<void>;

    // Loading state setters
    setSessionsLoaded: (loaded: boolean) => void;
    setIsLoadingHistory: (loading: boolean) => void;

    // Utility
    generateMessageId: () => string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useSessionStore = create<SessionState & SessionActions>()(
    devtools(
        persist(
            (set, get) => ({
                // ── Initial State ──────────────────────────────────────────────────
                conversations: [],
                activeId: null,
                userId: '',
                consent: 'true',
                isSessionReady: false,  // Gate for loadSessions (Incognito race condition fix)
                sessionsLoaded: false,
                isLoadingHistory: false,

                // ── Conversation CRUD ──────────────────────────────────────────────
                createConversation: () => {
                    const newId = generateId();
                    const newConv: Conversation = {
                        id: newId,
                        title: 'ახალი საუბარი',
                        messages: [],
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };
                    set(
                        (state) => ({
                            conversations: [newConv, ...state.conversations],
                            activeId: newId,
                        }),
                        false,
                        'createConversation'
                    );
                    return newId;
                },

                startNewChat: () => {
                    set({ activeId: null }, false, 'startNewChat');
                },

                updateConversationMessages: (id, messages) => {
                    set(
                        (state) => ({
                            conversations: state.conversations.map((conv) =>
                                conv.id === id ? { ...conv, messages } : conv
                            ),
                        }),
                        false,
                        'updateConversationMessages'
                    );
                },

                setConversations: (conversations) => {
                    set({ conversations }, false, 'setConversations');
                },

                setActiveId: (id) => {
                    set({ activeId: id }, false, 'setActiveId');
                },

                // ── Granular Updates (SSE Streaming) ──────────────────────────────
                updateMessage: (convId, msgId, patch) => {
                    set(
                        (state) => ({
                            conversations: state.conversations.map((conv) =>
                                conv.id === convId
                                    ? {
                                        ...conv,
                                        messages: conv.messages.map((msg) =>
                                            msg.id === msgId
                                                ? { ...msg, ...patch }
                                                : msg
                                        ),
                                    }
                                    : conv
                            ),
                        }),
                        false,
                        'updateMessage'
                    );
                },

                updateConversation: (convId, patch) => {
                    set(
                        (state) => ({
                            conversations: state.conversations.map((conv) =>
                                conv.id === convId
                                    ? { ...conv, ...patch }
                                    : conv
                            ),
                        }),
                        false,
                        'updateConversation'
                    );
                },

                // ── User Identity ──────────────────────────────────────────────────
                setUserId: (userId) => {
                    set({ userId }, false, 'setUserId');
                },

                // ── Consent (with legacy localStorage writes) ─────────────────────
                handleAcceptConsent: () => {
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(LS_KEY_CONSENT, 'true');
                    }
                    set({ consent: 'true' }, false, 'handleAcceptConsent');
                },

                handleRejectConsent: () => {
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(LS_KEY_CONSENT, 'false');
                    }
                    set({ consent: 'false' }, false, 'handleRejectConsent');
                },

                // ── Async: Session Initialization ─────────────────────────────────
                initializeSession: async () => {
                    if (typeof window === 'undefined') return;

                    // Rehydrate persisted state (userId, consent, activeId) from localStorage
                    useSessionStore.persist.rehydrate();

                    // Read consent from legacy key (default: save history)
                    let hasConsent = localStorage.getItem(LS_KEY_CONSENT);
                    if (!hasConsent) {
                        localStorage.setItem(LS_KEY_CONSENT, 'true');
                        hasConsent = 'true';
                    }

                    // Read or generate userId
                    const stored = localStorage.getItem(LS_KEY_USER_ID);
                    let currentUserId: string;
                    if (stored) {
                        currentUserId = stored;
                    } else {
                        currentUserId = `widget_${Math.random().toString(36).substring(2, 15)}`;
                        localStorage.setItem(LS_KEY_USER_ID, currentUserId);
                    }

                    set(
                        { userId: currentUserId, consent: hasConsent },
                        false,
                        'initializeSession'
                    );

                    // Await API key enrollment — blocks isSessionReady until complete
                    try {
                        await enrollApiKey(currentUserId, BACKEND_URL);
                    } catch (err) {
                        console.warn('[Scoop] enrollApiKey failed during init:', err);
                    } finally {
                        // ALWAYS signal ready — even if enrollment fails (graceful degradation)
                        set({ isSessionReady: true }, false, 'initializeSession/ready');
                    }
                },

                // ── Async: Load Session List ──────────────────────────────────────
                loadSessions: async () => {
                    const { consent, userId, sessionsLoaded } = get();

                    // Guard: Only load if consented, has userId, and not already loaded
                    if (consent !== 'true') {
                        if (consent !== null) {
                            console.log('[Scoop] Skipping session load - user has not consented to history');
                        }
                        return;
                    }
                    if (!userId || sessionsLoaded || !get().isSessionReady) return;

                    try {
                        const res = await apiFetch(`${BACKEND_URL}/api/v1/sessions/${userId}`);
                        if (!res.ok) return;
                        const data = await res.json();

                        if (data.sessions && data.sessions.length > 0) {
                            const loadedConvs: Conversation[] = data.sessions.map(
                                (s: {
                                    session_id: string;
                                    title: string;
                                    created_at?: string;
                                    updated_at?: string;
                                }) => ({
                                    id: s.session_id,
                                    title: s.title || 'ახალი საუბარი',
                                    messages: [],
                                    created_at: s.created_at,
                                    updated_at: s.updated_at,
                                })
                            );
                            set({ conversations: loadedConvs }, false, 'loadSessions');

                            // Validate persisted activeId still exists in loaded sessions
                            const { activeId } = get();
                            if (activeId && !loadedConvs.find(c => c.id === activeId)) {
                                set({ activeId: null }, false, 'clearStaleActiveId');
                            }
                        } else {
                            // No sessions exist — clear any stale activeId
                            const { activeId } = get();
                            if (activeId) {
                                set({ activeId: null }, false, 'clearStaleActiveId');
                            }
                        }
                        set({ sessionsLoaded: true }, false, 'loadSessions/done');
                    } catch (error) {
                        console.error('[Scoop] Failed to load sessions:', error);
                        set({ sessionsLoaded: true }, false, 'loadSessions/error');
                    }
                },

                // ── Async: Load Session History ───────────────────────────────────
                loadSessionHistory: async (sessionId) => {
                    set({ isLoadingHistory: true }, false, 'loadSessionHistory/start');
                    try {
                        const res = await apiFetch(
                            `${BACKEND_URL}/api/v1/session/${sessionId}/history`
                        );
                        if (!res.ok) return;
                        const data = await res.json();

                        if (data.messages) {
                            const messages: Message[] = data.messages.map(
                                (m: { role: string; content: string }, idx: number) => ({
                                    id: `${sessionId}_${idx}`,
                                    role: m.role as 'user' | 'assistant',
                                    content: m.content,
                                })
                            );
                            set(
                                (state) => ({
                                    conversations: state.conversations.map((conv) =>
                                        conv.id === sessionId
                                            ? { ...conv, messages }
                                            : conv
                                    ),
                                }),
                                false,
                                'loadSessionHistory/loaded'
                            );
                        }
                    } catch (error) {
                        console.error('[Scoop] Failed to load session history:', error);
                    } finally {
                        set({ isLoadingHistory: false }, false, 'loadSessionHistory/done');
                    }
                },

                // ── Async: Delete User Data ───────────────────────────────────────
                handleDeleteData: async () => {
                    const { userId } = get();
                    if (!userId) return;

                    try {
                        const res = await apiFetch(
                            `${BACKEND_URL}/api/v1/user/${userId}/data`,
                            { method: 'DELETE' }
                        );

                        if (res.ok && typeof window !== 'undefined') {
                            // Clear legacy localStorage keys
                            localStorage.removeItem(LS_KEY_USER_ID);
                            localStorage.removeItem(LS_KEY_CONSENT);

                            // Generate new userId for next session
                            const newId = `widget_${Math.random().toString(36).substring(2, 15)}`;
                            localStorage.setItem(LS_KEY_USER_ID, newId);

                            // Force full page reload to clear all state
                            window.location.reload();
                        }
                    } catch (error) {
                        console.error('[Scoop] Failed to delete data:', error);
                    }
                },

                // ── Loading States ─────────────────────────────────────────────────
                setSessionsLoaded: (loaded) => {
                    set({ sessionsLoaded: loaded }, false, 'setSessionsLoaded');
                },

                setIsLoadingHistory: (loading) => {
                    set({ isLoadingHistory: loading }, false, 'setIsLoadingHistory');
                },

                // ── Utility ────────────────────────────────────────────────────────
                generateMessageId: generateId,
            }),
            {
                name: 'scoop-session',
                // Persist userId, consent, and activeId — NOT conversations
                partialize: (state) => ({
                    userId: state.userId,
                    consent: state.consent,
                    activeId: state.activeId,
                }),
                skipHydration: true,
            }
        ),
        { name: 'SessionStore' }
    )
);
