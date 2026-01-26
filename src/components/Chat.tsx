'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Settings, Send, Menu, AlertTriangle, Square, ArrowRight } from 'lucide-react';
// EmptyScreen removed - replaced with Gemini-style WelcomeSection + QuickActionPills
import { ThinkingStepsLoader } from './thinking-steps-loader';
import { ChatResponse } from './chat-response';
import { ScoopLogo } from './scoop-logo';
import { Sidebar } from './sidebar';

// Backend API URL - Production Cloud Run
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

interface QuickReply {
    title: string;
    payload: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    quickReplies?: QuickReply[];
}

interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    created_at?: string;
    updated_at?: string;
    backendSessionId?: string;  // Session ID from backend for persistence
}

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// Gemini-style Welcome Section (centered layout)
function WelcomeSection() {
    return (
        <div className="gemini-welcome">
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
                <div className="bg-primary text-primary-foreground px-4 py-2 rounded-xl max-w-[80%]" style={{ backgroundColor: '#0A7364', color: 'white' }}>
                    <p className="text-sm">{message.content}</p>
                </div>
            </div>
        );
    }
    return (
        <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg border border-border flex items-center justify-center bg-card flex-shrink-0">
                <ScoopLogo className="w-4 h-4" />
            </div>
            <div className="flex-1 bg-card border border-border rounded-xl px-4 py-3 max-w-[85%]">
                <div className="prose prose-sm max-w-none text-foreground">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
            </div>
        </div>
    );
}

// Main Chat Component
export default function Chat() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userId, setUserId] = useState<string>('');
    const [sessionsLoaded, setSessionsLoaded] = useState(false);
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [thinkingSteps, setThinkingSteps] = useState<string[]>([]); // Real-time AI thoughts
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const activeConversation = conversations.find((c) => c.id === activeId);

    // Last user message ref for smart scrolling
    const lastUserMessageRef = useRef<HTMLDivElement>(null);

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

    // Handle consent acceptance
    const handleAcceptConsent = useCallback(() => {
        localStorage.setItem('scoop_history_consent', 'true');
        setShowConsentModal(false);
    }, []);

    // Handle consent rejection (don't save history)
    const handleRejectConsent = useCallback(() => {
        localStorage.setItem('scoop_history_consent', 'false');
        setShowConsentModal(false);
    }, []);

    // Handle delete all user data
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

    // Load session history when selecting from sidebar
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

    // Create new conversation - just reset to empty screen
    const startNewChat = useCallback(() => {
        setActiveId(null);
        setInput('');
        setSidebarOpen(false);
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

    // Send message using /chat endpoint (fallback for non-streaming)
    const sendMessage = useCallback(
        async (text: string) => {
            if (!text.trim() || isLoading) return;

            let convId = activeId;
            if (!convId) {
                convId = createNewConversation();
            }

            setInput('');
            setIsLoading(true);
            // Reset textarea height
            const textarea = document.querySelector('textarea');
            if (textarea) textarea.style.height = '44px';

            const userMessage: Message = {
                id: generateId(),
                role: 'user',
                content: text.trim(),
            };

            // Add user message immediately
            setConversations((prev) =>
                prev.map((conv) =>
                    conv.id === convId
                        ? {
                            ...conv,
                            title: conv.messages.length === 0 ? text.slice(0, 25) + '...' : conv.title,
                            messages: [...conv.messages, userMessage],
                        }
                        : conv
                )
            );

            try {
                // Simulate network delay for demo visuals if needed, or just fetch
                const response = await fetch(`${BACKEND_URL}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        message: text,
                        session_id: convId,
                    }),
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                const responseText = data.response_text_geo || data.response || data.text || '';

                // Extract dynamic quick_replies from backend
                const backendQuickReplies: QuickReply[] = data.quick_replies || [];

                // Add assistant message with quick replies
                const assistantMessage: Message = {
                    id: generateId(),
                    role: 'assistant',
                    content: responseText,
                    quickReplies: backendQuickReplies,
                };

                setConversations((prev) =>
                    prev.map((conv) =>
                        conv.id === convId
                            ? {
                                ...conv,
                                messages: [...conv.messages, assistantMessage],
                            }
                            : conv
                    )
                );

            } catch (error) {
                console.error('[Scoop] Fetch error:', error);
            } finally {
                setIsLoading(false);
            }
        },
        [activeId, createNewConversation, isLoading, userId]
    );

    // Send message using SSE streaming endpoint for faster perceived response
    const sendMessageStream = useCallback(
        async (text: string) => {
            if (!text.trim() || isLoading) return;

            let convId = activeId;
            if (!convId) {
                convId = createNewConversation();
            }

            setInput('');
            setIsLoading(true);
            setThinkingSteps([]); // Reset thinking steps for new message
            // Reset textarea height
            const textarea = document.querySelector('textarea');
            if (textarea) textarea.style.height = '44px';

            const userMessage: Message = {
                id: generateId(),
                role: 'user',
                content: text.trim(),
            };

            // Add user message immediately
            setConversations((prev) =>
                prev.map((conv) =>
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
            const assistantId = generateId();
            setConversations((prev) =>
                prev.map((conv) =>
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
                const activeConv = conversations.find(c => c.id === convId);
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

                const response = await fetch(`${BACKEND_URL}/chat/stream`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        message: text,
                        session_id: sessionIdToUse,  // Use backend session_id if available
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let assistantContent = '';
                let quickReplies: QuickReply[] = [];

                if (!reader) {
                    throw new Error('No response body');
                }

                // Read stream
                // Bug #22 Fix: SSE events can span multiple network chunks
                // Split on event boundary (\n\n) not line boundary (\n)
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();

                    // Decode chunk if present
                    if (value) {
                        buffer += decoder.decode(value, { stream: true });
                    }

                    // BUG FIX #23: On stream end, flush TextDecoder's internal buffer
                    // Georgian UTF-8 chars are 3 bytes - chunk boundaries may split mid-character
                    // Without this flush, buffered bytes are lost when stream ends
                    // See: https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/decode#stream
                    if (done) {
                        buffer += decoder.decode(); // Final flush - no arguments
                    }

                    // SSE events are separated by double newline
                    const events = buffer.split('\n\n');
                    // Keep incomplete event in buffer
                    buffer = events.pop() || '';

                    for (const event of events) {
                        // Find the data line within the event
                        const dataLine = event.split('\n').find(line => line.startsWith('data: '));
                        if (!dataLine) continue;
                        const line = dataLine; // Preserve variable name for compatibility

                        try {
                            const data = JSON.parse(line.slice(6));
                            // Enhanced debug: show FULL content length
                            console.log('[DEBUG SSE]', data.type, 'len=' + (data.content?.length || 0), data.content?.slice?.(0, 80));

                            if (data.type === 'text') {
                                // Bug #19 Fix: Strip [TIP]...[/TIP] from incoming text stream only
                                // Tip is sent separately via 'tip' event - remove raw tags from incoming data
                                const cleanContent = data.content.replace(/\[TIP\][\s\S]*?\[\/TIP\]/g, '');
                                assistantContent += cleanContent;
                                // Bug #21 Fix: Don't strip TIP from assistantContent - it may have
                                // properly-formatted TIP from 'tip' event handler
                                setConversations((prev) =>
                                    prev.map((conv) =>
                                        conv.id === convId
                                            ? {
                                                ...conv,
                                                messages: conv.messages.map((m) =>
                                                    m.id === assistantId
                                                        ? { ...m, content: assistantContent }
                                                        : m
                                                ),
                                            }
                                            : conv
                                    )
                                );
                            } else if (data.type === 'products') {
                                // Formatted products injection
                                assistantContent += '\n\n' + data.content;
                                // Bug #21 Fix: Don't strip TIP - preserve tip from 'tip' event
                                setConversations((prev) =>
                                    prev.map((conv) =>
                                        conv.id === convId
                                            ? {
                                                ...conv,
                                                messages: conv.messages.map((m) =>
                                                    m.id === assistantId
                                                        ? { ...m, content: assistantContent }
                                                        : m
                                                ),
                                            }
                                            : conv
                                    )
                                );
                            } else if (data.type === 'tip') {
                                // Backend sends clean tip text, wrap with tags for parser
                                const tipWithTags = `\n\n[TIP]\n${data.content}\n[/TIP]`;
                                assistantContent += tipWithTags;
                                // NOTE: Do NOT strip TIP tags here - we just added them intentionally!
                                setConversations((prev) =>
                                    prev.map((conv) =>
                                        conv.id === convId
                                            ? {
                                                ...conv,
                                                messages: conv.messages.map((m) =>
                                                    m.id === assistantId
                                                        ? { ...m, content: assistantContent }
                                                        : m
                                                ),
                                            }
                                            : conv
                                    )
                                );
                            } else if (data.type === 'thinking') {
                                // Real-time AI thoughts from Gemini Thinking Stream
                                setThinkingSteps(prev => [...prev, data.content]);
                            } else if (data.type === 'quick_replies') {
                                // Backend sends {type: "quick_replies", replies: [...]}
                                const repliesData = data.replies || data.content || [];
                                quickReplies = repliesData.map((qr: { title: string; payload: string }) => ({
                                    title: qr.title,
                                    payload: qr.payload,
                                }));
                            } else if (data.type === 'done') {
                                // Streaming complete - persist backend session_id
                                if (data.session_id) {
                                    setConversations((prev) =>
                                        prev.map((conv) =>
                                            conv.id === convId
                                                ? { ...conv, backendSessionId: data.session_id }
                                                : conv
                                        )
                                    );
                                }
                                break;
                            } else if (data.type === 'error') {
                                console.error('[Scoop] Stream error:', data.message || data.content);
                                // Show error in chat - use backend message if available
                                assistantContent = data.message || 'დაფიქსირდა შეცდომა. გთხოვთ სცადოთ თავიდან.';
                                setConversations((prev) =>
                                    prev.map((conv) =>
                                        conv.id === convId
                                            ? {
                                                ...conv,
                                                messages: conv.messages.map((m) =>
                                                    m.id === assistantId
                                                        ? { ...m, content: assistantContent }
                                                        : m
                                                ),
                                            }
                                            : conv
                                    )
                                );
                            }
                        } catch {
                            // Ignore JSON parse errors for incomplete chunks
                        }
                    }

                    // Exit loop after processing final buffer (BUG FIX #23)
                    if (done) break;
                }

                // Final update with quick replies
                if (quickReplies.length > 0) {
                    setConversations((prev) =>
                        prev.map((conv) =>
                            conv.id === convId
                                ? {
                                    ...conv,
                                    messages: conv.messages.map((m) =>
                                        m.id === assistantId
                                            ? { ...m, quickReplies }
                                            : m
                                    ),
                                }
                                : conv
                        )
                    );
                }

            } catch (error) {
                console.error('[Scoop] Stream error:', error);
                // Fallback to non-streaming on error
                // Remove empty assistant message first
                setConversations((prev) =>
                    prev.map((conv) =>
                        conv.id === convId
                            ? {
                                ...conv,
                                messages: conv.messages.filter((m) => m.id !== assistantId),
                            }
                            : conv
                    )
                );
                // Try non-streaming endpoint
                await sendMessage(text);
                return;
            } finally {
                setIsLoading(false);
            }
        },
        [activeId, createNewConversation, isLoading, userId, sendMessage]
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Use streaming endpoint for faster perceived response
        sendMessageStream(input);
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
                                quickReplies={dynamicQuickReplies}
                                onQuickReplyClick={(id, text) => sendMessageStream(text)}
                            />
                        </div>
                    );
                    i++; // Skip assistant message as it's consumed by ChatResponse
                }
                // 2. User is last OR followed by empty assistant (streaming) & Loading -> Render ThinkingStepsLoader
                else if (isLoading && (i === msgs.length - 1 || (nextMsg && nextMsg.role === 'assistant' && !nextMsg.content?.trim()))) {
                    items.push(
                        <div key="loader" ref={lastUserMessageRef} className="w-full">
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
            <div className="chat-content-wrapper space-y-8">
                {items}
                <div ref={messagesEndRef} />
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-background overflow-hidden w-full max-w-[1184px]">
            <Sidebar
                conversations={conversations.map((c) => ({
                    id: c.id,
                    title: c.title,
                    created_at: c.created_at,
                    updated_at: c.updated_at
                }))}
                activeId={activeId}
                onNewChat={startNewChat}
                onSelect={(id) => {
                    setActiveId(id);
                    setSidebarOpen(false);
                    // Load history if not already loaded
                    const conv = conversations.find(c => c.id === id);
                    if (conv && conv.messages.length === 0) {
                        loadSessionHistory(id);
                    }
                }}
                onClose={() => setSidebarOpen(false)}
                onDeleteData={() => setShowDeleteConfirm(true)}
                isOpen={sidebarOpen}
            />

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
                                onClick={handleRejectConsent}
                                className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                არა
                            </button>
                            <button
                                onClick={handleAcceptConsent}
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
                                onClick={() => setShowDeleteConfirm(false)}
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
                <div className="lg:hidden flex items-center gap-3 p-4 border-b border-border">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <span className="font-semibold text-primary">Scoop AI</span>
                </div>

                {/* Desktop Header - Only show when there are messages */}
                {activeConversation && activeConversation.messages.length > 0 && (
                    <div className="hidden lg:flex px-6 py-3 items-center justify-between bg-white" style={{ borderBottom: '1px solid #E5E5E5' }}>
                        <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center rounded-lg" style={{ width: '32px', height: '32px', backgroundColor: '#0A7364' }}>
                                <ScoopLogo className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-semibold text-base" style={{ color: '#111827' }}>Scoop AI</span>
                        </div>
                        <button
                            className="p-2 rounded-lg transition-colors hover:bg-[#F3F4F6] group"
                            style={{ width: '40px', height: '40px' }}
                        >
                            <Settings className="w-5 h-5 group-hover:text-[#374151]" style={{ color: '#6B7280' }} strokeWidth={1.5} />
                        </button>
                    </div>
                )}

                {/* Conditional Layout: Gemini-style centered vs Active chat */}
                {(!activeConversation || activeConversation.messages.length === 0) ? (
                    /* ===== EMPTY STATE: Gemini-style Centered Layout ===== */
                    <div className="gemini-centered-container bg-background">
                        <WelcomeSection />

                        {/* Mobile-only Pills - welcome-ის ქვემოთ */}
                        <div className="mobile-pills-wrapper flex lg:hidden">
                            <QuickActionPills onSelect={(text) => sendMessageStream(text)} />
                        </div>

                        {/* Centered Input */}
                        <div className="gemini-centered-input">
                            <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 rounded-xl border border-[#E5E7EB] bg-white transition-all duration-150 ease-in-out focus-within:border-[#0A7364] hover:border-[#0A7364]">
                                <textarea
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                        e.target.style.height = '44px';
                                        e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (input.trim() && !isLoading) {
                                                sendMessageStream(input);
                                            }
                                        }
                                    }}
                                    placeholder="დაწერე შენი კითხვა..."
                                    disabled={isLoading}
                                    rows={1}
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
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    aria-label="გაგზავნა"
                                    className="flex-shrink-0 flex items-center justify-center p-3 rounded-xl transition-all duration-150 ease-in-out disabled:opacity-30 hover:bg-[#085C50]"
                                    style={{
                                        width: '48px',
                                        height: '48px',
                                        backgroundColor: input.trim() ? '#0A7364' : 'transparent'
                                    }}
                                >
                                    <ArrowRight style={{ width: '24px', height: '24px', color: input.trim() ? '#FFFFFF' : '#9CA3AF' }} strokeWidth={2} />
                                </button>
                            </form>

                            {/* Desktop-only Pills - input-ის ქვემოთ */}
                            <div className="hidden lg:block">
                                <QuickActionPills onSelect={(text) => sendMessageStream(text)} />
                            </div>
                        </div>

                        <p className="text-center text-xs text-gray-400 mt-6 disclaimer-text">
                            გაითვალისწინეთ, AI ასისტენტმა შეიძლება დაუშვას შეცდომა.
                        </p>
                    </div>
                ) : (
                    /* ===== ACTIVE STATE: Messages + Bottom Input ===== */
                    <>
                        {/* Chat content - scrollable */}
                        <div className="flex-1 chat-scroll-container bg-background">
                            {renderChatHistory()}
                        </div>

                        {/* Input area - fixed at bottom */}
                        <div className="border-t border-gray-100 bg-white">
                            <div className="max-w-4xl mx-auto px-6 py-4">
                                <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 rounded-xl border border-[#E5E7EB] bg-white transition-all duration-150 ease-in-out focus-within:border-[#0A7364] hover:border-[#0A7364]">
                                    <textarea
                                        value={input}
                                        onChange={(e) => {
                                            setInput(e.target.value);
                                            e.target.style.height = '44px';
                                            e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                if (input.trim() && !isLoading) {
                                                    sendMessageStream(input);
                                                }
                                            }
                                        }}
                                        placeholder="დაწერე შენი კითხვა..."
                                        disabled={isLoading}
                                        rows={1}
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
                                            onClick={() => window.location.reload()}
                                            aria-label="შეჩერება"
                                            className="flex-shrink-0 flex items-center justify-center p-3 rounded-xl transition-all duration-150 ease-in-out hover:bg-[#FEF2F2] border border-transparent hover:border-[#FECACA]"
                                            style={{ width: '48px', height: '48px' }}
                                        >
                                            <Square style={{ width: '20px', height: '20px', color: '#CC3348', borderRadius: '2px' }} strokeWidth={0} fill="#CC3348" />
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            disabled={!input.trim()}
                                            aria-label="გაგზავნა"
                                            className="flex-shrink-0 flex items-center justify-center p-3 rounded-xl transition-all duration-150 ease-in-out disabled:opacity-30 hover:bg-[#085C50]"
                                            style={{
                                                width: '48px',
                                                height: '48px',
                                                backgroundColor: input.trim() ? '#0A7364' : 'transparent'
                                            }}
                                        >
                                            <ArrowRight style={{ width: '24px', height: '24px', color: input.trim() ? '#FFFFFF' : '#9CA3AF' }} strokeWidth={2} />
                                        </button>
                                    )}
                                </form>
                                <p className="text-center text-xs text-gray-400 mt-3">
                                    გაითვალისწინეთ, AI ასისტენტმა შეიძლება დაუშვას შეცდომა. ჯანმრთელობის საკითხებზე გაიარეთ კონსულტაცია სპეციალისტთან.
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
