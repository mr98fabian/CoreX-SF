/**
 * Credit Card APR Reference Data — Top US Banks
 * Source: Public rate disclosures from major card issuers (2024–2025).
 * These are variable APR ranges; actual rates depend on creditworthiness.
 *
 * Business intent: Help users estimate their APR when they don't know
 * the exact number, reducing data entry friction while maintaining
 * accuracy for Velocity Banking calculations.
 */

export interface CardAPRInfo {
    bank: string;
    card: string;
    aprLow: number;
    aprHigh: number;
    /** Midpoint used as the "best guess" suggestion */
    aprTypical: number;
    category: 'rewards' | 'cashback' | 'travel' | 'balance_transfer' | 'student' | 'secured' | 'store';
}

/**
 * Curated list of the most common credit cards in the US market.
 * Ordered by bank prominence / market share.
 */
export const CREDIT_CARD_APR_DATABASE: CardAPRInfo[] = [
    // ── Chase ──────────────────────────────────────────────
    { bank: 'Chase', card: 'Sapphire Preferred', aprLow: 21.49, aprHigh: 28.49, aprTypical: 24.99, category: 'travel' },
    { bank: 'Chase', card: 'Sapphire Reserve', aprLow: 22.49, aprHigh: 29.49, aprTypical: 25.99, category: 'travel' },
    { bank: 'Chase', card: 'Freedom Unlimited', aprLow: 20.49, aprHigh: 29.24, aprTypical: 24.87, category: 'cashback' },
    { bank: 'Chase', card: 'Freedom Flex', aprLow: 20.49, aprHigh: 29.24, aprTypical: 24.87, category: 'cashback' },

    // ── American Express ────────────────────────────────────
    { bank: 'Amex', card: 'Platinum', aprLow: 21.99, aprHigh: 29.99, aprTypical: 25.99, category: 'travel' },
    { bank: 'Amex', card: 'Gold', aprLow: 21.99, aprHigh: 29.99, aprTypical: 25.99, category: 'rewards' },
    { bank: 'Amex', card: 'Blue Cash Everyday', aprLow: 19.24, aprHigh: 29.99, aprTypical: 24.62, category: 'cashback' },
    { bank: 'Amex', card: 'Blue Cash Preferred', aprLow: 19.24, aprHigh: 29.99, aprTypical: 24.62, category: 'cashback' },

    // ── Capital One ─────────────────────────────────────────
    { bank: 'Capital One', card: 'Venture X', aprLow: 19.99, aprHigh: 29.99, aprTypical: 24.99, category: 'travel' },
    { bank: 'Capital One', card: 'Venture', aprLow: 19.99, aprHigh: 29.99, aprTypical: 24.99, category: 'travel' },
    { bank: 'Capital One', card: 'Quicksilver', aprLow: 19.99, aprHigh: 29.99, aprTypical: 24.99, category: 'cashback' },
    { bank: 'Capital One', card: 'SavorOne', aprLow: 19.99, aprHigh: 29.99, aprTypical: 24.99, category: 'cashback' },
    { bank: 'Capital One', card: 'Platinum Secured', aprLow: 30.74, aprHigh: 30.74, aprTypical: 30.74, category: 'secured' },

    // ── Citi ─────────────────────────────────────────────────
    { bank: 'Citi', card: 'Double Cash', aprLow: 18.49, aprHigh: 28.49, aprTypical: 23.49, category: 'cashback' },
    { bank: 'Citi', card: 'Custom Cash', aprLow: 19.24, aprHigh: 29.24, aprTypical: 24.24, category: 'cashback' },
    { bank: 'Citi', card: 'Premier', aprLow: 21.24, aprHigh: 29.24, aprTypical: 25.24, category: 'travel' },

    // ── Bank of America ─────────────────────────────────────
    { bank: 'Bank of America', card: 'Customized Cash', aprLow: 16.99, aprHigh: 26.99, aprTypical: 21.99, category: 'cashback' },
    { bank: 'Bank of America', card: 'Travel Rewards', aprLow: 16.99, aprHigh: 26.99, aprTypical: 21.99, category: 'travel' },
    { bank: 'Bank of America', card: 'Unlimited Cash', aprLow: 16.99, aprHigh: 26.99, aprTypical: 21.99, category: 'cashback' },

    // ── Discover ────────────────────────────────────────────
    { bank: 'Discover', card: 'it Cash Back', aprLow: 17.24, aprHigh: 28.24, aprTypical: 22.74, category: 'cashback' },
    { bank: 'Discover', card: 'it Miles', aprLow: 17.24, aprHigh: 28.24, aprTypical: 22.74, category: 'travel' },
    { bank: 'Discover', card: 'it Student', aprLow: 18.24, aprHigh: 27.24, aprTypical: 22.74, category: 'student' },
    { bank: 'Discover', card: 'it Secured', aprLow: 28.24, aprHigh: 28.24, aprTypical: 28.24, category: 'secured' },

    // ── Wells Fargo ─────────────────────────────────────────
    { bank: 'Wells Fargo', card: 'Active Cash', aprLow: 20.49, aprHigh: 29.49, aprTypical: 24.99, category: 'cashback' },
    { bank: 'Wells Fargo', card: 'Autograph', aprLow: 20.49, aprHigh: 29.49, aprTypical: 24.99, category: 'rewards' },
    { bank: 'Wells Fargo', card: 'Reflect', aprLow: 24.49, aprHigh: 29.49, aprTypical: 26.99, category: 'balance_transfer' },

    // ── US Bank ─────────────────────────────────────────────
    { bank: 'US Bank', card: 'Altitude Go', aprLow: 19.49, aprHigh: 29.49, aprTypical: 24.49, category: 'rewards' },
    { bank: 'US Bank', card: 'Cash+', aprLow: 19.49, aprHigh: 29.49, aprTypical: 24.49, category: 'cashback' },

    // ── Store Cards (very common, notorious high APRs) ──────
    { bank: 'Synchrony', card: 'Amazon Store Card', aprLow: 29.24, aprHigh: 29.24, aprTypical: 29.24, category: 'store' },
    { bank: 'Synchrony', card: 'PayPal Cashback', aprLow: 23.99, aprHigh: 31.99, aprTypical: 27.99, category: 'store' },
    { bank: 'Barclays', card: 'Apple Card', aprLow: 19.24, aprHigh: 29.49, aprTypical: 24.37, category: 'cashback' },
    { bank: 'TD Bank', card: 'Target RedCard', aprLow: 22.90, aprHigh: 22.90, aprTypical: 22.90, category: 'store' },
];

/**
 * Get unique bank names for the quick-select filter.
 */
export const BANK_NAMES = [...new Set(CREDIT_CARD_APR_DATABASE.map(c => c.bank))];

/**
 * Find cards by bank name.
 */
export function getCardsByBank(bank: string): CardAPRInfo[] {
    return CREDIT_CARD_APR_DATABASE.filter(c => c.bank === bank);
}

/**
 * Get the national average APR across all cards in our database.
 * Useful as a fallback suggestion.
 */
export function getNationalAverageAPR(): number {
    const allTypical = CREDIT_CARD_APR_DATABASE.map(c => c.aprTypical);
    const avg = allTypical.reduce((sum, apr) => sum + apr, 0) / allTypical.length;
    return Math.round(avg * 100) / 100; // 2 decimal places
}

/**
 * Search cards by name (fuzzy partial match).
 */
export function searchCards(query: string): CardAPRInfo[] {
    const q = query.toLowerCase();
    return CREDIT_CARD_APR_DATABASE.filter(
        c => c.bank.toLowerCase().includes(q) || c.card.toLowerCase().includes(q)
    );
}
