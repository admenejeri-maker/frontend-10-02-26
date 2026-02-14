import { parseProductsFromMarkdown, ParsedProduct } from '@/lib/parseProducts'

describe('parseProductsFromMarkdown', () => {
    it('parses a single product from markdown', () => {
        const markdown = `
რამდენიმე რჩევა თქვენთვის

**რეკომენდებული**
**Gold Standard Whey**
*Optimum Nutrition*
**89.99 ₾** · 30 პორცია · 3.00 ₾/პორცია
მაღალი ხარისხის პროტეინი, ყველაზე პოპულარული
[ყიდვა →](https://example.com/product1)

დაგვეხმარეთ რაიმე სხვა?
`.trim()

        const result = parseProductsFromMarkdown(markdown)

        expect(result.products).toHaveLength(1)
        expect(result.products[0]).toMatchObject({
            rank: 'recommended',
            name: 'Gold Standard Whey',
            brand: 'Optimum Nutrition',
            price: 89.99,
            servings: 30,
            pricePerServing: 3.0,
            description: 'მაღალი ხარისხის პროტეინი, ყველაზე პოპულარული',
            buyLink: 'https://example.com/product1',
        })
        expect(result.intro).toContain('რამდენიმე რჩევა')
    })

    it('parses multiple products with different ranks', () => {
        const markdown = `
**რეკომენდებული**
**Product A**
*Brand A*
**100 ₾** · 30 პორცია · 3.33 ₾/პორცია
Description A
[ყიდვა →](https://example.com/a)

**ალტერნატივა**
**Product B**
*Brand B*
**80 ₾** · 25 პორცია · 3.20 ₾/პორცია
Description B
[ყიდვა →](https://example.com/b)

**ბიუჯეტური**
**Product C**
*Brand C*
**50 ₾** · 20 პორცია · 2.50 ₾/პორცია
Description C
[ყიდვა →](https://example.com/c)
`.trim()

        const result = parseProductsFromMarkdown(markdown)

        expect(result.products).toHaveLength(3)
        expect(result.products[0].rank).toBe('recommended')
        expect(result.products[0].name).toBe('Product A')
        expect(result.products[1].rank).toBe('alternative')
        expect(result.products[1].name).toBe('Product B')
        expect(result.products[2].rank).toBe('budget')
        expect(result.products[2].name).toBe('Product C')
    })

    it('deduplicates same-name products and consolidates flavors', () => {
        const markdown = `
**რეკომენდებული**
**Gold Standard Whey - Chocolate**
*Optimum Nutrition*
**89.99 ₾** · 30 პორცია · 3.00 ₾/პორცია
Best whey protein
[ყიდვა →](https://example.com/choco)

**რეკომენდებული**
**Gold Standard Whey - Vanilla**
*Optimum Nutrition*
**89.99 ₾** · 30 პორცია · 3.00 ₾/პორცია
Best whey protein vanilla
[ყიდვა →](https://example.com/vanilla)
`.trim()

        const result = parseProductsFromMarkdown(markdown)

        // Should consolidate into one product
        expect(result.products).toHaveLength(1)
        expect(result.products[0].name).toBe('Gold Standard Whey')
        expect(result.products[0].flavors).toBeDefined()
        expect(result.products[0].flavors).toContain('Chocolate')
        expect(result.products[0].flavors).toContain('Vanilla')
    })

    it('extracts TIP section from markdown', () => {
        const markdown = `
**რეკომენდებული**
**Creatine Mono**
*MyProtein*
**45 ₾** · 60 პორცია · 0.75 ₾/პორცია
Pure creatine monohydrate
[ყიდვა →](https://example.com/creatine)

[TIP]კრეატინი მიიღეთ ყოველდღე 5 გრამი, მიუხედავად ვარჯიშისა[/TIP]
`.trim()

        const result = parseProductsFromMarkdown(markdown)

        expect(result.tip).toBeDefined()
        expect(result.tip).toContain('კრეატინი მიიღეთ ყოველდღე 5 გრამი')
    })

    it('handles empty or invalid markdown gracefully', () => {
        const result = parseProductsFromMarkdown('')

        expect(result.intro).toBe('')
        expect(result.products).toHaveLength(0)
        expect(result.outro).toBe('')
        expect(result.tip).toBeUndefined()
    })

    it('filters out products without valid price', () => {
        const markdown = `
**რეკომენდებული**
**Invalid Product**
*Brand X*
Missing price line
[ყიდვა →](https://example.com/invalid)
`.trim()

        const result = parseProductsFromMarkdown(markdown)

        // Product without price should be filtered
        expect(result.products).toHaveLength(0)
    })

    it('skips Georgian section headers that resemble product names', () => {
        const markdown = `
**რეკომენდებული**
**Test Product**
*Brand Z*
**60 ₾** · 30 პორცია · 2.00 ₾/პორცია
Good product
[ყიდვა →](https://example.com/test)

**შეჯამება**
This is a summary section, not a product.
`.trim()

        const result = parseProductsFromMarkdown(markdown)

        // Only the real product should be parsed, not "შეჯამება"
        expect(result.products).toHaveLength(1)
        expect(result.products[0].name).toBe('Test Product')
    })

    it('does not parse buy links wrapped in bold markdown', () => {
        const markdown = `
**რეკომენდებული**
**Bold Link Product**
*Brand Y*
**70 ₾** · 25 პორცია · 2.80 ₾/პორცია
Product with bold buy link
**[ყიდვა →](https://example.com/bold-link)**
`.trim()

        const result = parseProductsFromMarkdown(markdown)

        // Product may be parsed but buyLink should NOT be extracted
        // because the regex expects [ყიდვა →](url), not **[ყიდვა →](url)**
        if (result.products.length > 0) {
            expect(result.products[0].buyLink).toBeUndefined()
        }
    })
})
