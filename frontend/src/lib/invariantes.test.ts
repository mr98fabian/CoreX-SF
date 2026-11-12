import { describe, it, expect } from 'vitest';
import analytics from '@/features/analytics/AnalyticsPage.tsx?raw';
import subs from '@/features/subscriptions/SubscriptionsPage.tsx?raw';

/**
 * Stress of the numbers (2026-11-11): screens show the SERVER's totals and never
 * re-add money in the client (the server tests pin every sum: backend/tests/
 * test_invariantes_numeros.py). A client-side reduce over amounts would let two
 * screens disagree by a cent.
 */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('Screens render server totals, never client sums', () => {
    it('Análisis: no reduce/sum over amounts; hero, block and bars come from /api/analytics/v2', () => {
        expect(code(analytics)).not.toMatch(/\.reduce\(/);
        expect(code(analytics)).toContain('data.heroe.sale_de_tu_bolsillo');
        expect(code(analytics)).toContain('b.te_quedan');
    });

    it('Suscripciones: monthly and annual totals are the server fields', () => {
        expect(code(subs)).not.toMatch(/\.reduce\(/);
        expect(code(subs)).toContain('Number(data.monthly_total)');
        expect(code(subs)).toContain('Number(data.annual_total)');
    });
});
