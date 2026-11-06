/**
 * Collapse bursts of identical AI actions in Actividad (e.g. 53 × "Tu IA
 * corrigió una cuenta") into one row "×N · 19:42–19:44", expandable.
 * A burst = consecutive AI entries (in the list's order) with the same label
 * (summary, or the generic phrase when there is none), on the same day, each
 * within BURST_GAP_MS of the previous one. Non-AI entries break a burst.
 */
export const BURST_GAP_MS = 30 * 60 * 1000;

export interface Groupable {
    key: string;
    kind: string;
    date: string;      // YYYY-MM-DD (local)
    ts?: number;       // epoch ms (AI entries)
    label?: string;    // what identifies "the same action"
}

export type Grouped<T extends Groupable> = T & { group?: T[] };

export function groupAiBursts<T extends Groupable>(entries: T[]): Grouped<T>[] {
    const out: Grouped<T>[] = [];
    for (const e of entries) {
        const last = out[out.length - 1];
        const lastItem = last?.group ? last.group[last.group.length - 1] : last;
        const sameBurst = !!last && e.kind === 'ai' && last.kind === 'ai' && e.label === last.label && e.date === last.date
            && e.ts !== undefined && lastItem?.ts !== undefined && Math.abs(lastItem.ts - e.ts) <= BURST_GAP_MS;
        if (sameBurst) {
            last.group = last.group ? [...last.group, e] : [last as T, e];
        } else {
            out.push({ ...e });
        }
    }
    return out;
}
