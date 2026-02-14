'use client';

import dynamic from 'next/dynamic';

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Settings, Menu, AlertTriangle, Square, ArrowUp } from 'lucide-react';
// EmptyScreen removed - replaced with Gemini-style WelcomeSection + QuickActionPills
import { ThinkingStepsLoader } from './thinking-steps-loader';
import { VoiceInput } from './VoiceInput';
import { ScoopLogo } from './scoop-logo';

// Dynamic imports for code splitting (P3.6 - Bundle Optimization)
const Sidebar = dynamic(() => import('./sidebar').then(mod => ({ default: mod.Sidebar })), {
    ssr: false,
    loading: () => <div className="sidebar-skeleton" aria-hidden="true" />,
});

const ChatResponse = dynamic(
    () => import('./chat-response').then(mod => ({ default: mod.ChatResponse })),
    {
        loading: () => <div className="chat-response-skeleton" aria-hidden="true" />,
    }
);
import {
    useSSEStream,
    type SSEQuickReply,
} from '../hooks';
import type { Message, Conversation, QuickReply } from '@/types/api';
import { useSessionStore } from '../stores/useSessionStore';
import { useUIStore } from '../stores/useUIStore';

// Backend API URL - Production Cloud Run
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

// Gemini-style Welcome Section (centered layout)
function WelcomeSection() {
    return (
        <div className="gemini-welcome" data-testid="welcome-section">
            <div className="flex items-center justify-center gap-2 mb-3">
                <ScoopLogo className="w-8 h-8" />
            </div>
            <h1 className="gemini-welcome-title">გამარჯობა!</h1>
            <p className="gemini-welcome-subtitle">რით შემიძლია დაგეხმაროთ დღეს?</p>
        </div>
    );
}

// Gemini-style Quick Action Pills
function QuickActionPills({ onSelect }: { onSelect: (text: string) => void }) {
    const pills = [
        { text: 'პროტეინი' },
        { text: 'კრეატინი' },
        { text: 'ვიტამინები' },
        { text: 'ჯანმრთელობა' },
        { text: 'წონა' },
    ];

    return (
        <div className="quick-pills-container">
            {pills.map((pill) => (
                <button
                    key={pill.text}
                    onClick={() => onSelect(pill.text)}
                    className="quick-pill"
                    data-testid={`quick-pill-${pill.text}`}
                >
                    <span>{pill.text}</span>
                </button>
            ))}
        </div>
    );
}

// Fallback Message Bubble (for older history or simple texts)
function MessageBubble({ message }: { message: Message }) {
    if (message.role === 'user') {
        return (
            <div className="flex justify-end mb-4">
                <div className="px-5 py-3 rounded-[22px] rounded-br-sm max-w-[75%] shadow-sm" style={{ backgroundColor: '#0A7364', color: 'white' }}>
                    <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
            </div>
        );
    }
    return (
        <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-[#f0f4f9]">
                <ScoopLogo className="w-4 h-4" />
            </div>
            <div className="flex-1 max-w-full">
                <div className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
            </div>
        </div>
    );
}

// Main Chat Component
export default function Chat() {
    // ── Zustand: Session Store (granular selectors to minimize re-renders) ──
    const conversations = useSessionStore((s) => s.conversations);
    const activeId = useSessionStore((s) => s.activeId);
    const userId = useSessionStore((s) => s.userId);
    const consent = useSessionStore((s) => s.consent);
    const isLoadingHistory = useSessionStore((s) => s.isLoadingHistory);

    // Actions (stable references — never cause re-renders)
    const setActiveId = useSessionStore((s) => s.setActiveId);
    const createConversation = useSessionStore((s) => s.createConversation);
    const startNewChatAction = useSessionStore((s) => s.startNewChat);
    const generateMessageId = useSessionStore((s) => s.generateMessageId);
    const updateMessage = useSessionStore((s) => s.updateMessage);
    const updateConversation = useSessionStore((s) => s.updateConversation);
    const updateConversationMessages = useSessionStore((s) => s.updateConversationMessages);
    const setConversations = useSessionStore((s) => s.setConversations);
    const initializeSession = useSessionStore((s) => s.initializeSession);
    const loadSessions = useSessionStore((s) => s.loadSessions);
    const loadSessionHistory = useSessionStore((s) => s.loadSessionHistory);

    // ── Zustand: UI Store ──
    const sidebarOpen = useUIStore((s) => s.sidebarOpen);
    const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
    const showConsentModal = useUIStore((s) => s.showConsentModal);
    const setShowConsentModal = useUIStore((s) => s.setShowConsentModal);
    const showDeleteConfirm = useUIStore((s) => s.showDeleteConfirm);
    const openDeleteConfirm = useUIStore((s) => s.openDeleteConfirm);
    const closeDeleteConfirm = useUIStore((s) => s.closeDeleteConfirm);
    const isDeleting = useUIStore((s) => s.isDeleting);
    const setIsDeleting = useUIStore((s) => s.setIsDeleting);

    // Consent handlers from session store (write to localStorage + Zustand)
    const handleAcceptConsent = useSessionStore((s) => s.handleAcceptConsent);
    const handleRejectConsent = useSessionStore((s) => s.handleRejectConsent);
    const handleDeleteDataAction = useSessionStore((s) => s.handleDeleteData);

    // Derived state
    const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
    const activeMessagesCount = activeConversation?.messages?.length ?? -1;

    // ── Local UI state (component-level, not shared) ──
    const [input, setInput] = useState('');
    const [showContinueButton, setShowContinueButton] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastUserMessageRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const historyLoadAttempted = useRef<string | null>(null);

    // SSE Stream hook for message streaming
    const { streamMessage, abortStream } = useSSEStream();

    // Auto-resize textarea when input changes (covers both typing and voice transcription)
    useEffect(() => {
        const el = textareaRef.current;
        if (el) {
            el.style.height = '44px';
            el.style.height = Math.min(el.scrollHeight, 150) + 'px';
        }
    }, [input]);

    // ── Initialization: hydrate session from localStorage on mount ──
    useEffect(() => {
        initializeSession();
    }, [initializeSession]);

    // ── Load sessions when userId + consent are ready ──
    useEffect(() => {
        if (consent === 'true' && userId) {
            loadSessions();
        }
    }, [consent, userId, loadSessions]);

    // ── Auto-load chat history when activeId is set but messages are empty ──
    // Handles page refresh: activeId rehydrated → loadSessions() gives messages: []
    // → we fetch actual messages from API. useRef prevents infinite loops.
    useEffect(() => {
        if (
            activeId &&
            activeId !== historyLoadAttempted.current &&
            !isLoadingHistory &&
            activeMessagesCount === 0
        ) {
            historyLoadAttempted.current = activeId;
            loadSessionHistory(activeId);
        }
    }, [activeId, activeMessagesCount, isLoadingHistory, loadSessionHistory]);

    // ── Show consent modal if consent is null (first visit) ──
    useEffect(() => {
        if (consent === null) {
            setShowConsentModal(true);
        }
    }, [consent, setShowConsentModal]);

    // Auto-scroll: scroll მხოლოდ ერთხელ loading დაწყებისას
    useEffect(() => {
        // Scroll მხოლოდ user message-მდე, რომ პასუხი მის ქვემოთ დაიწყოს
        // არ scroll-ავთ response streaming-ის დროს
        if (isLoading && lastUserMessageRef.current) {
            lastUserMessageRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }, [isLoading]); // მხოლოდ isLoading, არა messages!

    // Consent accept handler: write to stores + close modal
    const onAcceptConsent = useCallback(() => {
        handleAcceptConsent();
        setShowConsentModal(false);
    }, [handleAcceptConsent, setShowConsentModal]);

    // Consent reject handler: write to stores + close modal
    const onRejectConsent = useCallback(() => {
        handleRejectConsent();
        setShowConsentModal(false);
    }, [handleRejectConsent, setShowConsentModal]);

    // Delete data handler: delegate to store action with UI state coordination
    const handleDeleteData = useCallback(async () => {
        setIsDeleting(true);
        try {
            await handleDeleteDataAction();
        } finally {
            setIsDeleting(false);
            closeDeleteConfirm();
        }
    }, [handleDeleteDataAction, setIsDeleting, closeDeleteConfirm]);

    // Wrapper for startNewChat to also clear local UI state
    const startNewChat = useCallback(() => {
        startNewChatAction();
        setInput('');
        setSidebarOpen(false);
    }, [startNewChatAction, setSidebarOpen]);

    // Send message using SSE streaming endpoint
    const sendMessage = useCallback(
        async (text: string) => {
            if (!text.trim() || isLoading) return;

            let convId = activeId;
            if (!convId) {
                convId = createConversation();
            }

            setInput('');
            setIsLoading(true);
            setThinkingSteps([]); // Reset thinking steps for new message
            // Reset textarea height
            const textarea = document.querySelector('textarea');
            if (textarea) textarea.style.height = '44px';

            const userMessage: Message = {
                id: generateMessageId(),
                role: 'user',
                content: text.trim(),
            };

            // Add user message immediately
            // We read current conversations from the store to update
            const currentConvs = useSessionStore.getState().conversations;
            setConversations(
                currentConvs.map((conv) =>
                    conv.id === convId
                        ? {
                            ...conv,
                            title: conv.messages.length === 0 ? text.slice(0, 25) + '...' : conv.title,
                            messages: [...conv.messages, userMessage],
                        }
                        : conv
                )
            );

            // Add empty assistant message that we'll update progressively
            const assistantId = generateMessageId();
            const updatedConvs = useSessionStore.getState().conversations;
            setConversations(
                updatedConvs.map((conv) =>
                    conv.id === convId
                        ? {
                            ...conv,
                            messages: [...conv.messages, { id: assistantId, role: 'assistant' as const, content: '' }],
                        }
                        : conv
                )
            );

            try {
                // Get backendSessionId from active conversation if available
                const activeConv = useSessionStore.getState().conversations.find(c => c.id === convId);
                const sessionIdToUse = activeConv?.backendSessionId || convId;

                // DEBUG: Log session persistence for amnesia debugging
                console.log('[DEBUG SESSION]', {
                    action: 'sendMessageStream',
                    convId,
                    backendSessionId: activeConv?.backendSessionId,
                    sessionIdToUse,
                    activeId,
                    userId,
                    isNewConversation: convId !== activeId,
                    messagePreview: text.slice(0, 50),
                });

                // Use the SSE stream hook for parsing
                let assistantContent = '';
                let accumulatedQuickReplies: QuickReply[] = [];

                await streamMessage({
                    url: `${BACKEND_URL}/api/v1/chat/stream`,
                    body: {
                        user_id: userId,
                        message: text,
                        session_id: sessionIdToUse,
                        save_history: consent === 'true',
                    },
                    handlers: {
                        onText: (content: string) => {
                            assistantContent += content;
                            updateMessage(convId!, assistantId, { content: assistantContent });
                        },
                        onProducts: (content: string) => {
                            assistantContent += '\n\n' + content;
                            updateMessage(convId!, assistantId, { content: assistantContent });
                        },
                        onTip: (tipText: string) => {
                            const tipWithTags = `\n\n[TIP]\n${tipText}\n[/TIP]`;
                            assistantContent += tipWithTags;
                            updateMessage(convId!, assistantId, { content: assistantContent });
                        },
                        onThinking: (content: string) => {
                            setThinkingSteps(prev => [...prev, content]);
                        },
                        onQuickReplies: (replies: SSEQuickReply[]) => {
                            accumulatedQuickReplies = replies.map((qr) => ({
                                title: qr.title,
                                payload: qr.payload,
                            }));
                        },
                        onDone: (sessionId?: string) => {
                            if (sessionId) {
                                updateConversation(convId!, { backendSessionId: sessionId });
                            }
                        },
                        onError: (message: string) => {
                            console.error('[Scoop] Stream error:', message);
                            assistantContent = message || 'დაფიქსირდა შეცდომა. გთხოვთ სცადოთ თავიდან.';
                            updateMessage(convId!, assistantId, { content: assistantContent });
                        },
                        onTruncationWarning: (finishReason: string) => {
                            console.warn('[Scoop] Response truncated:', finishReason);
                            setShowContinueButton(true);
                        },
                        onReconnecting: (attempt: number, maxAttempts: number) => {
                            console.warn(`[Scoop] Reconnecting... attempt ${attempt}/${maxAttempts}`);
                            assistantContent = `⏳ კავშირი წყდება... ხელახლა ცდა (${attempt}/${maxAttempts})`;
                            updateMessage(convId!, assistantId, { content: assistantContent });
                        },
                    },
                });

                // Final update with quick replies
                if (accumulatedQuickReplies.length > 0) {
                    updateMessage(convId!, assistantId, { quickReplies: accumulatedQuickReplies });
                }

            } catch (error) {
                console.error('[Scoop] Stream error:', error);
                // Update assistant message with error notice
                updateMessage(convId!, assistantId, { content: '⚠️ კავშირის შეცდომა. გთხოვთ სცადოთ თავიდან.' });
            } finally {
                setIsLoading(false);
            }
        },
        [activeId, createConversation, isLoading, userId, streamMessage, consent, generateMessageId, updateMessage, updateConversation, setConversations]
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    // Render logic to support history + ChatResponse
    const renderChatHistory = () => {
        // Show skeleton while loading history to prevent layout shift
        if (isLoadingHistory) {
            return (
                <div className="chat-content-wrapper space-y-6 animate-pulse">
                    {/* Skeleton for user message */}
                    <div className="flex justify-end">
                        <div className="bg-gray-200 h-10 w-48 rounded-xl" />
                    </div>
                    {/* Skeleton for assistant message - uses stable grid */}
                    <div className="ai-response-grid">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex-shrink-0" />
                        <div className="ai-response-content space-y-2">
                            <div className="bg-gray-200 h-4 w-full rounded" />
                            <div className="bg-gray-200 h-4 w-3/4 rounded" />
                            <div className="bg-gray-200 h-4 w-1/2 rounded" />
                        </div>
                    </div>
                </div>
            );
        }

        if (!activeConversation || activeConversation.messages.length === 0) {
            // Return null - empty state is now handled by Gemini-style centered layout
            return null;
        }

        const items = [];
        const msgs = activeConversation.messages;

        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i];
            const isLastUserMessage = msg.role === 'user' && i === msgs.length - 1 ||
                (msg.role === 'user' && msgs[i + 1]?.role === 'assistant' && i + 1 === msgs.length - 1);

            if (msg.role === 'user') {
                const nextMsg = msgs[i + 1];

                // 1. User followed by Assistant with CONTENT -> Render ChatResponse (Pair)
                if (nextMsg && nextMsg.role === 'assistant' && nextMsg.content && nextMsg.content.trim() !== '') {
                    // Convert backend quick_replies to ChatResponse format
                    // Pass undefined if empty so ChatResponse uses defaults
                    const qrList = nextMsg.quickReplies ?? [];
                    const dynamicQuickReplies = qrList.length > 0
                        ? qrList.map((qr, idx) => ({
                            id: `qr-${idx}`,
                            text: qr.title,
                            icon: null,
                        }))
                        : undefined; // Let ChatResponse use defaults

                    // Check if this is the last pair - add ref for scroll
                    const isLastPair = i + 1 === msgs.length - 1;

                    items.push(
                        <div key={msg.id} ref={isLastPair ? lastUserMessageRef : undefined} className="w-full">
                            <ChatResponse
                                userMessage={msg.content}
                                assistantContent={nextMsg.content}
                                quickReplies={isLastPair ? dynamicQuickReplies : []}
                                onQuickReplyClick={(id, text) => sendMessage(text)}
                                isStreaming={isLoading && isLastPair}
                            />
                        </div>
                    );
                    i++; // Skip assistant message as it's consumed by ChatResponse
                }
                // 2. User is TRULY the last or second-to-last message & Loading -> Render ThinkingStepsLoader
                // Only show loader for the very last user message (prevents duplicate loaders)
                else if (isLoading && (
                    i === msgs.length - 1 || // User is literally the last message
                    (i === msgs.length - 2 && nextMsg && nextMsg.role === 'assistant' && !nextMsg.content?.trim()) // User followed by empty assistant
                )) {
                    items.push(
                        <div key={`loader-${msg.id}`} ref={lastUserMessageRef} className="w-full">
                            <ThinkingStepsLoader userMessage={msg.content} realThoughts={thinkingSteps} />
                        </div>
                    );
                    // Skip the empty assistant message if it exists
                    if (nextMsg && nextMsg.role === 'assistant') {
                        i++;
                    }
                }
                // 3. User is last message & NOT Loading (maybe error or waiting) -> Render Bubble
                else {
                    items.push(
                        <MessageBubble key={msg.id} message={msg} />
                    );
                }
            } else if (msg.role === 'assistant') {
                // If we hit an assistant message that wasn't skipped (orphan?), render bubble
                items.push(<MessageBubble key={msg.id} message={msg} />);
            }
        }

        return (
            <div className="chat-content-wrapper space-y-8" data-testid="chat-message-list">
                {items}
                {showContinueButton && (
                    <div className="flex justify-center">
                        <button
                            onClick={() => {
                                setShowContinueButton(false);
                                // Use neutral prompt to avoid re-triggering SAFETY on same topic
                                sendMessage("გთხოვთ გააგრძელოთ წინა პასუხი.");
                            }}
                            className="px-4 py-2 rounded-lg text-white mt-2 hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: '#0A7364' }}
                        >
                            გაგრძელება →
                        </button>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
        );
    };

    return (
        <div className="flex h-full bg-background overflow-hidden w-full max-w-[1184px]">
            <Sidebar />

            {/* Consent Modal */}
            {showConsentModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                        <h2 className="text-lg font-semibold mb-3">ისტორიის შენახვა</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            გსურს რომ შევინახოთ შენი საუბრების ისტორია?
                            ეს საშუალებას მოგცემს ძველი საუბრების გაგრძელებას გვერდის გადატვირთვის შემდეგ.
                            მონაცემები 7 დღის შემდეგ ავტომატურად იშლება.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={onRejectConsent}
                                className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                არა
                            </button>
                            <button
                                onClick={onAcceptConsent}
                                className="flex-1 py-2 px-4 rounded-lg text-white hover:opacity-90"
                                style={{ backgroundColor: '#0A7364' }}
                            >
                                დიახ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
                        <div className="flex items-center gap-3 mb-3">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                            <h2 className="text-lg font-semibold">მონაცემების წაშლა</h2>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            დარწმუნებული ხარ? ეს წაშლის ყველა შენს საუბარს და მონაცემს.
                            ეს მოქმედება ვერ გაუქმებელია.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => closeDeleteConfirm()}
                                className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                                disabled={isDeleting}
                            >
                                გაუქმება
                            </button>
                            <button
                                onClick={handleDeleteData}
                                disabled={isDeleting}
                                className="flex-1 py-2 px-4 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                            >
                                {isDeleting ? 'იშლება...' : 'წაშლა'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile header */}
                <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 p-4 bg-background">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        data-testid="chat-menu-button"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-primary">Scoop AI</span>
                </div>

                {/* Desktop Header - Only show when there are messages */}
                {activeConversation && activeConversation.messages.length > 0 && (
                    <div className="hidden lg:flex sticky top-0 z-30 px-6 py-3 items-center justify-between bg-white">
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center rounded-lg" style={{ width: '32px', height: '32px', backgroundColor: '#0A7364' }}>
                                <ScoopLogo className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-semibold text-base" style={{ color: '#111827' }}>Scoop AI</span>
                        </div>

                    </div>
                )}

                {/* Conditional Layout: Gemini-style centered vs Active chat */}
                {(!activeConversation || activeConversation.messages.length === 0) ? (
                    /* ===== EMPTY STATE: Gemini-style Centered Layout ===== */
                    <div className="gemini-centered-container bg-background">
                        <WelcomeSection />

                        {/* Mobile-only Pills - welcome-ის ქვემოთ */}
                        <div className="mobile-pills-wrapper flex lg:hidden">
                            <QuickActionPills onSelect={(text) => sendMessage(text)} />
                        </div>

                        {/* Centered Input */}
                        <div className="gemini-centered-input">
                            <form onSubmit={handleSubmit} className="relative flex items-end gap-2 p-2 pl-3 rounded-[28px] bg-[#f0f4f9] focus-within:bg-white focus-within:ring-1 focus-within:ring-gray-100/50 transition-all duration-300 ease-in-out border border-[#dfe3e8]">
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (input.trim() && !isLoading) {
                                                sendMessage(input);
                                            }
                                        }
                                    }}
                                    placeholder="დაწერე შენი კითხვა..."
                                    disabled={isLoading}
                                    rows={1}
                                    data-testid="chat-input"
                                    className="flex-1 min-w-0 bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-50 resize-none overflow-y-auto"
                                    style={{
                                        fontSize: '16px',
                                        fontFamily: 'Noto Sans Georgian, sans-serif',
                                        padding: '8px 12px',
                                        minHeight: '44px',
                                        maxHeight: '150px',
                                        border: 'none',
                                        lineHeight: '1.5'
                                    }}
                                />
                                {input.trim().length > 0 ? (
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isLoading}
                                        aria-label="გაგზავნა"
                                        data-testid="chat-send-button"
                                        className="flex-shrink-0 flex items-center justify-center p-3 rounded-full transition-all duration-150 ease-in-out disabled:opacity-30 hover:bg-black/5"
                                        style={{
                                            width: '44px',
                                            height: '44px',
                                            color: '#0A7364'
                                        }}
                                    >
                                        <ArrowUp size={20} strokeWidth={2.5} />
                                    </button>
                                ) : (
                                    <VoiceInput
                                        onTranscription={(text) => setInput(prev => prev ? prev + ' ' + text : text)}
                                        disabled={isLoading}
                                        userId={userId}
                                        sessionId={activeId || undefined}
                                    />
                                )}
                            </form>

                            {/* Desktop-only Pills - input-ის ქვემოთ */}
                            <div className="hidden lg:block">
                                <QuickActionPills onSelect={(text) => sendMessage(text)} />
                            </div>
                        </div>

                        <p className="text-center text-xs text-gray-400 mt-3 disclaimer-text">
                            გაითვალისწინეთ, AI ასისტენტმა შეიძლება დაუშვას შეცდომა.
                        </p>
                    </div>
                ) : (
                    /* ===== ACTIVE STATE: Messages + Bottom Input ===== */
                    <>
                        {/* Chat content - scrollable */}
                        <div className="flex-1 min-h-0 chat-scroll-container bg-background">
                            {renderChatHistory()}
                        </div>

                        {/* Input area - fixed at bottom */}
                        <div className="gemini-input-container">
                            <div className="max-w-3xl mx-auto px-4 pt-1 pb-3">
                                <form onSubmit={handleSubmit} className="relative flex items-end gap-2 p-2 pl-3 rounded-[28px] bg-[#f0f4f9] focus-within:bg-white focus-within:ring-1 focus-within:ring-gray-100/50 transition-all duration-300 ease-in-out border border-[#dfe3e8]">
                                    <textarea
                                        ref={textareaRef}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                if (input.trim() && !isLoading) {
                                                    sendMessage(input);
                                                }
                                            }
                                        }}
                                        placeholder="დაწერე შენი კითხვა..."
                                        disabled={isLoading}
                                        rows={1}
                                        data-testid="chat-input-active"
                                        className="flex-1 min-w-0 bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-50 resize-none overflow-y-auto"
                                        style={{
                                            fontSize: '16px',
                                            fontFamily: 'Noto Sans Georgian, sans-serif',
                                            padding: '8px 12px',
                                            minHeight: '44px',
                                            maxHeight: '150px',
                                            border: 'none',
                                            lineHeight: '1.5'
                                        }}
                                    />
                                    {isLoading ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                abortStream();
                                                setIsLoading(false);
                                                // Clean up on abort: remove empty assistant messages & clear quick replies
                                                const currentConvs = useSessionStore.getState().conversations;
                                                setConversations(
                                                    currentConvs.map((conv) =>
                                                        conv.id === activeId
                                                            ? {
                                                                ...conv,
                                                                messages: conv.messages
                                                                    // Filter out assistant messages with empty content (aborted responses)
                                                                    .filter((m) => !(m.role === 'assistant' && (!m.content || !m.content.trim())))
                                                                    // Clear quick replies from all remaining messages
                                                                    .map((m) => ({ ...m, quickReplies: [] })),
                                                            }
                                                            : conv
                                                    )
                                                );
                                            }}
                                            aria-label="შეჩერება"
                                            data-testid="chat-stop-button"
                                            className="flex-shrink-0 flex items-center justify-center p-3 rounded-full transition-all duration-150 ease-in-out hover:bg-[#FEF2F2] border border-transparent hover:border-[#FECACA]"
                                            style={{ width: '44px', height: '44px' }}
                                        >
                                            <Square style={{ width: '20px', height: '20px', color: '#CC3348', borderRadius: '2px' }} strokeWidth={0} fill="#CC3348" />
                                        </button>
                                    ) : input.trim().length > 0 ? (
                                        <button
                                            type="submit"
                                            disabled={!input.trim()}
                                            aria-label="გაგზავნა"
                                            className="flex-shrink-0 flex items-center justify-center p-3 rounded-full transition-all duration-150 ease-in-out disabled:opacity-30 hover:bg-black/5"
                                            style={{
                                                width: '44px',
                                                height: '44px',
                                                color: '#0A7364'
                                            }}
                                        >
                                            <ArrowUp size={20} strokeWidth={2.5} />
                                        </button>
                                    ) : (
                                        <VoiceInput
                                            onTranscription={(text) => setInput(prev => prev ? prev + ' ' + text : text)}
                                            disabled={isLoading}
                                            userId={userId}
                                            sessionId={activeConversation?.backendSessionId || activeId || undefined}
                                        />
                                    )}
                                </form>

                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
