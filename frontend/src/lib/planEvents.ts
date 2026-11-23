/**
 * Plan-changing writes → one signal (misión 2026-11-23-calendario-serie-diaria).
 * apiFetch calls notifyPlanWrite after every successful write; when the path is one
 * that moves the plan (balances, payments, attacks, cashflow, subscriptions, attack
 * %, shield, seeds), every listener runs — QueryProvider uses it to refresh the
 * plan's data (lib/planSync), so the calendar's daily series never goes stale and
 * a new mutation screen needs no hand-written invalidation. No imports on purpose:
 * api.ts depends on this file.
 */
export const PLAN_WRITE = /^\/api\/(accounts|transactions|cashflow|subscriptions|strategy\/execute|user\/me\/(attack-percentage|shield)|demo\/seed|dev\/seed-stress-test|plaid\/(import_accounts|sync_transactions))(\/|\?|$)/;

type Listener = (path: string) => void;
const listeners = new Set<Listener>();

export function onPlanWrite(fn: Listener): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
}

/** `method` defaults to GET (a read never notifies). */
export function notifyPlanWrite(url: string, method = 'GET'): void {
    if (method.toUpperCase() === 'GET') return;
    let path = url;
    try { path = new URL(url, 'http://local').pathname; } catch { /* keep as is */ }
    if (!PLAN_WRITE.test(path)) return;
    for (const fn of listeners) fn(path);
}
