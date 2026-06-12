/**
 * Starting-debt snapshot — baseline for the BeforeAfterCard progress contrast.
 * Stored once in localStorage on the user's first dashboard load.
 */

const STORAGE_KEY = 'korex_starting_debt';

/** Call this on first dashboard load to snapshot starting debt */
export function recordStartingDebt(totalDebt: number): void {
    if (!localStorage.getItem(STORAGE_KEY) && totalDebt > 0) {
        localStorage.setItem(STORAGE_KEY, totalDebt.toString());
    }
}

export function getStartingDebt(): number | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseFloat(raw) : null;
}
