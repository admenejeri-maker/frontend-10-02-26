/**
 * Tests for initializeSession async gate (Incognito race condition fix)
 * T1-T4: Verifies isSessionReady behavior during async initialization
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock enrollApiKey before importing the store
vi.mock('../../lib/apiClient', () => ({
    enrollApiKey: vi.fn().mockResolvedValue(undefined),
    getApiKey: vi.fn().mockReturnValue(null),
    setApiKey: vi.fn(),
    clearApiKey: vi.fn(),
    apiFetch: vi.fn(),
    fetchCsrfToken: vi.fn(),
}));

import { useSessionStore } from '../useSessionStore';
import { enrollApiKey } from '../../lib/apiClient';

const mockedEnrollApiKey = vi.mocked(enrollApiKey);

describe('initializeSession async gate', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        useSessionStore.setState({
            conversations: [],
            activeId: null,
            userId: '',
            consent: 'true',
            isSessionReady: false,
            sessionsLoaded: false,
            isLoadingHistory: false,
        });
    });

    // T1: isSessionReady = true after enrollApiKey resolves successfully
    test('sets isSessionReady = true after enrollApiKey resolves', async () => {
        mockedEnrollApiKey.mockResolvedValueOnce(undefined);

        await useSessionStore.getState().initializeSession();

        expect(useSessionStore.getState().isSessionReady).toBe(true);
        expect(mockedEnrollApiKey).toHaveBeenCalledTimes(1);
    });

    // T2: isSessionReady = true even when enrollApiKey throws (graceful degradation)
    test('sets isSessionReady = true even when enrollApiKey throws', async () => {
        mockedEnrollApiKey.mockRejectedValueOnce(new Error('Network error'));

        await useSessionStore.getState().initializeSession();

        expect(useSessionStore.getState().isSessionReady).toBe(true);
    });

    // T3: isSessionReady is false BEFORE initializeSession resolves
    test('isSessionReady is false before initializeSession resolves', async () => {
        // Create a deferred promise so we can check state mid-flight
        let resolveEnroll!: () => void;
        const pendingEnroll = new Promise<void>((resolve) => {
            resolveEnroll = resolve;
        });
        mockedEnrollApiKey.mockReturnValueOnce(pendingEnroll);

        // Start initialization but don't await
        const initPromise = useSessionStore.getState().initializeSession();

        // While enrollApiKey is pending, isSessionReady should be false
        expect(useSessionStore.getState().isSessionReady).toBe(false);

        // Resolve and finish
        resolveEnroll();
        await initPromise;
        expect(useSessionStore.getState().isSessionReady).toBe(true);
    });

    // T4: loadSessions is blocked when isSessionReady is false (defense-in-depth)
    test('loadSessions returns early when isSessionReady is false', async () => {
        useSessionStore.setState({
            userId: 'test_user',
            sessionsLoaded: false,
            isSessionReady: false,
            consent: 'true',
        });

        // Mock global fetch to detect if loadSessions tries to make a request
        const fetchSpy = vi.fn();
        global.fetch = fetchSpy;

        await useSessionStore.getState().loadSessions();

        // fetch should NOT have been called because isSessionReady is false
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
