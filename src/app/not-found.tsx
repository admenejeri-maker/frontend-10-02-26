import Link from 'next/link';

export default function NotFound() {
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
                <div style={{ fontSize: '4rem', marginBottom: '1rem', opacity: 0.8 }}>404</div>
                <h2
                    style={{
                        fontSize: '1.5rem',
                        fontWeight: 600,
                        marginBottom: '0.75rem',
                        color: '#8b5cf6',
                    }}
                >
                    გვერდი ვერ მოიძებნა
                </h2>
                <p
                    style={{
                        fontSize: '0.95rem',
                        color: '#94a3b8',
                        marginBottom: '1.5rem',
                        lineHeight: 1.6,
                    }}
                >
                    მოთხოვნილი გვერდი არ არსებობს.
                </p>
                <Link
                    href="/"
                    style={{
                        display: 'inline-block',
                        padding: '0.6rem 1.5rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        textDecoration: 'none',
                        cursor: 'pointer',
                    }}
                >
                    მთავარ გვერდზე
                </Link>
            </div>
        </div>
    );
}
