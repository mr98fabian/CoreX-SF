/**
 * S-02b: Ajustes → Conecta tu IA leads with "Conectar por enlace" (the remote MCP + OAuth, open);
 * the token kit for the local MCP and the token list move, unchanged, into "Opciones avanzadas"
 * (collapsed, at the end). Real LanguageProvider: Spanish first, tú, no assistant brand.
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
import langSrc from '@/contexts/LanguageContext.tsx?raw';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Row = { id: number; name: string; scopes: string[]; created_at: string; last_used_at: string | null; active: boolean; source: 'manual' | 'oauth' };
const MANUAL: Row = { id: 1, name: 'Laptop', scopes: ['read:accounts'], created_at: '2026-11-20', last_used_at: null, active: true, source: 'manual' };
const OAUTH: Row = { id: 7, name: 'Mi asistente', scopes: ['read:accounts'], created_at: '2026-11-21', last_used_at: null, active: true, source: 'oauth' };

let host: HTMLDivElement | null = null;
let root: Root;
const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const byId = (id: string) => host!.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

async function render(rows: Row[] = [MANUAL, OAUTH], access = { allowed: true, reason: null as string | null }) {
    apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
        if (url === '/api/tokens/access') return access;
        if (url === '/api/tokens' && opts?.method === 'POST') return { token: 'kx_new_SECRET' };
        if (url === '/api/tokens') return rows;
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

describe('Conectar por enlace (main path, open)', () => {
    it('3 steps, the URL with Copiar, the benefit and the safety line', async () => {
        await render();
        const main = byId('link-path')!;
        expect(main.textContent).toContain('Conectar por enlace');
        const steps = [...byId('link-steps')!.querySelectorAll(':scope > li')];
        expect(steps).toHaveLength(3);
        expect(steps[0].textContent).toContain('Abre tu asistente.');
        expect(steps[0].textContent).toContain('busca dónde agregar un conector o un servidor MCP');
        expect(steps[1].textContent).toContain('Pega esta URL');
        expect(steps[1].querySelector('[data-testid="link-url"]')!.textContent).toBe(MCP_REMOTE_URL);
        expect(MCP_REMOTE_URL).toBe('https://corex-sf-production.up.railway.app/mcp');
        expect(steps[2].textContent).toBe('3Inicia sesión en KoreX y toca Autorizar.');
        expect(byId('link-benefit')!.textContent).toBe('Funciona desde tu teléfono. No necesitas computadora.');
        expect(byId('link-safety')!.textContent).toBe('Tu asistente nunca ve tu contraseña y no podrá registrar pagos ni mover dinero.');
        await act(async () => byId('link-copy')!.click());
        expect(writeText).toHaveBeenCalledWith(MCP_REMOTE_URL);
        expect(byId('link-copy')!.textContent).toBe('Copiado');
        expect(main.textContent).not.toMatch(/claude|chatgpt|gemini|copilot|muse|un toque/i);
    });

    it('shows "Conectado por enlace" from the same token rows, only when an OAuth connection is active', async () => {
        await render();
        expect(byId('link-connected')!.textContent).toBe('Conectado por enlace');
        act(() => root.unmount()); document.body.removeChild(host!); host = null;
        apiFetch.mockClear();
        await render([MANUAL, { ...OAUTH, active: false }]);
        expect(byId('link-connected')).toBeNull();
        expect(apiFetch.mock.calls.filter((c) => c[0] === '/api/tokens').length).toBe(1); // no extra request
    });
});

describe('Opciones avanzadas (collapsed, at the end)', () => {
    it('is closed by default, comes after the link path and holds the kit and the token list', async () => {
        await render();
        const advanced = byId('advanced-token') as HTMLDetailsElement;
        expect(advanced.tagName).toBe('DETAILS');
        expect(advanced.open).toBe(false);
        expect(advanced.querySelector('summary')!.textContent).toBe('Opciones avanzadas');
        expect(advanced.textContent).toContain('Para conectar desde una computadora con el kit local.');
        expect(byId('link-path')!.compareDocumentPosition(advanced) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(host!.lastElementChild!.contains(advanced)).toBe(true);
        // everything the kit had, moved inside
        expect(advanced.querySelector('#ai-token-name')).not.toBeNull();
        expect(advanced.querySelector('[data-testid="kit-toggle"]')).not.toBeNull();
        const list = advanced.querySelector('[data-testid="active-tokens"]')!;
        expect(list.textContent).toContain('Laptop');
        expect(list.querySelector('[data-testid="token-via-link"]')!.textContent).toBe('conectado por enlace');
        expect([...list.querySelectorAll('button')].filter((b) => b.textContent?.includes('Revocar'))).toHaveLength(2);
        await act(async () => { advanced.open = true; advanced.dispatchEvent(new Event('toggle')); });
        expect(advanced.open).toBe(true);
    });

    it('the kit still works inside: create token = same endpoint and scopes; revoke = same call', async () => {
        await render();
        const advanced = byId('advanced-token') as HTMLDetailsElement;
        await act(async () => [...advanced.querySelectorAll('button')].find((b) => b.textContent?.includes('Crear token'))!.click());
        await settle();
        const post = apiFetch.mock.calls.find((c) => c[0] === '/api/tokens' && c[1]?.method === 'POST')!;
        expect(JSON.parse(post[1].body).scopes).toEqual(KIT_TOKEN_SCOPES);
        expect(advanced.open).toBe(true);
        expect(advanced.textContent).toContain('kx_new_SECRET');
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        await act(async () => [...advanced.querySelectorAll('button')].filter((b) => b.textContent?.includes('Revocar'))[0].click());
        expect(apiFetch).toHaveBeenCalledWith('/api/tokens/1', { method: 'DELETE' });
    });

    it('gates unchanged: a free plan sees the lock, neither section', async () => {
        await render([], { allowed: false, reason: 'free_plan' });
        expect(host!.textContent).toContain('Conectar tu IA viene con los planes de pago.');
        expect(byId('link-path')).toBeNull();
        expect(byId('advanced-token')).toBeNull();
    });
});

describe('copy: ES/EN parity, tú, no assistant brand', () => {
    const lines = langSrc.split('\n').filter((l) => /^\s*"(connect\.|conecta\.|oauth\.)/.test(l));
    it('every new key exists in both languages', () => {
        expect(lines.length).toBeGreaterThan(30);
        for (const l of lines) expect(l, l).toMatch(/es: "[^"]+", en: "[^"]+"/);
    });
    it('no voseo and no assistant brand in the Spanish or English copy', () => {
        const text = lines.join('\n');
        expect(text).not.toMatch(/\b(Volvé|Agregá|Tocá|Abrí|Pegá|pegá|preguntale|tenés|podés|querés)\b/);
        expect(text).not.toMatch(/claude|chatgpt|gemini|copilot|\bmuse\b/i);
    });
    it('English renders the same structure', async () => {
        localStorage.setItem('korex-language', 'en');
        await render();
        expect(byId('link-path')!.textContent).toContain('Connect by link');
        expect(byId('link-safety')!.textContent).toBe("Your assistant never sees your password and won't be able to record payments or move money.");
        expect((byId('advanced-token') as HTMLDetailsElement).querySelector('summary')!.textContent).toBe('Advanced options');
    });
});
