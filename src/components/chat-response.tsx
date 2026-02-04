'use client';

import type React from "react"
import ReactMarkdown from 'react-markdown'
import { ScoopLogo } from "./scoop-logo"
import { RefreshCw, Lightbulb } from "lucide-react"
import { ProductCard } from "./ProductCard"
import { parseProductsFromMarkdown } from "@/lib/parseProducts"

interface QuickReply {
    id: string
    text: string
    icon?: React.ReactNode
}

interface ChatResponseProps {
    userMessage?: string
    assistantContent?: string
    quickReplies?: QuickReply[]
    onQuickReplyClick?: (id: string, text: string) => void
    isStreaming?: boolean
}

// Default quick replies (fallback if backend doesn't send any)
const defaultQuickReplies: QuickReply[] = [
    { id: "compare", text: "Whey vs Isolate შეადარე" },
    { id: "muscle", text: "კუნთის ზრდისთვის რა არის საუკეთესო?" },
    { id: "budget", text: "100₾-მდე ვარიანტები" },
    { id: "popular", text: "ყველაზე პოპულარული პროდუქტი" },
]

export function ChatResponse({
    userMessage,
    assistantContent,
    quickReplies = defaultQuickReplies,
    onQuickReplyClick,
    isStreaming = false,
}: ChatResponseProps) {
    // Parse products from markdown if content exists
    const parsed = assistantContent
        ? parseProductsFromMarkdown(assistantContent)
        : { intro: '', products: [], outro: '' };

    const hasProducts = parsed.products.length > 0;

    return (
        <div className="space-y-6 w-full">
            {/* User message */}
            {userMessage && (
                <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-tr-sm max-w-[85%] sm:max-w-[75%] shadow-sm" style={{ backgroundColor: '#0A7364', color: 'white' }}>
                        <p className="text-sm md:text-base leading-relaxed">{userMessage}</p>
                    </div>
                </div>
            )}

            {/* Assistant response - Using stable grid class for consistent width */}
            <div className="ai-response-grid">
                {/* Scoop icon - fixed 32px width matching ThinkingStepsLoader */}
                <div
                    className="w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'white', borderColor: '#E5E7EB' }}
                >
                    <ScoopLogo className="w-4 h-4" />
                </div>

                {/* Content - uses stable content class + streaming cursor */}
                <div className={`ai-response-content space-y-4 ${isStreaming ? 'streaming-cursor' : ''}`}>
                    {assistantContent ? (
                        hasProducts ? (
                            // Render with ProductCards
                            <>
                                {/* Intro text */}
                                {parsed.intro && (
                                    <div className={`prose prose-sm max-w-none text-foreground ${isStreaming ? 'animate-chunk' : ''}`}>
                                        <ReactMarkdown>{parsed.intro}</ReactMarkdown>
                                    </div>
                                )}

                                {/* Product Cards */}
                                <div className="products-grid">
                                    {parsed.products.map((product, idx) => (
                                        <ProductCard
                                            key={idx}
                                            rank={product.rank}
                                            name={product.name}
                                            brand={product.brand}
                                            price={product.price}
                                            servings={product.servings}
                                            pricePerServing={product.pricePerServing}
                                            description={product.description}
                                            buyLink={product.buyLink}
                                        />
                                    ))}
                                </div>

                                {/* Outro text */}
                                {parsed.outro && (
                                    <div className={`prose prose-sm max-w-none text-foreground mt-4 ${isStreaming ? 'animate-chunk' : ''}`}>
                                        <ReactMarkdown>{parsed.outro}</ReactMarkdown>
                                    </div>
                                )}

                                {/* Practical Tip - Amber style */}
                                {parsed.tip && (
                                    <div className="mt-4 p-4 rounded-xl border" style={{ backgroundColor: 'var(--tip-bg)', borderColor: 'var(--tip-border)' }}>
                                        <div className="flex items-start gap-3">
                                            <Lightbulb className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--tip-icon)' }} strokeWidth={2} />
                                            <div>
                                                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--tip-text)' }}>პრაქტიკული რჩევა</p>
                                                <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{parsed.tip}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            // Fallback: render cleaned markdown (TIP already extracted)
                            <>
                                <div className={`prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline ${isStreaming ? 'animate-chunk' : ''}`}>
                                    <ReactMarkdown>{parsed.intro || assistantContent}</ReactMarkdown>
                                </div>
                                {/* Practical Tip - Amber style */}
                                {parsed.tip && (
                                    <div className="mt-4 p-4 rounded-xl border" style={{ backgroundColor: 'var(--tip-bg)', borderColor: 'var(--tip-border)' }}>
                                        <div className="flex items-start gap-3">
                                            <Lightbulb className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--tip-icon)' }} strokeWidth={2} />
                                            <div>
                                                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--tip-text)' }}>პრაქტიკული რჩევა</p>
                                                <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{parsed.tip}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )
                    ) : (
                        <p className="text-muted-foreground italic">პასუხი იტვირთება...</p>
                    )}
                </div>
            </div>

            {/* Quick reply buttons - aligned with content (offset by icon) */}
            {quickReplies && quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-4" style={{ marginLeft: 'calc(32px + 12px)' }}>
                    {quickReplies.map((reply) => (
                        <button
                            key={reply.id}
                            onClick={() => onQuickReplyClick?.(reply.id, reply.text)}
                            className="quick-reply-btn group flex items-center gap-2"
                        >
                            {reply.icon || <RefreshCw className="w-4 h-4" strokeWidth={1.5} />}
                            <span>{reply.text}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
