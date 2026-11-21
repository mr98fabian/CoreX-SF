/**
 * S-02b: Ajustes → Conecta tu IA leads with "Conectar por enlace" (the remote MCP + OAuth);
 * the token kit for the local MCP stays complete and identical, collapsed below as the
 * advanced option. Real LanguageProvider: Spanish first, tú, no assistant named as a requirement.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ isDemo: false }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { LanguageProvider } from '@/contexts/LanguageContext';
import { ConnectAI } from './ConnectAI';
import { KIT_TOKEN_SCOPES } from '@/lib/aiKit';
import { MCP_REMOTE_URL } from '@/lib/backendUrl';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const byId = (id: string) => host!.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

async function render(access = { allowed: true, reason: null as string | null }) {
    apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
        if (url === '/api/tokens/access') return access;
        if (url === '/api/tokens' && opts?.method === 'POST') return { token: 'kx_new_SECRET' };
        if (url === '/api/tokens') return [{ id: 7, name: 'Mi asistente', scopes: ['read:accounts'], created_at: '2026-11-20',
            last_used_at: null, active: true, source: 'oauth' }];
        return null;
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<LanguageProvider><MemoryRouter><ConnectAI /></MemoryRouter></LanguageProvider>));
    await settle();
}

beforeEach(() => {
    apiFetch.mockReset();
    writeText.mockClear();
    localStorage.removeItem('korex-language');
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('Conectar por enlace (main path)', () => {
    it('comes first: 3 steps, the MCP URL with Copiar and a link to /conecta', async () => {
        await render();
        const main = byId('link-path')!;
        expect(main.textContent).toContain('Conectar por enlace');
        expect(main.textContent).toContain('desde el teléfono');
        const steps = [...byId('link-steps')!.querySelectorAll('li')].map((li) => li.textContent?.replace(/^\d/, ''));
        expect(steps).toEqual(['Abre tu asistente.', 'Agrega KoreX con este enlace.', 'Toca Autorizar.']);
        expect(byId('link-url')!.textContent).toBe(MCP_REMOTE_URL);
        expect(byId('link-full')!.getAttribute('href')).toBe('/conecta');
        await act(async () => byId('link-copy')!.click());
        expect(writeText).toHaveBeenCalledWith(MCP_REMOTE_URL);
        expect(byId('link-copy')!.textContent).toBe('Copiado');
        // main path above the advanced one
        expect(main.compareDocumentPosition(byId('advanced-token')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(main.textContent).not.toMatch(/claude|chatgpt|gemini/i);
    });
});

describe('Opción avanzada: conectar con token (computadora)', () => {
    it('starts collapsed and holds the whole kit of today', async () => {
        await render();
        const advanced = byId('advanced-token') as HTMLDetailsElement;
        expect(advanced.tagName).toBe('DETAILS');
        expect(advanced.open).toBe(false);
        expect(advanced.querySelector('summary')!.textContent).toBe('Opción avanzada: conectar con token (computadora)');
        await act(async () => { advanced.open = true; advanced.dispatchEvent(new Event('toggle')); });
        expect(advanced.open).toBe(true);
        expect(advanced.querySelector('#ai-token-name')).not.toBeNull();
        expect([...advanced.querySelectorAll('button')].some((b) => b.textContent?.includes('Crear token'))).toBe(true);
        expect(advanced.querySelector('[data-testid="kit-toggle"]')).not.toBeNull();
        await act(async () => advanced.querySelector<HTMLButtonElement>('[data-testid="kit-toggle"]')!.click());
        expect(advanced.querySelector('[data-testid="ai-kit"]')).not.toBeNull();
    });

    it('creating a token there calls the same endpoint with the same scopes, and stays open on the new token', async () => {
        await render();
        const advanced = byId('advanced-token') as HTMLDetailsElement;
        await act(async () => [...advanced.querySelectorAll('button')].find((b) => b.textContent?.includes('Crear token'))!.click());
        await settle();
        const post = apiFetch.mock.calls.find((c) => c[0] === '/api/tokens' && c[1]?.method === 'POST')!;
        expect(JSON.parse(post[1].body).scopes).toEqual(KIT_TOKEN_SCOPES);
        expect(JSON.parse(post[1].body).scopes).not.toContain('write:payments');
        expect(advanced.open).toBe(true);
        expect(advanced.textContent).toContain('kx_new_SECRET');
    });

    it('the active list (link connections too) stays visible and revocable outside the collapsed section', async () => {
        await render();
        const row = byId('token-via-link')!;
        expect(row.textContent).toBe('conectado por enlace');
        expect(byId('advanced-token')!.contains(row)).toBe(false);
        expect([...host!.querySelectorAll('button')].some((b) => b.textContent?.includes('Revocar'))).toBe(true);
    });
});

describe('gates unchanged', () => {
    it('free plan: the lock message, neither path', async () => {
        await render({ allowed: false, reason: 'free_plan' });
        expect(host!.textContent).toContain('Conectar tu IA viene con los planes de pago.');
        expect(byId('link-path')).toBeNull();
        expect(byId('advanced-token')).toBeNull();
    });
});
