import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import appSrc from './App.tsx?raw';
import layoutSrc from './layouts/DashboardLayout.tsx?raw';

const LABELS: Record<string, string> = {
    'nav.home': 'Inicio', 'nav.calendar': 'Calendario', 'nav.plan': 'Plan', 'nav.accountsShort': 'Cuentas', 'nav.subscriptions': 'Suscripciones',
    'nav.activity': 'Actividad', 'nav.judge': 'Juez de compras', 'nav.moneyClock': 'Reloj de dinero', 'nav.analysis': 'Análisis', 'nav.rankings': 'Rangos', 'nav.settingsShort': 'Ajustes', 'nav.more': 'Más', 'nav.coreX': 'KoreX',
};
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => LABELS[k] ?? k }) }));

import { SideNav, TabBar } from '@/components/kx';
import { NAV_MORE, NAV_PRIMARY, isNavActive } from '@/lib/nav';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
async function render(node: React.ReactNode, path = '/dashboard') {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>));
    return host;
}
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

const hrefs = (el: Element) => [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
const PRIMARY = ['/dashboard', '/dashboard/calendar', '/dashboard/action-plan', '/dashboard/accounts', '/dashboard/subscriptions'];
const MORE = ['/dashboard/activity', '/dashboard/judge', '/dashboard/money-clock', '/dashboard/analytics', '/dashboard/rankings', '/dashboard/settings'];

describe('Navegación top-5', () => {
    it('the tab bar holds exactly the 5 primary entries, in order', async () => {
        const el = await render(<TabBar />);
        expect(hrefs(el.querySelector('[data-testid="tabbar"]')!)).toEqual(PRIMARY);
        expect(el.textContent).toBe('InicioCalendarioPlanCuentasSuscripciones');
    });

    it('the sidebar/hamburger holds primary + "Más", with no entry in both groups', async () => {
        const el = await render(<SideNav />);
        expect(hrefs(el.querySelector('[data-testid="nav-primary"]')!)).toEqual(PRIMARY);
        const more = el.querySelector('[data-testid="nav-more"]')!;
        expect(more.textContent).toContain('Más');
        expect(hrefs(more)).toEqual(MORE);
        const all = [...NAV_PRIMARY, ...NAV_MORE].map((n) => n.to);
        expect(new Set(all).size).toBe(all.length);
    });

    it('every live route has a menu entry or is declared internal-only', () => {
        const INTERNAL_ONLY = new Set(['action-plan/full', 'accounts/manage', 'settings/plans', 'settings/ia', 'settings/advanced', 'panel']);
        const block = appSrc.slice(appSrc.indexOf('path="/dashboard"'));
        const children = [...block.matchAll(/<Route (index|path="([^"]+)")/g)].map((m) => (m[1] === 'index' ? '' : m[2]));
        expect(children.length).toBeGreaterThan(10);
        const menu = new Set([...NAV_PRIMARY, ...NAV_MORE].map((n) => n.to));
        const orphans = children.filter((c) => c !== '*' && !INTERNAL_ONLY.has(c) && !menu.has(c ? `/dashboard/${c}` : '/dashboard'));
        expect(orphans).toEqual([]);
    });

    it.each([
        ['/dashboard/accounts/manage', '/dashboard/accounts'],
        ['/dashboard/action-plan/full', '/dashboard/action-plan'],
        ['/dashboard/settings/ia', '/dashboard/settings'],
        ['/dashboard', '/dashboard'],
    ])('%s lights up %s (same rule in the bar and the sidebar)', async (path, expected) => {
        const all = [...NAV_PRIMARY, ...NAV_MORE].filter((n) => isNavActive(path, n.to)).map((n) => n.to);
        expect(all).toEqual([expected]);
        const side = await render(<SideNav />, path);
        expect([...side.querySelectorAll('a[aria-current="page"]')].map((a) => a.getAttribute('href'))).toEqual([expected]);
    });

    it('/dashboard/calendar does NOT light up Inicio', async () => {
        expect(isNavActive('/dashboard/calendar', '/dashboard')).toBe(false);
        const el = await render(<TabBar />, '/dashboard/calendar');
        expect([...el.querySelectorAll('a[aria-current="page"]')].map((a) => a.getAttribute('href'))).toEqual(['/dashboard/calendar']);
        expect(isNavActive('/dashboard/accountsX', '/dashboard/accounts')).toBe(false); // segment-aware prefix
    });

    it('one breakpoint: tab bar hidden from md (768px), sidebar mobile-drawer below it, no NavLink twin', async () => {
        const el = await render(<TabBar />);
        const cls = el.querySelector('[data-testid="tabbar"]')!.className;
        expect(cls).toContain('md:hidden');
        expect(cls).not.toContain('lg:hidden');
        expect(layoutSrc).not.toMatch(/NavLink|const isActive|navLinks/);
    });
});
