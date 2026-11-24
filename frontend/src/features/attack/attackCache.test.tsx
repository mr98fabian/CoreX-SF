/**
 * Plan de ataque on React Query (misión 2026-11-22-command-center-cache).
 * Criterion 4: a revisit paints the cached plan in the FIRST render, and once stale it refreshes
 * behind. Criterion 5: plan writes invalidate it through the existing chain (apiFetch →
 * lib/planEvents → QueryProvider → lib/planSync.PLAN_QUERY_KEYS), no parallel mechanism.
 * Real apiFetch (fetch mocked) and the real QueryProvider.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } } }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/hooks/useAccounts', () => ({ useAccountLogos: () => () => undefined }));
vi.mock('@/hooks/useKxSummary', () => ({
    useKxSummary: () => ({
        loading: false, error: null, reload: vi.fn(), path: null,
        debts: [{ name: 'Visa', stage: 'debt' }],
        staged: [{ name: 'Checking', type: 'checking', bal: 2000 }],
    }),
}));

import { apiFetch } from '@/lib/api';
import { QueryProvider } from '@/providers/QueryProvider';
import { PLAN_QUERY_KEYS, COMMAND_CENTER_KEY } from '@/lib/planSync';
import AttackPage from './AttackPage';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let attack = 500; // what the server recommends today
const ccCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/api/strategy/command-center')).length;
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method && init.method !== 'GET') { attack -= 100; return json({ ok: true }); }
    if (new URL(url, 'http://x').pathname === '/api/strategy/command-center') return json({
        morning_briefing: {
            recommended_action: { amount: attack, destination: 'Visa', destination_balance: 3000, destination_apr: 24, reason: '' },
            impact: { interest_saved_monthly: 10 },
        },
        confidence_meter: { debts_ranked: [{ name: 'Visa', apr: 24, balance: 3000, is_target: true, daily_cost: 1.97 }] },
    });
    return json([]);
});

let host: HTMLDivElement | null = null;
let root: Root;
const flush = () => act(async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); });
/** Mount and return the text of the FIRST render, before any network round trip. */
function mount(): string {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(<QueryProvider><MemoryRouter><AttackPage /></MemoryRouter></QueryProvider>));
    return host.textContent ?? '';
}
function unmount() {
    if (host) { act(() => root.unmount()); host.remove(); host = null; }
}

beforeAll(() => vi.stubGlobal('fetch', fetchMock));
afterEach(() => vi.useRealTimers());
afterAll(() => { unmount(); vi.unstubAllGlobals(); });

describe('Plan de ataque — cache', () => {
    it('paints the cached plan at once on a revisit, and refreshes it behind once stale', async () => {
        expect(mount()).not.toContain('$500.00'); // first visit ever: nothing cached yet
        await flush();
        expect(host!.textContent).toContain('$500.00');
        expect(ccCalls()).toBe(1);
        unmount();

        // Revisit within the 45 s staleTime: cached plan in the first render, no request
        expect(mount()).toContain('$500.00');
        await flush();
        expect(ccCalls()).toBe(1);
        unmount();

        // Revisit after 45 s: still painted at once from cache, refetched behind, then updated
        attack = 450;
        vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 46_000 });
        expect(mount()).toContain('$500.00');
        await flush();
        expect(ccCalls()).toBe(2);
        expect(host!.textContent).toContain('$450.00');
    });

    it.each([
        ['a payment', '/api/transactions', 'POST', '$350.00'],
        ['a confirmed attack', '/api/strategy/execute', 'POST', '$250.00'],
        ['a debt edit', '/api/accounts/3', 'PUT', '$150.00'],
    ])('a plan write (%s) invalidates it and the screen shows the new number', async (_what, url, method, expected) => {
        if (!host) { mount(); await flush(); }
        const before = ccCalls();
        await act(async () => { await apiFetch(url, { method, body: '{}' }); });
        await flush();
        expect(ccCalls()).toBe(before + 1);
        expect(host!.textContent).toContain(expected);
    });

    it('rides the shared plan keys (no parallel invalidation)', () => {
        expect(PLAN_QUERY_KEYS).toContain(COMMAND_CENTER_KEY);
    });
});
