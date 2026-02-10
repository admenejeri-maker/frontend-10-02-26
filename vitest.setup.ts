import '@testing-library/jest-dom/vitest'

// ─── localStorage polyfill for happy-dom + Zustand persist ─────────────────
// happy-dom's localStorage implementation is incomplete; Zustand persist
// middleware requires setItem/getItem/removeItem to work.
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = String(value); },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (index: number) => Object.keys(store)[index] ?? null,
    };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock Next.js navigation module
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/',
}))

// Mock Next.js image component
vi.mock('next/image', () => ({
    default: (props: Record<string, unknown>) => {
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        return props
    },
}))
