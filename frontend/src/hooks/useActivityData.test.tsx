import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const apiFetch = vi.fn(async (path: string) => {
    if (path.startsWith('/api/transactions/all')) return { transactions: [{ id: 1, date: '2026-11-05', amount: 100, description: 'Pago', category: 'payment', account_id: 1, account_name: 'Visa' }] };
    return [];
});
vi.mock('@/lib/api', () => ({ apiFetch: (p: string) => apiFetch(p) }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' } }) }));

import { useActivityData } from './useActivityData';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const latest: { current: ReturnType<typeof useActivityData> | null } = { current: null };
function Probe() {
    const s = useActivityData();
    useEffect(() => { latest.current = s; });
    return <span>{s.loading ? 'loading' : String(s.txs.length)}</span>;
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
    await act(async () => { root.render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

describe('useActivityData shares one cached entry', () => {
    it('re-entering Actividad within staleTime paints from cache with no new calls', async () => {
        await mount();
        expect(apiFetch).toHaveBeenCalledTimes(3);
        expect(host.textContent).toBe('1');
        await act(async () => root.render(<QueryClientProvider client={client}><span>otra pantalla</span></QueryClientProvider>));
        await mount();
        expect(host.textContent).toBe('1');
        expect(apiFetch).toHaveBeenCalledTimes(3);
    });

    it('reload() invalidates and refetches the 3 reads', async () => {
        await mount();
        await act(async () => { await latest.current!.reload(); });
        expect(apiFetch).toHaveBeenCalledTimes(6);
    });
});
