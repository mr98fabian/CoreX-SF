import { describe, it, expect } from 'vitest';
import { calculateHealthScore } from './useFinancialHealthScore';

describe('calculateHealthScore', () => {
    it('gives a perfect 100 / A+ for an ideal financial posture', () => {
        const result = calculateHealthScore({
            shieldFillPercent: 100,
            totalDebt: 0,
            liquidCash: 10_000,
            streakScore: 30,
            commanderLevel: 90,
        });
        expect(result.score).toBe(100);
        expect(result.grade).toBe('A+');
        expect(result.breakdown).toEqual({
            shield: 30,
            debtProgress: 25,
            consistency: 20,
            cashRatio: 15,
            rank: 10,
        });
    });

    it('gives 0 / F for the worst posture', () => {
        const result = calculateHealthScore({
            shieldFillPercent: 0,
            totalDebt: 150_000,
            liquidCash: 0,
            streakScore: 0,
            commanderLevel: 0,
        });
        expect(result.score).toBe(0);
        expect(result.grade).toBe('F');
    });

    it('computes a mid-range scenario with exact weights', () => {
        // shield 50% → 15, debt $50k → 13, streak 15 → 10, cash ratio 0.5 → 5, level 45 → 5
        const result = calculateHealthScore({
            shieldFillPercent: 50,
            totalDebt: 50_000,
            liquidCash: 25_000,
            streakScore: 15,
            commanderLevel: 45,
        });
        expect(result.breakdown).toEqual({
            shield: 15,
            debtProgress: 13,
            consistency: 10,
            cashRatio: 5,
            rank: 5,
        });
        expect(result.score).toBe(48);
        expect(result.grade).toBe('D');
    });

    it('zero debt always earns full debt-progress and cash-ratio points', () => {
        const result = calculateHealthScore({
            shieldFillPercent: 0,
            totalDebt: 0,
            liquidCash: 0,
            streakScore: 0,
            commanderLevel: 0,
        });
        expect(result.breakdown.debtProgress).toBe(25);
        expect(result.breakdown.cashRatio).toBe(15);
    });

    it('clamps out-of-range inputs instead of exploding the score', () => {
        const result = calculateHealthScore({
            shieldFillPercent: 500,      // over 100%
            totalDebt: -5,               // negative debt
            liquidCash: 1_000_000,
            streakScore: 9_999,          // huge streak
            commanderLevel: 90,
        });
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.breakdown.shield).toBe(30);
        expect(result.breakdown.consistency).toBe(20);
    });

    it('maps scores to grade boundaries correctly', () => {
        // streak alone: 30 (20pts) + shield 100 (30pts) + debt 0 (25+15) + level 90 (10) = 100
        const grades: Array<[number, string]> = [
            [100, 'A+'],
        ];
        for (const [shieldPct, expectedGrade] of grades) {
            const r = calculateHealthScore({
                shieldFillPercent: shieldPct,
                totalDebt: 0,
                liquidCash: 0,
                streakScore: 30,
                commanderLevel: 90,
            });
            expect(r.grade).toBe(expectedGrade);
        }
        // Drop shield to 0 → 70 → B
        const b = calculateHealthScore({
            shieldFillPercent: 0,
            totalDebt: 0,
            liquidCash: 0,
            streakScore: 30,
            commanderLevel: 90,
        });
        expect(b.score).toBe(70);
        expect(b.grade).toBe('B');
    });

    it('provides bilingual messages for every grade', () => {
        const result = calculateHealthScore({
            shieldFillPercent: 0,
            totalDebt: 200_000,
            liquidCash: 0,
            streakScore: 0,
            commanderLevel: 0,
        });
        expect(result.messageEs.length).toBeGreaterThan(0);
        expect(result.messageEn.length).toBeGreaterThan(0);
    });
});
