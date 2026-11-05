/**
 * Debt stage — the single traffic-light rule used on every screen.
 *
 *  PAGADA   balance is $0
 *  CASI     ≥ 50% of the original amount paid, or balance ≤ $500
 *  EN DEUDA otherwise
 *  apoyo    checking / savings: neutral, no stage
 *
 * "Original amount": fixed loans use original_amount; revolving debt has no
 * stored opening balance, so credit_limit stands in for it (documented as a
 * proxy in the Fase 6 report). Without either, % paid is unknown (null) and the
 * stage falls back to the ≤ $500 rule.
 */
export type Stage = 'debt' | 'almost' | 'paid' | 'support';

export interface StageInput {
    type: string;
    balance: number | string;
    original_amount?: number | string | null;
    credit_limit?: number | string | null;
}

export const STAGE_LABEL: Record<Stage, { es: string; en: string }> = {
    debt: { es: 'EN DEUDA', en: 'IN DEBT' },
    almost: { es: 'CASI', en: 'ALMOST' },
    paid: { es: 'PAGADA', en: 'PAID' },
    support: { es: 'APOYO', en: 'SUPPORT' },
};

const ALMOST_BALANCE = 500;

export function paidFraction(acc: StageInput): number | null {
    const balance = Number(acc.balance) || 0;
    const original = Number(acc.original_amount) || Number(acc.credit_limit) || 0;
    if (original <= 0) return balance <= 0 ? 1 : null;
    return Math.max(0, Math.min(1, 1 - balance / original));
}

export function stageOf(acc: StageInput): Stage {
    if (acc.type !== 'debt') return 'support';
    const balance = Number(acc.balance) || 0;
    if (balance <= 0) return 'paid';
    const paid = paidFraction(acc);
    if (balance <= ALMOST_BALANCE || (paid !== null && paid >= 0.5)) return 'almost';
    return 'debt';
}

export const STAGE_ORDER: Stage[] = ['debt', 'almost', 'paid'];

/** YYYY-MM-DD in the user's LOCAL time (toISOString() is UTC and shifts evenings to tomorrow). */
export function localDay(d: Date = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
