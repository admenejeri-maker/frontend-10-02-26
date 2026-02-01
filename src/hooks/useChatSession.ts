'use client';

import { useState, useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import type { QuickReply, Message, Conversation } from '@/types/api';

// Re-export types for backward compatibility
export type { QuickReply, Message, Conversation };

// Backend API URL - Production Cloud Run
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// ─────────────────────────────────────────────────────────────────────────────
// Hook Return Type
// ─────────────────────────────────────────────────────────────────────────────

export interface UseChatSessionReturn {
    // Core state
    conversations: Conversation[];
    setConversations: Dispatch<SetStateAction<Conversation[]>>;
    activeId: string | null;
    setActiveId: Dispatch<SetStateAction<string | null>>;
    activeConversation: Conversation | undefined;
    userId: string;

    // Loading states
    isLoadingHistory: boolean;

    // Consent modal
    showConsentModal: boolean;
    handleAcceptConsent: () => void;
    handleRejectConsent: () => void;

    // Delete confirmation
    showDeleteConfirm: boolean;
    setShowDeleteConfirm: Dispatch<SetStateAction<boolean>>;
    isDeleting: boolean;
    handleDeleteData: () => Promise<void>;

    // Session CRUD
    startNewChat: () => void;
    createNewConversation: () => string;
    loadSessionHistory: (sessionId: string) => Promise<void>;

    // Utility
    generateMessageId: () => string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useChatSession(): UseChatSessionReturn {
    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [userId, setUserId] = useState<string>('');
    const [sessionsLoaded, setSessionsLoaded] = useState(false);
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Derived state
    const activeConversation = conversations.find((c) => c.id === activeId);

    // ─────────────────────────────────────────────────────────────────────────
    // Effects
    // ─────────────────────────────────────────────────────────────────────────

    // Initialize persistent userId on mount (client-side only to avoid hydration mismatch)
    useEffect(() => {
        // Check consent first
        const hasConsent = localStorage.getItem('scoop_history_consent');
        if (!hasConsent) {
            setShowConsentModal(true);
        }

        const stored = localStorage.getItem('scoop_user_id');
        if (stored) {
            setUserId(stored);
        } else {
            const newId = `widget_${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('scoop_user_id', newId);
            setUserId(newId);
        }
    }, []);

    // Load sessions from backend on mount
    useEffect(() => {
        if (!userId || sessionsLoaded) return;

        const loadSessions = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/sessions/${userId}`);
                if (!res.ok) return;
                const data = await res.json();

                if (data.sessions && data.sessions.length > 0) {
                    // Convert backend sessions to frontend Conversation format
                    const loadedConvs: Conversation[] = data.sessions.map((s: {
                        session_id: string;
                        title: string;
                        created_at?: string;
                        updated_at?: string;
                    }) => ({
                        id: s.session_id,
                        title: s.title || 'ახალი საუბარი',
                        messages: [], // Will be loaded when selected
                        created_at: s.created_at,
                        updated_at: s.updated_at,
                    }));
                    setConversations(loadedConvs);
                }
                setSessionsLoaded(true);
            } catch (error) {
                console.error('[Scoop] Failed to load sessions:', error);
                setSessionsLoaded(true);
            }
        };

        loadSessions();
    }, [userId, sessionsLoaded]);

    // ─────────────────────────────────────────────────────────────────────────
    // Consent Handlers
    // ─────────────────────────────────────────────────────────────────────────

    const handleAcceptConsent = useCallback(() => {
        localStorage.setItem('scoop_history_consent', 'true');
        setShowConsentModal(false);
    }, []);

    const handleRejectConsent = useCallback(() => {
        localStorage.setItem('scoop_history_consent', 'false');
        setShowConsentModal(false);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Delete User Data
    // ─────────────────────────────────────────────────────────────────────────

    const handleDeleteData = useCallback(async () => {
        if (!userId) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`${BACKEND_URL}/user/${userId}/data`, {
                method: 'DELETE',
            });

            if (res.ok) {
                // Clear localStorage
                localStorage.removeItem('scoop_user_id');
                localStorage.removeItem('scoop_history_consent');

                // Generate new userId for next session
                const newId = `widget_${Math.random().toString(36).substring(2, 15)}`;
                localStorage.setItem('scoop_user_id', newId);

                // Force full page reload to clear:
                // 1. Frontend React state
                // 2. Backend Gemini session cache (function call history)
                // 3. Any in-memory user profile data
                window.location.reload();
            }
        } catch (error) {
            console.error('[Scoop] Failed to delete data:', error);
        } finally {
            setIsDeleting(false);
        }
    }, [userId]);

    // ─────────────────────────────────────────────────────────────────────────
    // Session History Loading
    // ─────────────────────────────────────────────────────────────────────────

    const loadSessionHistory = useCallback(async (sessionId: string) => {
        setIsLoadingHistory(true);
        try {
            const res = await fetch(`${BACKEND_URL}/session/${sessionId}/history`);
            if (!res.ok) return;
            const data = await res.json();

            if (data.messages) {
                const messages: Message[] = data.messages.map((m: { role: string; content: string }, idx: number) => ({
                    id: `${sessionId}_${idx}`,
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                }));

                // Update the conversation with loaded messages
                setConversations(prev => prev.map(conv =>
                    conv.id === sessionId
                        ? { ...conv, messages }
                        : conv
                ));
            }
        } catch (error) {
            console.error('[Scoop] Failed to load session history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Session CRUD
    // ─────────────────────────────────────────────────────────────────────────

    // Create new conversation - just reset to empty screen
    const startNewChat = useCallback(() => {
        setActiveId(null);
    }, []);

    // Actually create conversation when first message is sent
    const createNewConversation = useCallback(() => {
        const newId = generateId();
        const newConv: Conversation = {
            id: newId,
            title: 'ახალი საუბარი',
            messages: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveId(newId);
        return newId;
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Return Hook API
    // ─────────────────────────────────────────────────────────────────────────

    return {
        // Core state
        conversations,
        setConversations,
        activeId,
        setActiveId,
        activeConversation,
        userId,

        // Loading states
        isLoadingHistory,

        // Consent modal
        showConsentModal,
        handleAcceptConsent,
        handleRejectConsent,

        // Delete confirmation
        showDeleteConfirm,
        setShowDeleteConfirm,
        isDeleting,
        handleDeleteData,

        // Session CRUD
        startNewChat,
        createNewConversation,
        loadSessionHistory,

        // Utility
        generateMessageId: generateId,
    };
}
