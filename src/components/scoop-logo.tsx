export function ScoopLogo({ className = "w-6 h-6" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
            {/* Scoop/Dumbbell logo icon matching brand guidelines */}
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
            <circle cx="18" cy="18" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {/* Small connector circles */}
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
            <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
        </svg>
    )
}
