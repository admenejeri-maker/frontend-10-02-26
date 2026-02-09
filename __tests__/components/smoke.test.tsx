/**
 * Component Smoke Tests
 *
 * Lightweight render-only tests that verify key UI components
 * mount without errors and render critical content.
 */

import { render, screen } from '@testing-library/react'

// ── ProductCard ──────────────────────────────────────────────────────────────

import { ProductCard } from '@/components/ProductCard'

describe('ProductCard', () => {
    const defaultProps = {
        name: 'Gold Standard Whey',
        brand: 'Optimum Nutrition',
        price: 120,
        servings: 30,
        pricePerServing: 4.0,
        description: 'Premium whey protein isolate.',
        buyLink: 'https://scoop.ge/product/1',
    }

    it('renders product name and brand', () => {
        render(<ProductCard {...defaultProps} />)

        expect(screen.getByText('Gold Standard Whey')).toBeDefined()
        expect(screen.getByText('Optimum Nutrition')).toBeDefined()
    })

    it('renders price in GEL currency', () => {
        render(<ProductCard {...defaultProps} />)

        expect(screen.getByText('120 ₾')).toBeDefined()
    })

    it('renders buy link pointing to scoop.ge', () => {
        render(<ProductCard {...defaultProps} />)

        const link = screen.getByRole('link')
        expect(link.getAttribute('href')).toBe('https://scoop.ge/product/1')
        expect(link.getAttribute('target')).toBe('_blank')
    })
})
