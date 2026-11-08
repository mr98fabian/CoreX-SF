import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const apiFetch = vi.fn(async (path: string) => {
    if (path.startsWith('/api/transactions/all')) return { transactions: [{ id: 1, date: '2026-11-05', amount: 100, description: 'Pago Visa', category: 'payment', account_id: 1, account_name: 'Visa' }] };
    if (path === '/api/subscriptions') return { subscriptions: [] };
    return [];
});
vi.mock('@/lib/api', () => ({ apiFetch: (p: string) => apiFetch(p) }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n}`, formatDateShort: (d: string) => d }) }));
vi.mock('@/hooks/useKxSummary', async (orig) => ({ ...(await orig<object>()), fetchKxSummary: vi.fn(async () => ({})) }));

import ActivityPage from './ActivityPage';
import { ACTIVITY_KEY } from '@/hooks/useActivityData';
import { prefetchSections } from '@/lib/prefetchRoutes';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
const ACT = ['/api/transactions/all', '/api/strategy/executed-logs', '/api/tokens/audit'];
const activityCalls = () => apiFetch.mock.calls.filter(([p]) => ACT.some((a) => p.startsWith(a))).length;
beforeEach(() => {
    apiFetch.mockClear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); document.body.removeChild(host); });

async function show(node: React.ReactNode) {
    await act(async () => { root.render(<QueryClientProvider client={client}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe('Actividad from cache', () => {
    it('the second mount renders from cache, synchronously and with no new calls', async () => {
        await show(<ActivityPage />);
        expect(host.textContent).toContain('Pagaste $100 a Visa');
        expect(activityCalls()).toBe(3);
        await show(<span>otra sección</span>);
        await act(async () => { root.render(<QueryClientProvider client={client}><MemoryRouter><ActivityPage /></MemoryRouter></QueryClientProvider>); });
        expect(host.textContent).toContain('Pagaste $100 a Visa'); // first paint, before any microtask
        expect(host.querySelector('[aria-busy="true"]')).toBeNull();
        expect(activityCalls()).toBe(3);
    });

    it('idle prefetch fills the cache so the first visit needs no request', async () => {
        await act(async () => { prefetchSections(client, 'user-a'); await new Promise((r) => setTimeout(r, 0)); });
        const before = activityCalls();
        await show(<ActivityPage />);
        expect(host.textContent).toContain('Pagaste $100 a Visa');
        expect(activityCalls()).toBe(before);
    });

    it('the summary reload (payment / attack) also invalidates Actividad', async () => {
        const { useKxSummary } = await import('@/hooks/useKxSummary');
        const ref: { reload: () => Promise<unknown> } = { reload: async () => undefined };
        function Probe() { const { reload } = useKxSummary(); useEffect(() => { ref.reload = reload; }); return null; }
        await show(<><ActivityPage /><Probe /></>);
        expect(client.getQueryState([ACTIVITY_KEY, 'user-a'])?.isInvalidated).toBe(false);
        const n = activityCalls();
        await act(async () => { await ref.reload(); });
        expect(activityCalls()).toBe(n + 3);
    });
});
