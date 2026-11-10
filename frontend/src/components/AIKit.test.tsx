import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import guideSrc from '@/features/settings/IAGuidePage.tsx?raw';
import kitSrc from '@/lib/aiKit.ts?raw';
import mcpSrc from '../../../mcp/korex_mcp.py?raw';

const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ isDemo: false }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { ConnectAI } from './ConnectAI';
import { AI_INSTRUCTIONS, kitConfig, TOKEN_PLACEHOLDER } from '@/lib/aiKit';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined);
beforeEach(() => {
    apiFetch.mockReset();
    writeText.mockClear();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

const TOKEN = 'kx_live_ABC123secret';
async function renderConnect() {
    apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
        if (url === '/api/tokens/access') return { allowed: true, reason: null };
        if (url === '/api/tokens' && opts?.method === 'POST') return { token: TOKEN };
        if (url === '/api/tokens') return [{ id: 1, name: 'Viejo', prefix: 'kx_live_OLD', scopes: ['read:accounts'], created_at: '2026-11-01', last_used_at: null, active: true }];
        return null;
    });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><ConnectAI /></MemoryRouter>));
    await tick();
    return host;
}

// Personal names (the owner's own assistant, the owner) never reach user-facing instructions
const PERSONAL = /mijo|fabi[aá]n|\bmuse\b/i;

describe('Kit para tu IA', () => {
    it('the kit shows only right after creating a token, never when listing tokens', async () => {
        const el = await renderConnect();
        expect(el.textContent).toContain('Viejo');
        expect(el.querySelector('[data-testid="ai-kit"]')).toBeNull();
        const create = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Crear token'))!;
        await act(async () => create.click());
        await tick();
        const kit = el.querySelector('[data-testid="ai-kit"]')!;
        expect(kit).not.toBeNull();
        expect(kit.querySelector('[data-testid="kit-once"]')!.textContent).toBe('Este kit solo se muestra ahora, igual que tu token. Guárdalo.');
    });

    it('the copied configuration carries the created token; "Copiado" confirms', async () => {
        const el = await renderConnect();
        await act(async () => [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Crear token'))!.click());
        await tick();
        await act(async () => el.querySelector<HTMLButtonElement>('[data-testid="copy-config"]')!.click());
        const copied = writeText.mock.calls[0][0];
        const json = JSON.parse(copied.slice(0, copied.indexOf('\n\n')));
        expect(json.mcpServers.korex.env.KOREX_API_TOKEN).toBe(TOKEN);
        expect(json.mcpServers.korex.args[0]).toContain('<RUTA_DEL_MCP>');
        expect(copied).toContain(`claude mcp add korex --env KOREX_API_TOKEN=${TOKEN}`);
        expect(el.querySelector('[data-testid="copy-config"]')!.textContent).toBe('Copiado');
        await act(async () => el.querySelector<HTMLButtonElement>('[data-testid="copy-instructions"]')!.click());
        expect(writeText.mock.calls[1][0]).toBe(AI_INSTRUCTIONS);
    });

    it('the tutorial version uses the <TU_TOKEN> placeholder', () => {
        expect(JSON.parse(kitConfig().split('\n\n')[0]).mcpServers.korex.env.KOREX_API_TOKEN).toBe(TOKEN_PLACEHOLDER);
        expect(guideSrc).toContain('<AIKit es={es} />');
    });

    it('instructions keep the house rules, neutral', () => {
        for (const rule of ['Nunca muevas dinero', 'corte', 'confirmación escrita', 'Una idea y una misión por mensaje', 'Juez de compras', 'Silencio nocturno', 'puede cambiar']) {
            expect(AI_INSTRUCTIONS).toContain(rule);
        }
    });
});

describe('Guardián: sin nombres personales en lo que se envía a los usuarios', () => {
    it('the accounts section never promises a Plaid connection inside the KoreX app', () => {
        expect(AI_INSTRUCTIONS).toContain('TUS CUENTAS, SIEMPRE AL DÍA');
        expect(AI_INSTRUCTIONS).toContain('conector de finanzas de su propia plataforma');
        expect(AI_INSTRUCTIONS).toContain('nunca dentro de KoreX');
        expect(AI_INSTRUCTIONS).toMatch(/Prohibido pedir usuario o contraseña del banco/);
        expect(AI_INSTRUCTIONS).toMatch(/últimos 4 dígitos/);
        expect(AI_INSTRUCTIONS).toMatch(/saldo, APR, pago mínimo y fecha de corte/);
        // Every line that mentions Plaid routes it through the user's own AI platform
        for (const line of AI_INSTRUCTIONS.split('\n').filter((l) => /plaid/i.test(l))) {
            expect(line).toContain('su propia plataforma');
        }
        // No promise of an in-app connection anywhere in user-facing instructions
        const inApp = /(conecta|vincula|enlaza)[^.\n]*(banco|bancarias|Plaid)[^.\n]*(en|desde|dentro de) (la app de )?KoreX|KoreX (conecta|se conecta|vincula)[^.\n]*(banco|Plaid)|Plaid (en|dentro de) KoreX/i;
        expect('Conecta tu banco con Plaid dentro de KoreX').toMatch(inApp); // the guard bites
        expect('KoreX se conecta a tu banco').toMatch(inApp);
        for (const [name, text] of [['AI_INSTRUCTIONS', AI_INSTRUCTIONS.replace('nunca dentro de KoreX', '')], ['IAGuidePage', guideSrc]]) {
            expect(text, name).not.toMatch(inApp);
        }
    });

    it('IAGuidePage, the kit instructions and the MCP INSTRUCTIONS have no "Mijo" / "Fabian"', () => {
        const instructions = mcpSrc.slice(mcpSrc.indexOf('INSTRUCTIONS = """'), mcpSrc.indexOf('"""', mcpSrc.indexOf('INSTRUCTIONS = """') + 20));
        expect(instructions.length).toBeGreaterThan(200);
        for (const [name, text] of [['IAGuidePage', guideSrc], ['aiKit', kitSrc], ['AI_INSTRUCTIONS', AI_INSTRUCTIONS], ['MCP INSTRUCTIONS', instructions]]) {
            expect(text, name).not.toMatch(PERSONAL);
        }
    });
});
