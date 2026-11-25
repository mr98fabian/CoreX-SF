/**
 * Where the cut of a copper line sits (decisión b de Fabian, 2026-11-25): by TIME — whole
 * calendar months travelled of the plan — with dates that already exist. No money math and
 * no new backend field. Dates are plain YYYY-MM-DD strings (no Date: no timezone drift).
 */
function ym(iso: string): number {
    const [y, m] = iso.slice(0, 7).split('-').map(Number);
    return y * 12 + (m - 1);
}

/** Whole calendar months from `from` to `to` (negative if `to` is earlier). */
export function monthsBetween(from: string, to: string): number {
    return ym(to) - ym(from);
}

/** 0…1: months travelled from `start` to `today`, over the plan's months from `start` to `end`. */
export function timeTravelled(start: string, end: string, today: string): number {
    const total = monthsBetween(start, end);
    if (total <= 0) return 1;
    return Math.min(1, Math.max(0, monthsBetween(start, today) / total));
}
