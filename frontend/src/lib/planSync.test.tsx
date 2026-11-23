/**
 * Criterion 3 (misión 2026-11-23-calendario-serie-diaria): a plan write — a payment, a
 * confirmed attack, an account / cashflow / subscription change — refreshes the daily
 * series, and the calendar already on screen paints the new balance without a reload.
 * Real apiFetch (fetch mocked), real QueryProvider, real useKxSummary + DebtCalendar.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } } }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/hooks/useAccounts', () => ({ useAccountLogos: () => () => undefined }));

import { apiFetch } from '@/lib/api';
import { QueryProvider } from '@/providers/QueryProvider';
import { useKxSummary } from '@/hooks/useKxSummary';
import { DebtCalendar } from '@/components/kx/DebtCalendar';
import { PLAN_WRITE } from '@/lib/planEvents';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const ym = `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}`;
const last = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 0).getDate();

let debt = 1000; // the server's projected balance; each plan write "lowers" it
const pathCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/api/velocity/freedom-path')).length;
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url, 'http://x').pathname;
    if (init?.method && init.method !== 'GET') { debt -= 100; return json({ ok: true }); }
    if (path === '/api/dashboard') return json({ total_debt: 1000, liquid_cash: 0 });
    if (path === '/api/velocity/freedom-path') return json({
        timeline: [{ date: ym, total_balance: debt }], freedom_date: `${ym}-01`, total_months: 1,
        daily_series: [{ date: `${ym}-01`, total_balance: debt }, { date: `${ym}-${pad(last)}`, total_balance: debt }],
    });
    return json([]);
});

function CalendarScreen() {
    const s = useKxSummary();
    return s.loading ? null : <DebtCalendar months={s.months} maxDebt={s.totalDebt} />;
}

let host: HTMLDivElement;
let root: Root;
const flush = () => act(async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); });
/** The projected balance the calendar paints on today's cell (its aria-label). */
const todayLabel = () => [...host.querySelectorAll('[role="gridcell"]')]
    .map((c) => c.getAttribute('aria-label') ?? '').find((l) => l.includes(` ${NOW.getDate()} de `)) ?? '';

beforeAll(async () => {
    vi.stubGlobal('fetch', fetchMock);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<QueryProvider><MemoryRouter><CalendarScreen /></MemoryRouter></QueryProvider>));
    await flush();
});
afterAll(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('plan writes refresh the calendar on screen', () => {
    it('paints the first balance', () => {
        expect(todayLabel()).toContain('≈ $1000');
        expect(pathCalls()).toBe(1);
    });

    it.each([
        ['a payment', '/api/transactions', 'POST', 900],
        ['a confirmed attack', '/api/strategy/execute', 'POST', 800],
        ['an account edit', '/api/accounts/3', 'PUT', 700],
        ['a cashflow change', '/api/cashflow/9', 'DELETE', 600],
        ['a subscription change', '/api/subscriptions/2', 'PATCH', 500],
    ])('%s refetches the daily series and repaints', async (_what, url, method, expected) => {
        const before = pathCalls();
        await act(async () => { await apiFetch(url, { method, body: '{}' }); });
        await flush();
        expect(pathCalls()).toBe(before + 1);
        expect(todayLabel()).toContain(`≈ $${expected}`);
    });

    it('a read or a non-plan write changes nothing', async () => {
        const before = pathCalls();
        await act(async () => { await apiFetch('/api/accounts'); await apiFetch('/api/house-goal', { method: 'PUT', body: '{}' }); });
        await flush();
        expect(pathCalls()).toBe(before);
    });

    it('covers every plan write the backend routes take', () => {
        for (const p of ['/api/accounts', '/api/accounts/1/balance', '/api/transactions/manual', '/api/cashflow/1/confirm',
            '/api/user/me/attack-percentage', '/api/user/me/shield', '/api/demo/seed', '/api/plaid/sync_transactions'])
            expect(PLAN_WRITE.test(p), p).toBe(true);
        for (const p of ['/api/push/email', '/api/goals', '/api/house-goal', '/api/engagement/checkin', '/api/accountsx'])
            expect(PLAN_WRITE.test(p), p).toBe(false);
    });
});
