'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="ka">
            <body
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    margin: 0,
                    padding: '2rem',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
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
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}
                >
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔴</div>
                    <h2
                        style={{
                            fontSize: '1.5rem',
                            fontWeight: 600,
                            marginBottom: '0.75rem',
                            color: '#ef4444',
                        }}
                    >
                        კრიტიკული შეცდომა
                    </h2>
                    <p
                        style={{
                            fontSize: '0.95rem',
                            color: '#94a3b8',
                            marginBottom: '1.5rem',
                            lineHeight: 1.6,
                        }}
                    >
                        აპლიკაციამ გათიშა. გთხოვთ განაახლოთ გვერდი.
                    </p>
                    <button
                        onClick={reset}
                        style={{
                            padding: '0.6rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                        }}
                    >
                        განაახლეთ
                    </button>
                </div>
            </body>
        </html>
    );
}
