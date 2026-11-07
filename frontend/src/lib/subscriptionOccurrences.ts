/**
 * Recurring subscriptions projected onto calendar days (frontend-only, from
 * GET /api/subscriptions). Only ACTIVE ones with a next_charge_date appear:
 *  - monthly: the anchor's day every month, clamped to month end (31 → 30/29/28)
 *  - weekly:  every 7 days from the anchor, in both directions, across months
 *  - annual:  only its own date
 * Not deduplicated against cashflow items in v1 (a sub also typed as a bill counts twice).
 */
import type { RecurringSub } from '@/features/subscriptions/subscriptionText';

const DAY_MS = 86_400_000;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** YYYY-MM-DD anchored at noon so negative timezones keep the day. */
const anchorOf = (iso: string) => new Date(`${iso}T12:00:00`);
const noon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);

export function subOccursOn(s: Pick<RecurringSub, 'status' | 'frequency' | 'next_charge_date'>, date: Date): boolean {
    if (s.status !== 'active' || !s.next_charge_date) return false;
    const a = anchorOf(s.next_charge_date);
    if (Number.isNaN(a.getTime())) return false;
    const d = noon(date);
    if (s.frequency === 'monthly') return d.getDate() === Math.min(a.getDate(), daysIn(d.getFullYear(), d.getMonth()));
    if (s.frequency === 'weekly') return Math.round((d.getTime() - a.getTime()) / DAY_MS) % 7 === 0;
    return d.getFullYear() === a.getFullYear() && d.getMonth() === a.getMonth() && d.getDate() === a.getDate();
}

export function subsOn<T extends Pick<RecurringSub, 'status' | 'frequency' | 'next_charge_date'>>(subs: T[], date: Date): T[] {
    return subs.filter((s) => subOccursOn(s, date));
}
