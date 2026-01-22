'use client';

import { ScoopLogo } from "./scoop-logo";
import { Package } from "lucide-react";

interface ChatLoaderProps {
    userMessage?: string;
}

export function ChatLoader({ userMessage }: ChatLoaderProps) {
    return (
        <div className="space-y-6">
            {/* User message */}
            {userMessage && (
                <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] sm:max-w-[75%] shadow-sm" style={{ backgroundColor: '#0A7364', color: 'white' }}>
                        <p className="text-sm md:text-base leading-relaxed">{userMessage}</p>
                    </div>
                </div>
            )}

            {/* Assistant loading response */}
            <div className="flex items-start gap-4">
                {/* Animated Scoop icon container with pulse */}
                <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-xl border border-border flex items-center justify-center bg-card flex-shrink-0" style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}>
                    <ScoopLogo className="w-5 h-5 md:w-6 md:h-6 animate-pulse" />
                    {/* Orbiting dot */}
                    <div className="absolute inset-0 animate-spin" style={{ animationDuration: "3s" }}>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" style={{ backgroundColor: '#0A7364' }} />
                    </div>
                </div>

                <div className="flex-1 space-y-3">
                    {/* Status line with icon */}
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <div className="relative overflow-hidden w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(217, 180, 68, 0.2)' }}>
                            <Package className="w-4 h-4" style={{ color: '#D9B444' }} strokeWidth={1.5} />
                            {/* Shimmer effect */}
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                        </div>
                        <span className="text-sm font-medium text-gray-500">ვამოწმებ ხელმისაწვდომობას</span>
                        {/* Perplexity-style bouncing dots */}
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full animate-[perplexityBounce_1.4s_ease-in-out_infinite]" style={{ backgroundColor: '#0A7364' }} />
                            <span className="w-1.5 h-1.5 rounded-full animate-[perplexityBounce_1.4s_ease-in-out_0.2s_infinite]" style={{ backgroundColor: '#0A7364' }} />
                            <span className="w-1.5 h-1.5 rounded-full animate-[perplexityBounce_1.4s_ease-in-out_0.4s_infinite]" style={{ backgroundColor: '#0A7364' }} />
                        </div>
                    </div>

                    {/* Skeleton loading lines - Perplexity style */}
                    <div className="space-y-2.5">
                        <div className="relative h-3 rounded-full overflow-hidden w-full" style={{ backgroundColor: '#f3f4f6' }}>
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                        </div>
                        <div className="relative h-3 rounded-full overflow-hidden w-4/5" style={{ backgroundColor: '#f3f4f6' }}>
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_0.2s_infinite] bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                        </div>
                        <div className="relative h-3 rounded-full overflow-hidden w-3/5" style={{ backgroundColor: '#f3f4f6' }}>
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_0.4s_infinite] bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
