/**
 * Shared API Types
 * 
 * Centralized TypeScript definitions for SSE events, API requests/responses,
 * and chat-related entities. Single source of truth for type safety.
 * 
 * @see implementation_plan.md Step 7: Shared API Types
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Core Entities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Quick reply suggestion from AI
 */
export interface QuickReply {
    title: string;
    payload: string;
}

/**
 * Chat message structure
 */
export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    quickReplies?: QuickReply[];
}

/**
 * Conversation/session structure
 */
export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    created_at?: string;
    updated_at?: string;
    backendSessionId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SSE Event Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SSE event handler callbacks
 */
export interface SSEEventHandlers {
    onText: (content: string) => void;
    onProducts: (content: string) => void;
    onTip: (text: string) => void;
    onThinking: (thought: string) => void;
    onQuickReplies: (replies: QuickReply[]) => void;
    onDone: (sessionId?: string) => void;
    onError: (message: string) => void;
    onTruncationWarning?: (finishReason: string) => void;
    onReconnecting?: (attempt: number, maxAttempts: number) => void;
}

/**
 * SSE streaming options
 */
export interface SSEStreamOptions {
    url: string;
    body: Record<string, unknown>;
    handlers: SSEEventHandlers;
    onStreamEnd?: () => void;
}

/**
 * useSSEStream hook return type
 */
export interface UseSSEStreamReturn {
    streamMessage: (options: SSEStreamOptions) => Promise<void>;
    abortStream: () => void;
    isStreaming: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Request/Response Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Chat message request to backend
 */
export interface ChatRequest {
    message: string;
    user_id: string;
    session_id?: string;
}

/**
 * Session list response from backend
 */
export interface SessionListResponse {
    sessions: Array<{
        session_id: string;
        title: string;
        created_at?: string;
        updated_at?: string;
    }>;
}

/**
 * Session history response from backend
 */
export interface SessionHistoryResponse {
    messages: Array<{
        role: string;
        content: string;
    }>;
}

/**
 * Voice transcription API response
 */
export interface TranscriptionResponse {
    text: string;
    language: string;
    duration_seconds: number;
}
