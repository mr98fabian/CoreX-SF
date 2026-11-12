import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const apiFetch = vi.fn(async (path: string) => {
    if (path === '/api/dashboard') return { total_debt: 1000, liquid_cash: 200 };
    if (path === '/api/velocity/freedom-path') return { timeline: [], freedom_date: '2027-01-01', total_months: 2 };
    if (path === '/api/subscriptions') return { items: [], monthly_total: '0', annual_total: '0' };
    return [];
});
// The 4 summary calls; the summary no longer fetches subscriptions (calendar events are server-side)
const summaryCalls = () => apiFetch.mock.calls.filter(([p]) => p !== '/api/subscriptions').length;
const subsCalls = () => apiFetch.mock.calls.filter(([p]) => p === '/api/subscriptions').length;
vi.mock('@/lib/api', () => ({ apiFetch: (p: string) => apiFetch(p) }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }));

import { useKxSummary } from './useKxSummary';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const latest: { current: ReturnType<typeof useKxSummary> | null } = { current: null };
function Probe() {
    const s = useKxSummary();
    useEffect(() => { latest.current = s; }); // test probe: expose the hook's result
    return <span>{s.loading ? 'loading' : String(s.totalDebt)}</span>;
}

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;
beforeEach(() => {
    apiFetch.mockClear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});
afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(host);
});

async function mount() {
    await act(async () => {
        root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe('useKxSummary shares one cached query', () => {
    it('a second mount within staleTime paints from cache without repeating the 4 calls', async () => {
        await mount();
        expect(summaryCalls()).toBe(4);
        expect(subsCalls()).toBe(0); // the calendar's subscriptions come from /api/calendar/events now
        expect(host.textContent).toBe('1000');

        await act(async () => root.render(<QueryClientProvider client={client}><span>otra pantalla</span></QueryClientProvider>));
        await mount();
        expect(host.textContent).toBe('1000'); // instantly, from cache
        expect(summaryCalls()).toBe(4); // no new calls
        expect(subsCalls()).toBe(0); // the calendar's subscriptions come from /api/calendar/events now
    });

    it('reload() invalidates the entry and refetches the 4 calls', async () => {
        await mount();
        await act(async () => { await latest.current!.reload(); });
        expect(summaryCalls()).toBe(8);
    });
});
