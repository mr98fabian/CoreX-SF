import { describe, it, expect, beforeEach } from 'vitest';
import { recordStartingDebt, getStartingDebt } from './startingDebt';

describe('startingDebt', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('returns null when no baseline has been recorded', () => {
        expect(getStartingDebt()).toBeNull();
    });

    it('records the first positive debt snapshot', () => {
        recordStartingDebt(45_000);
        expect(getStartingDebt()).toBe(45_000);
    });

    it('never overwrites an existing baseline (progress contrast stays honest)', () => {
        recordStartingDebt(45_000);
        recordStartingDebt(99_999);
        expect(getStartingDebt()).toBe(45_000);
    });

    it('ignores zero or negative debt snapshots', () => {
        recordStartingDebt(0);
        expect(getStartingDebt()).toBeNull();
        recordStartingDebt(-100);
        expect(getStartingDebt()).toBeNull();
    });
});
