import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────────────────
// State Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface UIState {
    sidebarOpen: boolean;
    showConsentModal: boolean;
    showDeleteConfirm: boolean;
    isDeleting: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface UIActions {
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    openDeleteConfirm: () => void;
    closeDeleteConfirm: () => void;
    setIsDeleting: (deleting: boolean) => void;
    setShowConsentModal: (show: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useUIStore = create<UIState & UIActions>()(
    devtools(
        (set) => ({
            // ── Initial State ────────────────────────────────────────────────────
            sidebarOpen: false,
            showConsentModal: false,
            showDeleteConfirm: false,
            isDeleting: false,

            // ── Actions ──────────────────────────────────────────────────────────
            toggleSidebar: () => {
                set(
                    (state) => ({ sidebarOpen: !state.sidebarOpen }),
                    false,
                    'toggleSidebar'
                );
            },

            setSidebarOpen: (open) => {
                set({ sidebarOpen: open }, false, 'setSidebarOpen');
            },

            openDeleteConfirm: () => {
                set({ showDeleteConfirm: true }, false, 'openDeleteConfirm');
            },

            closeDeleteConfirm: () => {
                set({ showDeleteConfirm: false }, false, 'closeDeleteConfirm');
            },

            setIsDeleting: (deleting) => {
                set({ isDeleting: deleting }, false, 'setIsDeleting');
            },

            setShowConsentModal: (show) => {
                set({ showConsentModal: show }, false, 'setShowConsentModal');
            },
        }),
        { name: 'UIStore' }
    )
);
