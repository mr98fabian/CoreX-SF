/**
 * Which debts JUST reached $0 in this session (for the falling PAGADA stamp).
 * Remembers the last stage seen per account across screens (module scope, SPA
 * session); the first load only records, so nothing "drops" on a cold start.
 * A detected drop stays pending until it has been committed once, so React
 * StrictMode's double render (dev) doesn't swallow it.
 */
import { useEffect, useMemo } from 'react';
import type { Stage } from '@/lib/stage';

const seen = new Map<number, Stage>();
const pending = new Set<number>();
const done = new Set<number>();

export function useJustPaid(accounts: { id: number; stage: Stage }[]): Set<number> {
    const fresh = useMemo(() => {
        for (const a of accounts) {
            const before = seen.get(a.id);
            if (before && before !== 'paid' && a.stage === 'paid' && !done.has(a.id)) pending.add(a.id);
            seen.set(a.id, a.stage);
        }
        return new Set(pending);
    }, [accounts]);
    useEffect(() => {
        for (const id of fresh) { pending.delete(id); done.add(id); }
    }, [fresh]);
    return fresh;
}
