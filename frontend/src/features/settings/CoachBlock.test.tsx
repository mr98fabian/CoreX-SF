import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let profile = { tone: 'calido', tone_label: 'Cálido', ai_name: null as string | null, payday_weekday: null, ranking_opt_in: false, ranking_alias: null as string | null };
const apiFetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
        profile = { ...profile, ...JSON.parse(String(init.body)) };
        if (profile.ranking_opt_in && !profile.ranking_alias) profile.ranking_alias = 'Zorro Ámbar 12';
    }
    return profile;
});
vi.mock('@/lib/api', () => ({ apiFetch: (u: string, i?: RequestInit) => apiFetch(u, i) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));

import { CoachBlock } from './CoachBlock';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } apiFetch.mockClear(); });

async function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider client={client}><CoachBlock es /></QueryClientProvider>));
    await flush();
    return host;
}

describe('Tu coach IA', () => {
    it('renders the tone selector and the AI name field from the profile', async () => {
        const el = await render();
        expect(el.textContent).toContain('Tu coach IA');
        expect([...el.querySelectorAll('[role="radio"]')].map((b) => b.textContent)).toEqual(['Cálido', 'Directo', 'Modo pesado']);
        expect(el.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toBe('Cálido');
        expect(el.querySelector('input')?.getAttribute('aria-label')).toBe('Nombre de tu IA');
    });

    it('ranking is opt-in: the switch saves it and reveals the generated alias', async () => {
        const el = await render();
        const sw = el.querySelector('[role="switch"]') as HTMLButtonElement;
        expect(sw.getAttribute('aria-checked')).toBe('false');
        expect(el.querySelector('input[aria-label="Tu alias"]')).toBeNull();
        await act(async () => sw.click());
        await flush();
        expect(apiFetch).toHaveBeenCalledWith('/api/coach-profile', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ ranking_opt_in: true }) }));
        expect((el.querySelector('input[aria-label="Tu alias"]') as HTMLInputElement).value).toBe('Zorro Ámbar 12');
    });

    it('switch: the button is the 44×44 touch target, the 44×24 pill lives inside it', async () => {
        const el = await render();
        const sw = el.querySelector('[role="switch"]') as HTMLButtonElement;
        expect(sw.className).toMatch(/\bh-11\b/);
        expect(sw.className).toMatch(/\bw-11\b/);
        expect(sw.className).toContain('bg-transparent');
        expect(sw.className).not.toMatch(/\bh-6\b|rounded-full|bg-kx-amber/); // the global coarse-pointer min 44×44 can't inflate the pill
        const track = sw.querySelector('[data-kx="switch-track"]') as HTMLSpanElement;
        expect(track.tagName).toBe('SPAN');
        expect(track.className).toMatch(/\bh-6\b/);
        expect(track.className).toMatch(/\bw-11\b/);
        expect(track.className).toContain('rounded-full');
        const knob = track.querySelector('span') as HTMLSpanElement;
        const on = sw.getAttribute('aria-checked') === 'true';
        expect(knob.className).toContain(on ? 'translate-x-[22px]' : 'translate-x-0.5');
        expect(track.className.includes('bg-kx-amber')).toBe(on);
    });

    it('saves the tone and the name with PATCH /api/coach-profile', async () => {
        const el = await render();
        const pesado = [...el.querySelectorAll('[role="radio"]')].find((b) => b.textContent === 'Modo pesado') as HTMLButtonElement;
        await act(async () => pesado.click());
        await flush();
        expect(apiFetch).toHaveBeenCalledWith('/api/coach-profile', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ tone: 'pesado' }) }));
        expect(el.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toBe('Modo pesado');

        const input = el.querySelector('input') as HTMLInputElement;
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        await act(async () => { setValue.call(input, 'Muse'); input.dispatchEvent(new Event('input', { bubbles: true })); });
        await act(async () => { input.focus(); input.blur(); });
        await flush();
        expect(apiFetch).toHaveBeenCalledWith('/api/coach-profile', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ ai_name: 'Muse' }) }));
    });
});
