import { describe, it, expect } from 'vitest';
import { buildMonths, debtOn, debtColor, paydaysIn } from './calendarSeries';

const NOV = new Date(2026, 10, 4);
const timeline = [
    { date: '2026-11-01', total_balance: 24000 },
    { date: '2026-12-01', total_balance: 18000 },
    { date: '2027-01-01', total_balance: 12000 },
    { date: '2027-02-01', total_balance: 6000 },
    { date: '2027-03-01', total_balance: 0 },
];

describe('buildMonths', () => {
    it('runs from the current month to the freedom month plus one green month', () => {
        const months = buildMonths(timeline, 30000, NOV);
        expect(months.map((m) => `${m.year}-${m.month}`)).toEqual(['2026-10', '2026-11', '2027-0', '2027-1', '2027-2', '2027-3']);
        expect(months[0]).toMatchObject({ start: 30000, end: 24000, zeroDay: null });
        expect(months[1]).toMatchObject({ start: 24000, end: 18000 });
        expect(months.at(-1)).toMatchObject({ start: 0, end: 0, zeroDay: null });
    });

    it('estimates the $0 day inside the freedom month from the previous pace', () => {
        const march = buildMonths(timeline, 30000, NOV)[4];
        // 6000 left at a pace of 6000/month → whole month; day = 31
        expect(march.zeroDay).toBe(31);
        const fast = buildMonths([{ date: '2026-11-01', total_balance: 1000 }, { date: '2026-12-01', total_balance: 0 }], 5000, NOV)[1];
        expect(fast.zeroDay).toBe(Math.ceil((1000 / 4000) * 31)); // 8
    });

    it('handles no debt: a single green month', () => {
        expect(buildMonths([], 0, NOV)).toHaveLength(1);
    });
});

describe('debtOn', () => {
    it('interpolates linearly and is 0 from the zero day on', () => {
        const months = buildMonths([{ date: '2026-11-01', total_balance: 1000 }, { date: '2026-12-01', total_balance: 0 }], 5000, NOV);
        expect(debtOn(months[0], 1)).toBe(5000);
        expect(debtOn(months[0], 30)).toBe(1000);
        expect(debtOn(months[1], months[1].zeroDay!)).toBe(0);
        expect(debtOn(months[1], 31)).toBe(0);
    });
});

describe('debtColor', () => {
    it('is green at $0 and red at the max', () => {
        expect(debtColor(0, 100).background).toBe('rgb(52,211,153)');
        expect(debtColor(100, 100).background).toContain('rgba(220,38,38');
    });
});

describe('paydaysIn', () => {
    it('marks Fridays for a weekly paycheck (day_of_week 4 = Friday)', () => {
        const days = paydaysIn(2026, 10, [{ frequency: 'weekly', day_of_week: 4, is_income: true }]);
        expect([...days]).toEqual([6, 13, 20, 27]);
    });
    it('ignores expenses', () => {
        expect(paydaysIn(2026, 10, [{ frequency: 'weekly', day_of_week: 4, category: 'expense' }]).size).toBe(0);
    });
});
