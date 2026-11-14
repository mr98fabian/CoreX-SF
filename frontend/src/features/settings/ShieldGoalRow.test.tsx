import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// A tiny fake server: GET /api/peace-shield reads `target`, PUT /api/user/me/shield writes it
let target = 1000;
const apiFetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/user/me/shield' && init?.method === 'PUT') {
        target = JSON.parse(String(init.body)).target;
        return { ok: true };
    }
    if (url === '/api/peace-shield') return { shield_target: target, current_fill: 600, fill_percentage: (600 / target) * 100 };
    throw new Error(`unexpected ${url}`);
});
vi.mock('@/lib/api', () => ({ apiFetch: (u: string, i?: RequestInit) => apiFetch(u, i) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import { ShieldGoalRow } from './ShieldGoalRow';
import settingsHomeSrc from './SettingsHome.tsx?raw';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let qc: QueryClient;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function render() {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } }); // a fresh client = a page reload
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<QueryClientProvider client={qc}><ShieldGoalRow es /></QueryClientProvider>));
    await flush();
    return host;
}
function unmount() {
    if (root) act(() => root!.unmount());
    if (host) document.body.removeChild(host);
    root = null; host = null;
}
const input = () => host!.querySelector<HTMLInputElement>('[data-testid="shield-goal-input"]')!;
const saveBtn = () => host!.querySelector<HTMLButtonElement>('[data-testid="shield-goal-save"]')!;
async function type(v: string) {
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), v);
        input().dispatchEvent(new Event('input', { bubbles: true }));
    });
}

beforeEach(() => { target = 1000; apiFetch.mockClear(); });
afterEach(unmount);

describe('Ajustes → Escudo de paz', () => {
    it('shows the current goal from GET /api/peace-shield', async () => {
        const el = await render();
        expect(input().value).toBe('1000');
        expect(el.querySelector('[data-testid="shield-goal-fill"]')!.textContent).toBe('Hoy tienes $600.00 de $1000.00 · 60%');
        expect(saveBtn().disabled).toBe(true); // nothing changed yet
    });

    it('saves with PUT /api/user/me/shield {target}, persists after a reload and refreshes the dashboard data', async () => {
        await render();
        const invalidate = vi.spyOn(qc, 'invalidateQueries');
        await type('2500');
        expect(saveBtn().disabled).toBe(false);
        await act(async () => saveBtn().click());
        await flush();
        expect(apiFetch).toHaveBeenCalledWith('/api/user/me/shield', { method: 'PUT', body: JSON.stringify({ target: 2500 }) });
        const keys = invalidate.mock.calls.map(([f]) => JSON.stringify((f as { queryKey: unknown }).queryKey));
        expect(keys).toEqual(expect.arrayContaining(['["peace-shield"]', '["kx-summary"]', '["velocity-compare"]']));
        // reload: a new page reads the server again
        unmount();
        await render();
        expect(input().value).toBe('2500');
    });

    it('rejects a negative or empty goal (no request)', async () => {
        const el = await render();
        await type('-5');
        expect(saveBtn().disabled).toBe(true);
        expect(el.querySelector('[data-testid="shield-goal-error"]')).not.toBeNull();
        await type('');
        expect(saveBtn().disabled).toBe(true);
        expect(apiFetch).not.toHaveBeenCalledWith('/api/user/me/shield', expect.anything());
    });

    it('lives on the Ajustes screen', () => {
        expect(settingsHomeSrc).toContain('<ShieldGoalRow es={es} />');
    });
});
