'use client';

import { Dumbbell, Zap, Flame, Heart } from 'lucide-react';
import { ScoopLogo } from './scoop-logo';

interface EmptyScreenProps {
    setInput: (text: string) => void;
}

const categories = [
    {
        id: 1,
        title: 'კუნთის ზრდა',
        description: 'პროტეინი და გეინერი',
        icon: Dumbbell,
        color: '#D9B444', // Metallic Gold
        message: 'მინდა კუნთის მასის მომატება. რა პროდუქტები მჭირდება?',
    },
    {
        id: 2,
        title: 'ენერგია',
        description: 'პრე-ვორქაუთი და კოფეინი',
        icon: Zap,
        color: '#0A7364', // Pine Green
        message: 'მჭირდება ენერგია ვარჯიშისთვის. რა მირჩევ?',
    },
    {
        id: 3,
        title: 'წონის კლება',
        description: 'fat burner-ები',
        icon: Flame,
        color: '#CC3348', // Brick Red
        message: 'მინდა წონაში კლება. რა პროდუქტები დამეხმარება?',
    },
    {
        id: 4,
        title: 'ჯანმრთელობა',
        description: 'ვიტამინები და მინერალები',
        icon: Heart,
        color: '#0A7364', // Pine Green
        message: 'მინდა ზოგადი ჯანმრთელობის გაუმჯობესება. რა მირჩევ?',
    },
];

export function EmptyScreen({ setInput }: EmptyScreenProps) {
    return (
        // Uses same ai-response-grid structure as ThinkingStepsLoader/ChatResponse
        <div className="ai-response-grid py-6">
            {/* Invisible spacer - matches 32px icon column in other components */}
            <div className="w-8 h-8" aria-hidden="true" />

            {/* Content area - uses stable content class */}
            <div className="ai-response-content">
                <div className="text-center mb-12" data-testid="welcome-section">
                    <div className="flex items-center justify-center gap-3 mb-3">
                        <ScoopLogo className="w-10 h-10" />
                        <h1 className="text-3xl font-bold text-primary">Scoop AI ასისტენტი</h1>
                    </div>
                    <p className="text-lg text-muted-foreground">
                        რა არის შენი მიზანი?
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => setInput(category.message)}
                            data-testid={`category-card-${category.id}`}
                            className="group flex items-start gap-4 p-5 rounded-2xl bg-[#f0f4f9] hover:bg-[#e2e8f0] transition-all duration-200 text-left cursor-pointer active:scale-[0.98]"
                        >
                            <div
                                className="p-2 rounded-xl transition-colors"
                                style={{ backgroundColor: `${category.color}15` }}
                            >
                                <category.icon
                                    className="w-5 h-5 flex-shrink-0"
                                    style={{ color: category.color }}
                                    strokeWidth={1.5}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-semibold text-foreground text-lg mb-1 group-hover:text-[#0A7364] transition-colors">
                                    {category.title}
                                </h2>
                                <p className="text-muted-foreground text-sm">{category.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default EmptyScreen;
