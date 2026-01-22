'use client';

import { useState, useEffect } from 'react';
import { Package, Search, FileText, Calculator, Check } from 'lucide-react';
import { ScoopLogo } from './scoop-logo';
import type { LucideIcon } from 'lucide-react';

interface ThinkingStepsLoaderProps {
    userMessage: string;
    realThoughts?: string[]; // Real-time AI thoughts from Gemini Thinking Stream
    onComplete?: () => void;
}

interface Step {
    icon: LucideIcon;
    text: string;
    duration: number;
}

const steps: Step[] = [
    { icon: Package, text: "ვამოწმებ ხელმისაწვდომობას", duration: 2000 },
    { icon: Search, text: "ვეძებ შესაბამის პროდუქტებს", duration: 2500 },
    { icon: FileText, text: "ვადარებ მახასიათებლებს", duration: 2000 },
    { icon: Calculator, text: "ვითვლი საუკეთესო ფასს", duration: 1500 },
    { icon: Calculator, text: "ვამზადებ რეკომენდაციას", duration: 2000 },
];

// Extract only the **bold** text from thinking steps
const extractBoldText = (text: string): string => {
    const match = text.match(/\*\*(.+?)\*\*/);
    if (match) return match[1];
    // Fallback: if no bold, take first 60 chars
    return text.length > 60 ? text.substring(0, 60) + '...' : text;
};

export function ThinkingStepsLoader({ userMessage, realThoughts, onComplete }: ThinkingStepsLoaderProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<number[]>([]);

    // Use real thoughts if available, otherwise use fake steps
    const hasRealThoughts = realThoughts && realThoughts.length > 0;

    useEffect(() => {
        if (currentStep >= steps.length) {
            const timeout = setTimeout(() => {
                onComplete?.();
            }, 500);
            return () => clearTimeout(timeout);
        }

        const timer = setTimeout(() => {
            setCompletedSteps(prev => [...prev, currentStep]);
            setCurrentStep(prev => prev + 1);
        }, steps[currentStep].duration);

        return () => clearTimeout(timer);
    }, [currentStep, onComplete]);

    const getStepStatus = (index: number): 'pending' | 'active' | 'complete' => {
        if (completedSteps.includes(index)) return 'complete';
        if (index === currentStep) return 'active';
        return 'pending';
    };

    return (
        <div className="space-y-4 w-full">
            {/* User message bubble */}
            {userMessage && (
                <div className="flex justify-end">
                    <div
                        className="px-[14px] py-2 rounded-2xl rounded-tr-sm max-w-[85%] sm:max-w-[75%] shadow-sm"
                        style={{ backgroundColor: '#0A7364', color: 'white' }}
                    >
                        <p className="text-[13px] leading-relaxed">{userMessage}</p>
                    </div>
                </div>
            )}

            {/* AI Response Container - Using stable grid class for consistent width */}
            <div className="ai-response-grid">
                {/* Scoop Logo with pulse ring - fixed 32px width */}
                <div
                    className="relative w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0 animate-pulse-ring"
                    style={{ backgroundColor: 'white', borderColor: '#E5E7EB' }}
                >
                    <ScoopLogo className="w-4 h-4" />
                </div>

                {/* Steps Container - uses stable content class */}
                <div className="ai-response-content py-1" role="status" aria-live="polite">
                    <div className="space-y-2">
                        {/* Render REAL thoughts if available */}
                        {hasRealThoughts ? (
                            realThoughts.map((thought, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-3 min-h-7"
                                    aria-label={`აზრი ${index + 1}`}
                                >
                                    {/* Completed indicator */}
                                    <div
                                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                        style={{ backgroundColor: '#0A7364' }}
                                    >
                                        <Check className="w-2.5 h-2.5 text-white animate-check-pop" strokeWidth={3} />
                                    </div>

                                    {/* Thought text - extracted bold only */}
                                    <span className="text-[12px] font-medium" style={{ color: '#111827' }}>
                                        {extractBoldText(thought)}
                                    </span>
                                </div>
                            ))
                        ) : (
                            /* Minimal waiting animation until real thoughts arrive */
                            <div className="flex items-center gap-3 min-h-7">
                                {/* Pulsing indicator */}
                                <div
                                    className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse"
                                    style={{ backgroundColor: '#0A7364' }}
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                </div>



                                {/* Waiting text */}
                                <span className="text-[12px] font-medium" style={{ color: '#6B7280' }}>
                                    ვფიქრობ...
                                </span>

                                {/* Bouncing dots */}
                                <div className="flex gap-0.5 ml-1">
                                    <span
                                        className="w-1 h-1 rounded-full animate-thinking-bounce"
                                        style={{ backgroundColor: '#0A7364', animationDelay: '0s' }}
                                    />
                                    <span
                                        className="w-1 h-1 rounded-full animate-thinking-bounce"
                                        style={{ backgroundColor: '#0A7364', animationDelay: '0.15s' }}
                                    />
                                    <span
                                        className="w-1 h-1 rounded-full animate-thinking-bounce"
                                        style={{ backgroundColor: '#0A7364', animationDelay: '0.3s' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: '#E5E7EB' }}>
                        <div
                            className="h-1 rounded-full overflow-hidden"
                            style={{ backgroundColor: '#F3F4F6' }}
                        >
                            <div
                                className="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                                style={{
                                    backgroundColor: '#0A7364',
                                    width: `${((currentStep) / steps.length) * 100}%`,
                                }}
                            >
                                {/* Shimmer effect */}
                                <div
                                    className="absolute inset-0 animate-progress-shimmer"
                                    style={{
                                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                                    }}
                                />
                            </div>
                        </div>
                        <p className="text-[10px] mt-1.5" style={{ color: '#9CA3AF' }}>
                            დაახლოებით 3-5 წამი
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
