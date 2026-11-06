import { describe, it, expect } from 'vitest';
import { groupAiBursts, BURST_GAP_MS } from './activityGroups';

const t0 = Date.UTC(2026, 10, 5, 19, 44);
const ai = (i: number, label = 'Amex Gold · saldo $1 → $2', minutesAgo = i) =>
    ({ key: `a${i}`, kind: 'ai', date: '2026-11-05', ts: t0 - minutesAgo * 60_000, label });

describe('groupAiBursts', () => {
    it('collapses 53 identical AI actions in a burst into one row of 53', () => {
        const rows = groupAiBursts(Array.from({ length: 53 }, (_, i) => ai(i, 'Tu IA corrigió una cuenta', i * 0.04)));
        expect(rows).toHaveLength(1);
        expect(rows[0].group).toHaveLength(53);
    });

    it('different summaries stay separate', () => {
        const rows = groupAiBursts([ai(0, 'A'), ai(1, 'B'), ai(2, 'A')]);
        expect(rows.map((r) => r.group?.length ?? 1)).toEqual([1, 1, 1]);
    });

    it('a non-AI entry or a long gap breaks the burst', () => {
        const tx = { key: 't1', kind: 'payment', date: '2026-11-05' };
        expect(groupAiBursts([ai(0), tx, ai(1)])).toHaveLength(3);
        const far = { ...ai(1), ts: t0 - BURST_GAP_MS - 60_000 };
        expect(groupAiBursts([ai(0), far])).toHaveLength(2);
    });

    it('keeps single entries untouched (no group)', () => {
        const [row] = groupAiBursts([ai(0)]);
        expect(row.group).toBeUndefined();
        expect(row.key).toBe('a0');
    });
});
