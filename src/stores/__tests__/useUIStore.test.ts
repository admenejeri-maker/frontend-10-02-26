import { describe, test, expect, beforeEach } from 'vitest';
import { useUIStore } from '../useUIStore';

describe('useUIStore', () => {
    beforeEach(() => {
        // Reset store to clean state before each test
        useUIStore.setState({
            sidebarOpen: false,
            showConsentModal: false,
            showDeleteConfirm: false,
            isDeleting: false,
        });
    });

    // ─── Sidebar ─────────────────────────────────────────────────────────────

    test('toggleSidebar flips sidebarOpen state', () => {
        expect(useUIStore.getState().sidebarOpen).toBe(false);
        useUIStore.getState().toggleSidebar();
        expect(useUIStore.getState().sidebarOpen).toBe(true);
        useUIStore.getState().toggleSidebar();
        expect(useUIStore.getState().sidebarOpen).toBe(false);
    });

    test('setSidebarOpen sets sidebarOpen to specific value', () => {
        useUIStore.getState().setSidebarOpen(true);
        expect(useUIStore.getState().sidebarOpen).toBe(true);
        useUIStore.getState().setSidebarOpen(false);
        expect(useUIStore.getState().sidebarOpen).toBe(false);
    });

    // ─── Delete Confirmation ─────────────────────────────────────────────────

    test('openDeleteConfirm sets showDeleteConfirm to true', () => {
        useUIStore.getState().openDeleteConfirm();
        expect(useUIStore.getState().showDeleteConfirm).toBe(true);
    });

    test('closeDeleteConfirm sets showDeleteConfirm to false', () => {
        useUIStore.setState({ showDeleteConfirm: true });
        useUIStore.getState().closeDeleteConfirm();
        expect(useUIStore.getState().showDeleteConfirm).toBe(false);
    });

    // ─── Deleting State ──────────────────────────────────────────────────────

    test('setIsDeleting updates isDeleting flag', () => {
        useUIStore.getState().setIsDeleting(true);
        expect(useUIStore.getState().isDeleting).toBe(true);
        useUIStore.getState().setIsDeleting(false);
        expect(useUIStore.getState().isDeleting).toBe(false);
    });

    // ─── Consent Modal ───────────────────────────────────────────────────────

    test('setShowConsentModal controls modal visibility', () => {
        useUIStore.getState().setShowConsentModal(true);
        expect(useUIStore.getState().showConsentModal).toBe(true);
        useUIStore.getState().setShowConsentModal(false);
        expect(useUIStore.getState().showConsentModal).toBe(false);
    });
});
