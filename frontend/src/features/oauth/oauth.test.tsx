/**
 * S-02 frontend: the consent screen an assistant sends the user to, and /conecta. Copy comes
 * from LanguageContext (the real provider here, Spanish first).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a), API_BASE: '',
    MCP_REMOTE_URL: 'https://corex-sf-production.up.railway.app/mcp' }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
const auth = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null, loading: false }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ ...auth, isDemo: false }) }));

import { LanguageProvider } from '@/contexts/LanguageContext';
import ConsentPage from './ConsentPage';
import ConectaPage from './ConectaPage';
import { returnToOr } from '@/lib/returnTo';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SCOPE_LABELS = [
    { scope: 'read:accounts', label: 'Ver mis cuentas' }, { scope: 'read:dashboard', label: 'Ver mi panel y ajustes' },
    { scope: 'read:plan', label: 'Ver mi plan de acción' }, { scope: 'write:payments', label: 'Registrar pagos' },
    { scope: 'write:accounts', label: 'Cuentas y metas' }, { scope: 'run:simulations', label: 'Simular compras' },
];
const KIT = ['read:accounts', 'read:dashboard', 'read:plan', 'run:simulations', 'write:accounts'];
const DETAILS = { client_name: 'Claude', redirect_host: 'claude.ai', blocked: null,
    scopes: KIT.map((scope) => ({ scope, label: 'x' })) };  // labels shown must come from /api/tokens/scopes

let root: Root | null = null;
const assign = vi.fn();
async function settle() { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); }
async function render(node: ReactNode, path: string) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(
        <LanguageProvider><MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/oauth/consent" element={node} />
                <Route path="/conecta" element={node} />
                <Route path="/login" element={<p data-testid="login-page">login</p>} />
            </Routes>
        </MemoryRouter></LanguageProvider>));
    await settle();
}
const byId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
async function click(id: string) { await act(async () => byId(id)!.click()); await settle(); }

beforeEach(() => {
    auth.user = { id: 'u1' };
    localStorage.removeItem('korex-language');
    sessionStorage.clear();
    apiFetch.mockImplementation(async (url: string) => {
        if (url === '/api/oauth/consent/details') return DETAILS;
        if (url === '/api/tokens/scopes') return SCOPE_LABELS;
        if (url === '/api/oauth/consent/approve') return { redirect_to: 'https://claude.ai/api/mcp/auth_callback?code=abc&state=s' };
        if (url === '/api/oauth/consent/deny') return { redirect_to: 'https://claude.ai/api/mcp/auth_callback?error=access_denied&state=s' };
        return {};
    });
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } });
});
afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    document.body.replaceChildren();
    vi.clearAllMocks();
});

describe('Consent screen', () => {
    it('shows who asks, the 5 labels from the API and that it can never move money', async () => {
        await render(<ConsentPage />, '/oauth/consent?request=handle_123');
        expect(apiFetch).toHaveBeenCalledWith('/api/oauth/consent/details', { method: 'POST', body: JSON.stringify({ request: 'handle_123' }) });
        expect(byId('consent-client')!.textContent).toBe('Claude quiere acceso a tu KoreX');
        const items = [...byId('consent-scopes')!.querySelectorAll('li')].map((li) => li.textContent?.replace('✓', ''));
        expect(items).toEqual(['Ver mis cuentas', 'Ver mi panel y ajustes', 'Ver mi plan de acción', 'Simular compras', 'Cuentas y metas']);
        expect(document.body.textContent).not.toContain('Registrar pagos');
        expect(byId('consent-no-payments')!.textContent).toBe('No podrá registrar pagos ni mover dinero.');
        expect(byId('consent-authorize')!.textContent).toBe('Autorizar');
        expect(byId('consent-cancel')!.textContent).toBe('Cancelar');
    });

    it('Autorizar approves the request and returns to the assistant', async () => {
        await render(<ConsentPage />, '/oauth/consent?request=handle_123');
        await click('consent-authorize');
        expect(apiFetch).toHaveBeenCalledWith('/api/oauth/consent/approve', { method: 'POST', body: JSON.stringify({ request: 'handle_123' }) });
        expect(assign).toHaveBeenCalledWith('https://claude.ai/api/mcp/auth_callback?code=abc&state=s');
        expect(byId('consent-done')!.textContent).toBe('¡Listo! Vuelve a tu asistente y pregúntale: ¿cuál es mi plan de pagos?');
    });

    it('Cancelar denies it', async () => {
        await render(<ConsentPage />, '/oauth/consent?request=handle_123');
        await click('consent-cancel');
        expect(apiFetch).toHaveBeenCalledWith('/api/oauth/consent/deny', { method: 'POST', body: JSON.stringify({ request: 'handle_123' }) });
        expect(apiFetch).not.toHaveBeenCalledWith('/api/oauth/consent/approve', expect.anything());
        expect(assign).toHaveBeenCalledWith('https://claude.ai/api/mcp/auth_callback?error=access_denied&state=s');
    });

    it('without a session: login first, then back to this same consent', async () => {
        auth.user = null;
        await render(<ConsentPage />, '/oauth/consent?request=handle_123');
        expect(byId('login-page')).toBeTruthy();
        expect(returnToOr('/dashboard')).toBe('/oauth/consent?request=handle_123');
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it('a free plan sees why, with no Autorizar button', async () => {
        apiFetch.mockImplementation(async (url: string) => url === '/api/oauth/consent/details' ? { ...DETAILS, blocked: 'free_plan' } : SCOPE_LABELS);
        await render(<ConsentPage />, '/oauth/consent?request=handle_123');
        expect(byId('consent-authorize')).toBeNull();
        expect(document.body.textContent).toContain('Conectar tu IA viene con los planes de pago.');
    });

    it('an expired request says so', async () => {
        apiFetch.mockImplementation(async (url: string) => { if (url === '/api/oauth/consent/details') throw new Error('404'); return SCOPE_LABELS; });
        await render(<ConsentPage />, '/oauth/consent?request=old');
        expect(byId('consent-expired')!.textContent).toBe('Este pedido de conexión venció. Vuelve a empezar desde tu asistente.');
    });

    it('the return target can only ever be a consent URL (no open redirect)', async () => {
        const { rememberReturnTo } = await import('@/lib/returnTo');
        rememberReturnTo('https://evil.example/');
        rememberReturnTo('/dashboard/settings');
        expect(returnToOr('/dashboard')).toBe('/dashboard');
    });
});

describe('/conecta', () => {
    it('3 plain steps and the MCP URL with Copiar', async () => {
        const writeText = vi.fn(async () => undefined);
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
        await render(<ConectaPage />, '/conecta');
        const steps = [...byId('conecta-steps')!.querySelectorAll('li')].map((li) => li.querySelector('p')!.textContent);
        expect(steps).toEqual(['Abre tu asistente.', 'Agrega KoreX con este enlace.', 'Toca Autorizar.']);
        expect(byId('conecta-url')!.textContent).toBe('https://corex-sf-production.up.railway.app/mcp');
        expect(document.body.textContent).not.toMatch(/kx_|token/i);
        await click('conecta-copy');
        expect(writeText).toHaveBeenCalledWith('https://corex-sf-production.up.railway.app/mcp');
        expect(byId('conecta-copy')!.textContent).toBe('Copiado');
    });

    it('in English when the user chose English', async () => {
        localStorage.setItem('korex-language', 'en');
        await render(<ConectaPage />, '/conecta');
        expect(document.body.textContent).toContain('Connect KoreX to your assistant');
        expect(document.body.textContent).toContain('Tap Authorize.');
    });
});
