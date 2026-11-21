/**
 * Mi Cuenta: deleting the account is two honest steps with Cancel on both, the final button
 * needs the password (or the email, for Google-only accounts), and the store subscription
 * warning shows when one is paid. /eliminar-cuenta explains it without a session.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const { ApiError } = vi.hoisted(() => ({ ApiError: class extends Error { status: number; constructor(s: number) { super(String(s)); this.status = s; } } }));
const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a), ApiError }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
const auth = vi.hoisted(() => ({
    user: null as null | { email: string; app_metadata: { providers: string[] }; identities: { provider: string }[]; user_metadata: object },
    isDemo: false,
    signOut: vi.fn(async () => undefined),
}));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }));

import { LanguageProvider } from '@/contexts/LanguageContext';
import MyAccountPage from './MyAccountPage';
import DeleteAccountInfoPage from '@/features/account/DeleteAccountInfoPage';
import { returnToOr } from '@/lib/returnTo';
import langSrc from '@/contexts/LanguageContext.tsx?raw';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const EMAIL_USER = { email: 'ana@korex.test', app_metadata: { providers: ['email'] }, identities: [{ provider: 'email' }], user_metadata: {} };
const GOOGLE_USER = { email: 'ana@korex.test', app_metadata: { providers: ['google'] }, identities: [{ provider: 'google' }], user_metadata: {} };
let status: Record<string, unknown>;
let deleteResult: 'ok' | 403 | 502 = 'ok';

let host: HTMLDivElement | null = null;
let root: Root;
const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const byId = (id: string) => host!.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
async function click(id: string) { await act(async () => byId(id)!.click()); await settle(); }
async function type(id: string, value: string) {
    const input = byId(id) as HTMLInputElement;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
function Where() { const l = useLocation(); return <p data-testid="where">{l.pathname}{l.search}{l.hash}</p>; }

async function render(path: string) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<LanguageProvider><MemoryRouter initialEntries={[path]}>
        <Routes>
            <Route path="/dashboard/settings/cuenta" element={<><MyAccountPage /><Where /></>} />
            <Route path="/eliminar-cuenta" element={<DeleteAccountInfoPage />} />
            <Route path="/login" element={<Where />} />
        </Routes>
    </MemoryRouter></LanguageProvider>));
    await settle();
}

beforeEach(() => {
    auth.user = EMAIL_USER; auth.isDemo = false; auth.signOut.mockClear();
    localStorage.removeItem('korex-language');
    sessionStorage.clear();
    deleteResult = 'ok';
    status = { plan: 'starter', status: 'active', source: 'none', store_source: null, accounts_limit: 2 };
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
        if (url === '/api/subscriptions/status') return status;
        if (url === '/api/user/me' && opts?.method === 'DELETE') {
            if (deleteResult === 'ok') return { deleted: true };
            throw new ApiError(deleteResult);
        }
        return null;
    });
});
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('Mi Cuenta', () => {
    it('shows the email and the plan', async () => {
        status = { ...status, plan: 'freedom', source: 'subscription' };
        await render('/dashboard/settings/cuenta');
        expect(byId('account-email')!.textContent).toBe('ana@korex.test');
        expect(byId('account-plan')!.textContent).not.toBe('…');
    });

    it('two steps, Cancel on both, and the final button needs the password', async () => {
        await render('/dashboard/settings/cuenta');
        expect(byId('danger-zone')!.textContent).toContain('Zona de peligro');
        await click('delete-start');
        expect(byId('delete-what')!.textContent).toBe('Se borran tus cuentas, deudas, pagos, metas e historial, y las conexiones con tu IA. Es para siempre: no hay forma de recuperarlos.');
        expect(byId('delete-cancel')).not.toBeNull();
        expect(byId('delete-secret')).toBeNull(); // no password yet: step 1 only explains
        await click('delete-cancel');
        expect(byId('delete-start')).not.toBeNull();
        await click('delete-start');
        await click('delete-continue');
        expect((byId('delete-secret') as HTMLInputElement).type).toBe('password');
        const forever = byId('delete-forever') as HTMLButtonElement;
        expect(forever.textContent).toBe('Eliminar para siempre');
        expect(forever.disabled).toBe(true);
        await type('delete-secret', '   ');
        expect((byId('delete-forever') as HTMLButtonElement).disabled).toBe(true);
        await type('delete-secret', 'mi clave');
        expect((byId('delete-forever') as HTMLButtonElement).disabled).toBe(false);
        expect(byId('delete-cancel')).not.toBeNull();
        expect(apiFetch).not.toHaveBeenCalledWith('/api/user/me', expect.anything());
    });

    it('deletes, signs out and the login says so', async () => {
        await render('/dashboard/settings/cuenta');
        await click('delete-start');
        await click('delete-continue');
        await type('delete-secret', 'mi clave');
        await click('delete-forever');
        expect(apiFetch).toHaveBeenCalledWith('/api/user/me', { method: 'DELETE', body: JSON.stringify({ password: 'mi clave' }) });
        expect(auth.signOut).toHaveBeenCalled();
        expect(byId('where')!.textContent).toBe('/login?cuenta=eliminada');
    });

    it('a wrong password says nothing was deleted and keeps the session', async () => {
        deleteResult = 403;
        await render('/dashboard/settings/cuenta');
        await click('delete-start');
        await click('delete-continue');
        await type('delete-secret', 'otra');
        await click('delete-forever');
        expect(byId('delete-error')!.textContent).toBe('La contraseña no es correcta. No se borró nada.');
        expect(auth.signOut).not.toHaveBeenCalled();
        expect(byId('where')!.textContent).toBe('/dashboard/settings/cuenta');
    });

    it('Google-only accounts confirm with their email', async () => {
        auth.user = GOOGLE_USER;
        await render('/dashboard/settings/cuenta');
        await click('delete-start');
        await click('delete-continue');
        expect((byId('delete-secret') as HTMLInputElement).type).toBe('email');
        await type('delete-secret', 'ana@korex.test');
        await click('delete-forever');
        expect(apiFetch).toHaveBeenCalledWith('/api/user/me', { method: 'DELETE', body: JSON.stringify({ confirm_email: 'ana@korex.test' }) });
    });

    it('a paid Google Play subscription gets the Play warning before confirming; the web one its own', async () => {
        status = { ...status, plan: 'freedom', source: 'subscription', store_source: 'google_play' };
        await render('/dashboard/settings/cuenta');
        await click('delete-start');
        expect(byId('delete-store-warning')!.textContent).toBe('Eliminar tu cuenta NO cancela tu suscripción de Google Play. Cancélala en Play Store → Suscripciones para que no te sigan cobrando.');
        act(() => root.unmount()); document.body.removeChild(host!); host = null;
        status = { ...status, store_source: 'lemon' };
        await render('/dashboard/settings/cuenta');
        await click('delete-start');
        expect(byId('delete-store-warning')!.textContent).toContain('Facturación y cancelación');
        act(() => root.unmount()); document.body.removeChild(host!); host = null;
        status = { ...status, plan: 'starter', source: 'none' };
        await render('/dashboard/settings/cuenta');
        await click('delete-start');
        expect(byId('delete-store-warning')).toBeNull();
    });

    it('the demo has no delete button', async () => {
        auth.isDemo = true;
        await render('/dashboard/settings/cuenta');
        expect(byId('delete-start')).toBeNull();
        expect(byId('danger-zone')!.textContent).toContain('El demo es compartido');
    });
});

describe('/eliminar-cuenta (public)', () => {
    it('explains the steps; without a session the button logs in and returns to the danger zone', async () => {
        auth.user = null;
        await render('/eliminar-cuenta');
        const steps = [...byId('delete-info-steps')!.querySelectorAll('li')].map((li) => li.querySelector('p')!.textContent);
        expect(steps).toEqual(['Inicia sesión en KoreX.', 'Ve a Ajustes → Mi Cuenta.', 'Toca Eliminar mi cuenta y confirma.']);
        expect(byId('delete-info-go')!.textContent).toBe('Iniciar sesión para eliminar mi cuenta');
        await click('delete-info-go');
        expect(byId('where')!.textContent).toBe('/login');
        expect(returnToOr('/dashboard')).toBe('/dashboard/settings/cuenta#eliminar');
    });

    it('with a session it goes straight to Mi Cuenta → danger zone', async () => {
        await render('/eliminar-cuenta');
        await click('delete-info-go');
        expect(byId('where')!.textContent).toBe('/dashboard/settings/cuenta#eliminar');
        expect(byId('danger-zone')).not.toBeNull();
    });
});

describe('copy', () => {
    const lines = langSrc.split('\n').filter((l) => /^\s*"(account\.|deleteInfo\.)/.test(l));
    it('every key in both languages, tú, no assistant brand, no guilt', () => {
        expect(lines.length).toBeGreaterThanOrEqual(28);
        for (const l of lines) expect(l, l).toMatch(/es: "[^"]+", en: "[^"]+"/);
        const text = lines.join('\n');
        expect(text).not.toMatch(/\b(Cancelala|Volvé|Tocá|Escribí|Iniciá|tenés|podés)\b/);
        expect(text).not.toMatch(/claude|chatgpt|gemini|copilot|\bmuse\b/i);
        expect(text).not.toMatch(/seguro que te vas|te vamos a extrañar|are you sure you want to leave/i);
    });
});
