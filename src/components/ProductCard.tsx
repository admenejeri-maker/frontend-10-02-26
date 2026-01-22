'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';

interface ProductCardProps {
    rank?: 'recommended' | 'alternative' | 'budget';
    name: string;
    brand: string;
    price: number;
    servings: number;
    pricePerServing: number;
    description: string;
    buyLink: string;
    flavors?: string[]; // Available flavor variants
}

export function ProductCard({
    rank,
    name,
    brand,
    price,
    servings,
    pricePerServing,
    description,
    buyLink,
    flavors,
}: ProductCardProps) {
    return (
        <div className="py-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 -mx-2 px-2 transition-colors">
            {/* Row 1: Name, Brand, Price, Source */}
            <div className="flex items-start justify-between gap-4">
                {/* Left side */}
                <div className="min-w-0 flex-1">
                    {/* Title */}
                    <h3 className="font-semibold text-gray-900 text-base leading-snug">{name}</h3>
                    {/* Brand */}
                    <p className="text-sm text-gray-500 mt-0.5">{brand}</p>
                    {/* Meta: Servings · Price per serving - TEAL COLOR */}
                    <p className="text-xs mt-1" style={{ color: '#0A7364' }}>
                        {servings} პორცია · {pricePerServing.toFixed(2)} ₾/პორცია
                    </p>
                </div>

                {/* Right side: Price + Source Pill */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="font-bold text-gray-900 text-lg">{price} ₾</span>
                    {/* Source Pill */}
                    <a
                        href={buyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded-md text-xs text-gray-600 transition-colors"
                    >
                        scoop.ge
                        <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>

            {/* Row 2: Description with "რატომ ეს?" bolded */}
            <div className="mt-2">
                <p className="text-sm text-gray-600 leading-relaxed">
                    {description}
                </p>
            </div>
        </div>
    );
}

export default ProductCard;
