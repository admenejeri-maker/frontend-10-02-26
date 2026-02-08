'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[Scoop Error Boundary]', error);
    }, [error]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                padding: '2rem',
                fontFamily: 'var(--font-noto-sans), sans-serif',
                background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%)',
                color: '#e2e8f0',
            }}
        >
            <div
                style={{
                    maxWidth: '420px',
                    textAlign: 'center',
                    padding: '2.5rem',
                    borderRadius: '16px',
                    background: 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
            >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                <h2
                    style={{
                        fontSize: '1.5rem',
                        fontWeight: 600,
                        marginBottom: '0.75rem',
                        color: '#f97316',
                    }}
                >
                    დაფიქსირდა შეცდომა
                </h2>
                <p
                    style={{
                        fontSize: '0.95rem',
                        color: '#94a3b8',
                        marginBottom: '1.5rem',
                        lineHeight: 1.6,
                    }}
                >
                    რაღაც არასწორად წარიმართა. სცადეთ თავიდან ან განაახლეთ გვერდი.
                </p>
                {error.digest && (
                    <p
                        style={{
                            fontSize: '0.75rem',
                            color: '#64748b',
                            marginBottom: '1rem',
                            fontFamily: 'monospace',
                        }}
                    >
                        Error ID: {error.digest}
                    </p>
                )}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    <button
                        onClick={reset}
                        style={{
                            padding: '0.6rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #f97316, #ea580c)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,115,22,0.4)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        თავიდან სცადეთ
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        style={{
                            padding: '0.6rem 1.5rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'transparent',
                            color: '#94a3b8',
                            fontWeight: 500,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'border-color 0.15s',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        }}
                    >
                        მთავარი გვერდი
                    </button>
                </div>
            </div>
        </div>
    );
}
