/**
 * The funding account: where attack money comes from. Same rule as the engine
 * (backend/routers/strategy.py, tactical-gps): any non-debt account with a
 * positive balance (cash, checking, savings…), the largest balance first.
 * One definition for the whole app.
 */
export interface FundingCandidate {
    name: string;
    type: string;
    bal: number;
}

export function findFundingAccount<T extends FundingCandidate>(accounts: readonly T[]): T | undefined {
    let best: T | undefined;
    for (const a of accounts) {
        if (a.type === 'debt' || !(a.bal > 0)) continue;
        if (!best || a.bal > best.bal) best = a; // ties keep list order, like Python's stable sort
    }
    return best;
}
