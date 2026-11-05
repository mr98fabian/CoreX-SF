import { describe, it, expect } from 'vitest';
import { findFundingAccount } from './funding';

const acc = (name: string, type: string, bal: number) => ({ name, type, bal });

describe('findFundingAccount', () => {
    it('finds a cash account', () => {
        expect(findFundingAccount([acc('Visa', 'debt', 900), acc('Efectivo', 'cash', 300)])?.name).toBe('Efectivo');
    });
    it('finds a checking account', () => {
        expect(findFundingAccount([acc('Chase', 'checking', 50)])?.name).toBe('Chase');
    });
    it('follows the engine priority: largest positive balance, first on ties', () => {
        const list = [acc('Chase', 'checking', 200), acc('Efectivo', 'cash', 800), acc('Ahorro', 'savings', 800)];
        expect(findFundingAccount(list)?.name).toBe('Efectivo');
    });
    it('skips empty accounts and returns nothing when none qualifies', () => {
        expect(findFundingAccount([acc('Chase', 'checking', 0), acc('Visa', 'debt', 500)])).toBeUndefined();
        expect(findFundingAccount([])).toBeUndefined();
    });
});
