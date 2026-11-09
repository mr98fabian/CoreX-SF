import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ isDemo: false }) }));
vi.mock('@/components/kx/PlanCards', () => ({ PlanCards: () => <div data-testid="plan-cards"><button>Elegir</button></div> }));

import { OwnerCodesPanel } from './OwnerCodesPanel';
import PlansPage from './PlansPage';
import { PLAN_LIMITS, planLabel } from '@/lib/planLimits';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
async function render(node: ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(node));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    return host;
}
beforeEach(() => { apiFetch.mockReset(); }); // braces: a returned fn would run as teardown
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

const CODE = { id: 1, prefix: 'KX-FND-ABC', kind: 'founder', months: null, plan: 'founder', max_uses: 1, uses_count: 0, status: 'active' };

describe('Panel de códigos del dueño', () => {
    it('paints nothing when the server answers 403 (not the owner)', async () => {
        apiFetch.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
        const el = await render(<OwnerCodesPanel es />);
        expect(el.querySelector('[data-testid="owner-codes"]')).toBeNull();
        expect(el.textContent).toBe('');
    });

    it('for the owner: lists codes without plain text, shows a new code once, revokes', async () => {
        apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
            if (url === '/api/admin/codes' && opts?.method === 'POST') return { ...CODE, id: 2, code: 'KX-FND-ABCDEF-GHJKMN' };
            if (url.endsWith('/revoke')) return { ...CODE, status: 'revoked' };
            return [CODE];
        });
        const el = await render(<OwnerCodesPanel es />);
        expect(el.textContent).toContain('KX-FND-ABC…');
        expect(el.textContent).not.toContain('KX-FND-ABCDEF-GHJKMN');
        const create = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Crear código')!;
        await act(async () => create.click());
        expect(el.querySelector('[data-testid="fresh-code"]')!.textContent).toContain('KX-FND-ABCDEF-GHJKMN');
        expect(el.textContent).toContain('no se vuelve a mostrar');
        const saved = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Ya lo guardé')!;
        await act(async () => saved.click());
        expect(el.textContent).not.toContain('KX-FND-ABCDEF-GHJKMN');
        const revoke = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Revocar')!;
        await act(async () => revoke.click());
        expect(apiFetch).toHaveBeenCalledWith('/api/admin/codes/1/revoke', { method: 'POST' });
    });
});

describe('Código personalizado', () => {
    it('sends the custom text and shows a discreet error when it already exists', async () => {
        apiFetch.mockImplementation(async (_url: string, opts?: { method?: string; body?: string }) => {
            if (opts?.method === 'POST') throw Object.assign(new Error('Conflict'), { status: 409 });
            return [CODE];
        });
        const el = await render(<OwnerCodesPanel es />);
        const input = el.querySelector('input[aria-label="Código personalizado"]') as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        await act(async () => { setter.call(input, 'Elduenodelcastillo77'); input.dispatchEvent(new Event('input', { bubbles: true })); });
        const create = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Crear código')!;
        await act(async () => create.click());
        const post = apiFetch.mock.calls.find((c) => c[1]?.method === 'POST')!;
        expect(JSON.parse(post[1].body).custom_code).toBe('Elduenodelcastillo77');
        expect(el.querySelector('[data-testid="code-error"]')!.textContent).toBe('Ese código ya existe.');
    });
});

describe('Errores al crear', () => {
    it.each([
        [503, 'Códigos desactivados: falta ACCESS_CODE_HMAC_KEY en el servidor.'],
        [500, 'No se pudo crear el código. Inténtalo de nuevo.'],
    ])('status %i shows a message instead of failing silently', async (status, msg) => {
        apiFetch.mockImplementation(async (_url: string, opts?: { method?: string }) => {
            if (opts?.method === 'POST') throw Object.assign(new Error('x'), { status });
            return [CODE];
        });
        const el = await render(<OwnerCodesPanel es />);
        const create = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Crear código')!;
        await act(async () => create.click());
        expect(el.querySelector('[data-testid="code-error"]')!.textContent).toBe(msg);
        expect(el.querySelector('[data-testid="fresh-code"]')).toBeNull();
    });
});

describe('Planes con acceso por código', () => {
    it('founder: no checkout buttons, the state instead', async () => {
        apiFetch.mockResolvedValue({ plan: 'founder', status: 'active', accounts_limit: 999, source: 'grant', grant_plan: 'founder', grant_ends_at: null, checkout_hidden: true });
        const el = await render(<PlansPage />);
        expect(el.querySelector('[data-testid="plan-cards"]')).toBeNull();
        expect(el.querySelector('[data-testid="plans-state"]')!.textContent).toContain('Tu cuenta es Fundadora');
    });

    it('current gift: shows until when, still no checkout', async () => {
        apiFetch.mockResolvedValue({ plan: 'accelerator', status: 'active', accounts_limit: 999, source: 'grant', grant_plan: 'accelerator', grant_ends_at: '2027-05-08T12:00:00Z', checkout_hidden: true });
        const el = await render(<PlansPage />);
        expect(el.querySelector('[data-testid="plan-cards"]')).toBeNull();
        expect(el.textContent).toContain('Accelerator regalado, activo hasta el 8 de mayo de 2027');
    });

    it('normal user: the plan cards with checkout stay', async () => {
        apiFetch.mockResolvedValue({ plan: 'starter', status: 'active', accounts_limit: 2, source: 'none', grant_plan: null, grant_ends_at: null, checkout_hidden: false });
        const el = await render(<PlansPage />);
        expect(el.querySelector('[data-testid="plan-cards"]')).not.toBeNull();
    });

    it('founder exists in the client plan table, unlimited, labelled Fundador', () => {
        expect(PLAN_LIMITS.founder).toBe(Infinity);
        expect(planLabel('founder', true)).toBe('Fundador');
        expect(planLabel('founder', false)).toBe('Founder');
    });
});
