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
vi.mock('@/hooks/useEffectivePlan', () => ({ useEffectivePlan: () => ({ loading: false, paid: true }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));

import { ConnectAI } from './ConnectAI';
import IAGuidePage from '@/features/settings/IAGuidePage';
import { AI_INSTRUCTIONS, FIRST_ACTIONS, FIRST_ACTIONS_PERMISSION, FIRST_ACTIONS_TRIGGER, KIT_TOKEN_SCOPES, kitConfig, TOKEN_PLACEHOLDER } from '@/lib/aiKit';

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
    it('the kit with the real token shows only right after creating one; listing tokens never shows it', async () => {
        const el = await renderConnect();
        expect(el.textContent).toContain('Viejo');
        expect(el.querySelector('[data-testid="ai-kit"]')).toBeNull();
        const create = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Crear token'))!;
        await act(async () => create.click());
        await tick();
        const kit = el.querySelector('[data-testid="ai-kit"]')!;
        expect(kit).not.toBeNull();
        const once = kit.querySelector('[data-testid="kit-once"]')!.textContent!;
        expect(once).toContain('Tu token solo se muestra ahora');
        expect(once).toContain('El kit lo vuelves a ver cuando quieras');
        expect(once).not.toMatch(/kit solo se muestra/);
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
        expect(guideSrc).toContain('<AIKit es={es} onNewToken={newToken} creating={creating} />');
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

describe('Primera conexión: la checklist vive en el MCP y arranca el kit', () => {
    const mcpInstructions = mcpSrc.slice(mcpSrc.indexOf('INSTRUCTIONS = """'), mcpSrc.indexOf('"""', mcpSrc.indexOf('INSTRUCTIONS = """') + 20));

    it('the MCP INSTRUCTIONS carry the PRIMERA CONEXIÓN checklist word for word', () => {
        expect(mcpInstructions).toContain('PRIMERA CONEXIÓN');
        expect(mcpInstructions).toContain(FIRST_ACTIONS_TRIGGER);
        FIRST_ACTIONS.forEach((a, i) => expect(mcpInstructions).toContain(`${i + 1}. ${a}`));
        expect(mcpInstructions).toContain(FIRST_ACTIONS_PERMISSION);
        // the three promises the mission asks for
        expect(mcpInstructions).toMatch(/vía Plaid con el conector de finanzas de su propia plataforma/);
        expect(mcpInstructions).toMatch(/nunca dentro de KoreX/);
        expect(mcpInstructions).toMatch(/nunca pidiendo usuario, contraseña ni códigos del banco en el chat/);
        expect(mcpInstructions).toMatch(/TODAS las cuentas/);
        expect(mcpInstructions).toMatch(/qué quedó cargado, qué no y por qué/);
        expect(mcpInstructions).toMatch(/Nunca lo dejes con KoreX en cero sin explicarle/);
    });

    it('the instructions the user pastes start with PASO 1 (the same checklist)', () => {
        const sections = AI_INSTRUCTIONS.split('\n\n');
        expect(sections[1].startsWith('PASO 1 · PRIMERAS ACCIONES DE TU ASISTENTE')).toBe(true);
        FIRST_ACTIONS.forEach((a) => expect(sections[1]).toContain(a));
    });

    it('the kit opens with the first-actions block, before configuration and instructions', async () => {
        const el = await renderConnect();
        await act(async () => el.querySelector<HTMLButtonElement>('[data-testid="kit-toggle"]')!.click());
        const kit = el.querySelector('[data-testid="ai-kit"]')!;
        const order = [...kit.querySelectorAll('[data-testid^="kit-"]')].map((n) => n.getAttribute('data-testid'));
        expect(order[0]).toBe('kit-first-actions');
        expect(order.indexOf('kit-first-actions')).toBeLessThan(order.indexOf('kit-config'));
        expect(kit.querySelector('[data-testid="kit-first-actions"]')!.textContent).toContain('Plaid');
    });

    it('Conecta tu IA shows the kit anytime with <TU_TOKEN>; one tap creates a token with load-accounts permission', async () => {
        const el = await renderConnect();
        await act(async () => el.querySelector<HTMLButtonElement>('[data-testid="kit-toggle"]')!.click());
        expect(el.querySelector('[data-testid="kit-config"]')!.textContent).toContain(TOKEN_PLACEHOLDER);
        expect(el.querySelector('[data-testid="kit-once"]')).toBeNull();
        await act(async () => el.querySelector<HTMLButtonElement>('[data-testid="kit-new-token-btn"]')!.click());
        await tick();
        const post = apiFetch.mock.calls.find(([u, o]) => u === '/api/tokens' && o?.method === 'POST')!;
        const scopes: string[] = JSON.parse(post[1].body).scopes;
        expect(scopes).toEqual(KIT_TOKEN_SCOPES);
        expect(scopes).toContain('write:accounts');
        expect(scopes).not.toContain('write:payments');
        expect(el.querySelector('[data-testid="kit-config"]')!.textContent).toContain(TOKEN);
        expect(el.querySelector('[data-testid="kit-once"]')).not.toBeNull();
    });
});

describe('Guía IA: el kit se ve sin acabar de crear un token', () => {
    it('renders the full kit (checklist, <TU_TOKEN>, one-tap new token) on a fresh visit', async () => {
        apiFetch.mockImplementation(async () => ({ token: TOKEN }));
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        await act(async () => root.render(<MemoryRouter><IAGuidePage /></MemoryRouter>));
        await tick();
        const kit = host.querySelector('[data-testid="ai-kit"]')!;
        expect(kit).not.toBeNull();
        expect(kit.querySelector('[data-testid="kit-first-actions"]')).not.toBeNull();
        expect(kit.querySelector('[data-testid="kit-config"]')!.textContent).toContain(TOKEN_PLACEHOLDER);
        expect(kit.querySelector('[data-testid="kit-instructions"]')!.textContent).toContain('PASO 1');
        await act(async () => kit.querySelector<HTMLButtonElement>('[data-testid="kit-new-token-btn"]')!.click());
        await tick();
        expect(host.querySelector('[data-testid="kit-config"]')!.textContent).toContain(TOKEN);
    });
});

describe('Conecta tu IA: the form starts with the Kit IA scopes', () => {
    it('the ticked scopes are exactly KIT_TOKEN_SCOPES (write:accounts in, write:payments never)', async () => {
        const el = await renderConnect();
        const ticked = [...el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
            .filter((c) => c.checked).map((c) => c.closest('label')!.textContent!.trim());
        expect(ticked).toEqual(['Ver mis cuentas', 'Ver mi panel y ajustes', 'Ver mi plan de acción', 'Simular compras', 'Cuentas y metascambia datos']);
        await act(async () => [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Crear token'))!.click());
        await tick();
        const post = apiFetch.mock.calls.find(([u, o]) => u === '/api/tokens' && o?.method === 'POST')!;
        const scopes: string[] = JSON.parse(post[1].body).scopes;
        expect([...scopes].sort()).toEqual([...KIT_TOKEN_SCOPES].sort());
        expect(scopes).toContain('write:accounts');
        expect(scopes).not.toContain('write:payments');
        expect(KIT_TOKEN_SCOPES).not.toContain('write:payments');
    });
});
