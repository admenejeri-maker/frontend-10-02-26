/**
 * P3.8: Feature Flags — Frontend Hook
 * ====================================
 *
 * Zustand store that fetches flag states from the backend API.
 * Provides `isEnabled(flagName)` for easy checking throughout the app.
 *
 * Usage:
 *   import { useFeatureFlags } from '@/hooks/useFeatureFlags';
 *
 *   const { isEnabled } = useFeatureFlags();
 *   if (isEnabled('thinking_steps')) { ... }
 */

import { create } from 'zustand';
import { apiFetch } from '@/lib/apiClient';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

// Default flags — used as fallback if API is unreachable
const DEFAULT_FLAGS: Record<string, boolean> = {
    otel_tracing: false,
    safety_filters: true,
    context_caching: true,
    api_key_auth: false,
    lean_prompt: true,
    belief_decay: true,
    sse_reconnect: true,
    thinking_steps: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// State Interface
// ─────────────────────────────────────────────────────────────────────────────

interface FeatureFlagsState {
    /** Map of flag_name → enabled */
    flags: Record<string, boolean>;

    /** Whether flags have been loaded from the API */
    loaded: boolean;

    /** Whether a fetch is in progress */
    loading: boolean;

    /** Last error message (null if no error) */
    error: string | null;

    /** Check if a specific flag is enabled */
    isEnabled: (flagName: string) => boolean;

    /** Fetch flags from backend API */
    fetchFlags: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useFeatureFlags = create<FeatureFlagsState>((set, get) => ({
    flags: { ...DEFAULT_FLAGS },
    loaded: false,
    loading: false,
    error: null,

    isEnabled: (flagName: string): boolean => {
        const { flags } = get();
        // Return false for unknown flags (fail-closed)
        return flags[flagName] ?? false;
    },

    fetchFlags: async () => {
        // Prevent duplicate requests
        if (get().loading) return;

        set({ loading: true, error: null });

        try {
            const res = await apiFetch(`${BACKEND_URL}/api/v1/features`);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();

            if (data.flags && typeof data.flags === 'object') {
                set({
                    flags: { ...DEFAULT_FLAGS, ...data.flags },
                    loaded: true,
                    loading: false,
                });
            } else {
                throw new Error('Invalid response format');
            }
        } catch (err) {
            // Graceful degradation: keep defaults on failure
            console.warn('[FeatureFlags] Failed to fetch, using defaults:', err);
            set({
                loaded: true,  // Mark as loaded even on error (use defaults)
                loading: false,
                error: err instanceof Error ? err.message : 'Unknown error',
            });
        }
    },
}));
