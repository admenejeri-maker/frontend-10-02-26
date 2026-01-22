/**
 * Parse product information from markdown response
 * Extracts structured product data from the chatbot's markdown format
 * 
 * DEDUPLICATION: Products with same name+price are consolidated,
 * showing available flavors instead of duplicate cards.
 */

export interface ParsedProduct {
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

export interface ParsedResponse {
    intro: string;
    products: ParsedProduct[];
    outro: string;
    tip?: string; // Practical tip extracted from [TIP]...[/TIP]
}

/**
 * Generate a unique key for product deduplication
 * Products with same name and price are considered duplicates
 */
function getProductKey(product: Partial<ParsedProduct>): string {
    const name = (product.name || '').toLowerCase().trim();
    const price = product.price || 0;
    return `${name}:${price}`;
}

/**
 * Extract flavor from product name if present
 * e.g., "Gold Standard Whey - Chocolate" -> { baseName: "Gold Standard Whey", flavor: "Chocolate" }
 */
function extractFlavor(fullName: string): { baseName: string; flavor?: string } {
    // Common separators: " - ", " – ", " — ", " | "
    const separators = [' - ', ' – ', ' — ', ' | ', ' / '];

    for (const sep of separators) {
        if (fullName.includes(sep)) {
            const parts = fullName.split(sep);
            // First part is base name, last part is flavor
            const baseName = parts[0].trim();
            const flavor = parts.slice(1).join(sep).trim();
            return { baseName, flavor };
        }
    }

    return { baseName: fullName };
}

/**
 * Consolidate duplicate products (same name + same price)
 * Collect flavors into an array instead of showing duplicate cards
 */
function consolidateProducts(products: ParsedProduct[]): ParsedProduct[] {
    const consolidated = new Map<string, ParsedProduct>();

    for (const product of products) {
        // Extract base name and flavor
        const { baseName, flavor } = extractFlavor(product.name);

        // Create key using base name and price
        const key = `${baseName.toLowerCase()}:${product.price}`;

        if (consolidated.has(key)) {
            // Add flavor to existing product
            const existing = consolidated.get(key)!;
            if (flavor && !existing.flavors?.includes(flavor)) {
                existing.flavors = existing.flavors || [];
                existing.flavors.push(flavor);
            }
        } else {
            // New product
            const newProduct = { ...product, name: baseName };
            if (flavor) {
                newProduct.flavors = [flavor];
            }
            consolidated.set(key, newProduct);
        }
    }

    return Array.from(consolidated.values());
}

/**
 * Parse markdown response to extract products
 * 
 * Expected format:
 * **რეკომენდებული**
 * **Product Name**
 * *Brand*
 * **XXX ₾** · XX პორცია · X.XX ₾/პორცია
 * Description text
 * [ყიდვა →](link)
 */
export function parseProductsFromMarkdown(markdown: string): ParsedResponse {
    // Extract and remove TIP section first (before any other parsing)
    let tip: string | undefined;
    const tipPattern = /\[TIP\]([\s\S]*?)\[\/TIP\]/;
    const tipMatch = markdown.match(tipPattern);
    if (tipMatch) {
        tip = tipMatch[1].trim();
        markdown = markdown.replace(tipPattern, '').trim();
    }

    // Remove [QUICK_REPLIES] tags (already provided separately via JSON)
    const quickRepliesPattern = /\[QUICK_REPLIES\][\s\S]*?\[\/QUICK_REPLIES\]/g;
    markdown = markdown.replace(quickRepliesPattern, '').trim();

    const lines = markdown.split('\n');
    const rawProducts: ParsedProduct[] = [];
    let intro = '';
    let outro = '';
    let currentProduct: Partial<ParsedProduct> | null = null;
    let introEnded = false;
    let lastProductEndLine = -1;

    // Rank detection patterns
    const rankPatterns: Record<string, 'recommended' | 'alternative' | 'budget'> = {
        'რეკომენდებული': 'recommended',
        'ალტერნატივა': 'alternative',
        'ბიუჯეტური': 'budget',
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines
        if (!line) continue;

        // Check for rank labels
        let rankFound: 'recommended' | 'alternative' | 'budget' | undefined;
        for (const [georgian, rank] of Object.entries(rankPatterns)) {
            if (line.includes(`**${georgian}**`) || line === `**${georgian}**`) {
                rankFound = rank;
                break;
            }
        }

        if (rankFound) {
            // Save previous product if exists
            if (currentProduct && currentProduct.name) {
                rawProducts.push(currentProduct as ParsedProduct);
                lastProductEndLine = i;
            }
            currentProduct = { rank: rankFound };
            introEnded = true;
            continue;
        }

        // Check for product name (bold text that's not a rank and not price)
        // Allow trailing whitespace for Gemini 3 compatibility
        const productNameMatch = line.match(/^\*\*([^*]+)\*\*\s*$/);
        if (productNameMatch && !line.includes('₾') && !line.includes('შემდეგი')) {
            if (!currentProduct) {
                currentProduct = {};
                introEnded = true;
            }
            if (!currentProduct.name) {
                currentProduct.name = productNameMatch[1].trim();
                continue;
            }
        }

        // Check for brand (italic text)
        // Allow trailing whitespace for Gemini 3 compatibility
        const brandMatch = line.match(/^\*([^*]+)\*\s*$/);
        if (brandMatch && currentProduct && !currentProduct.brand) {
            currentProduct.brand = brandMatch[1].trim();
            continue;
        }

        // Check for price line: **XXX ₾** · XX პორცია · X.XX ₾/პორცია
        // Also handle: XXX.XX ₾ · XX პორცია · X.XX ₾/პორცია
        const priceMatch = line.match(/\*?\*?(\d+(?:\.\d+)?)\s*₾\*?\*?\s*·\s*(\d+)\s*პორცია\s*·\s*(\d+(?:\.\d+)?)\s*₾\/პორცია/);
        if (priceMatch && currentProduct) {
            currentProduct.price = parseFloat(priceMatch[1]);
            currentProduct.servings = parseInt(priceMatch[2]);
            currentProduct.pricePerServing = parseFloat(priceMatch[3]);
            continue;
        }

        // Check for buy link
        const buyLinkMatch = line.match(/\[ყიდვა\s*→?\]\(([^)]+)\)/);
        if (buyLinkMatch && currentProduct) {
            currentProduct.buyLink = buyLinkMatch[1];
            // Product is complete, save it
            if (currentProduct.name) {
                rawProducts.push(currentProduct as ParsedProduct);
                lastProductEndLine = i;
            }
            currentProduct = null;
            continue;
        }

        // Collect description for current product
        if (currentProduct && currentProduct.name && currentProduct.price && !currentProduct.description) {
            // Skip separator lines
            if (line === '---') continue;
            currentProduct.description = line;
            continue;
        }

        // Collect intro (before first product)
        if (!introEnded) {
            intro += (intro ? '\n' : '') + line;
        } else if (!currentProduct && lastProductEndLine > 0 && i > lastProductEndLine) {
            // Collect outro (after last product)
            // Skip: links, lists, short lines (likely leftover headings like "კრეატინი")
            if (!line.startsWith('[') && !line.startsWith('-')) {
                // Skip very short lines or single words (likely section headers/leftovers)
                const isShortLine = line.length < 15;
                const isSingleWord = !line.includes(' ');

                // Skip known category headers and section titles
                const knownCategoryHeaders = [
                    'ვიტამინები და აქსესუარები',
                    'პროტეინები',
                    'კრეატინები',
                    'პრე-ვორქაუთები',
                    'ამინომჟავები',
                    'წონის კონტროლი',
                    'აქსესუარები',
                    'შეიკერები',
                    'რეკომენდებული კომბინაცია',
                    'გეინერები',
                ];
                const isCategoryHeader = knownCategoryHeaders.some(header =>
                    line.toLowerCase().includes(header.toLowerCase()) ||
                    line === header
                );

                if (!isShortLine && !isSingleWord && !isCategoryHeader) {
                    outro += (outro ? '\n' : '') + line;
                }
            }
        }
    }

    // Save last product if exists
    if (currentProduct && currentProduct.name) {
        rawProducts.push(currentProduct as ParsedProduct);
    }

    // Provide defaults for missing fields
    rawProducts.forEach(product => {
        if (!product.brand) product.brand = '';
        if (!product.price) product.price = 0;
        if (!product.servings) product.servings = 0;
        if (!product.pricePerServing) product.pricePerServing = 0;
        if (!product.description) product.description = '';
        if (!product.buyLink) product.buyLink = '#';
    });

    // VALIDATION: Filter out invalid products
    // A valid product MUST have: name, price > 0, and a real buyLink
    const validProducts = rawProducts.filter(product => {
        const hasValidName = product.name && product.name.trim().length > 0;
        const hasValidPrice = product.price > 0;
        const hasValidLink = product.buyLink && product.buyLink !== '#';

        // Product is valid if it has at least name and price
        // buyLink can be optional, but if it's just '#' and no price, skip it
        return hasValidName && hasValidPrice;
    });

    // Consolidate duplicates (same product, different flavors)
    const products = consolidateProducts(validProducts);

    return { intro, products, outro, tip };
}

