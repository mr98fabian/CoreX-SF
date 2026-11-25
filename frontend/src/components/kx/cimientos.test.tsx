/**
 * Misión 18 — «Cobre a la vista», cimientos. One describe per acceptance criterion of
 * misiones/2026-11-25-rediseno-cimientos.md (the numbers match its table).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
// @ts-expect-error — the app tsconfig has no Node types; vitest runs this file in Node
import { gzipSync } from 'node:zlib';
import kxCss from '@/styles/kx.css?raw';
import iconsSrc from '@/components/kx/icons.tsx?raw';
import lineSrc from '@/components/kx/CopperLine.tsx?raw';
import openingSrc from '@/components/kx/Opening.tsx?raw';
import openingLibSrc from '@/lib/opening.ts?raw';
import navSrc from '@/lib/nav.ts?raw';
import kxSrc from '@/components/kx/index.tsx?raw';
import { GLYPHS, KxHome } from './icons';
import { CopperLine } from './CopperLine';
import { Opening } from './Opening';
import { BankHeader, TabBar } from './index';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { resetOpening } from '@/lib/opening';
import { monthsBetween, timeTravelled } from '@/lib/lineProgress';
import { MAX_MS, OPENING_MS } from '@/lib/motion';


// Minimal render (no testing-library in this repo, same pattern as pulido.test.tsx)
const mounted: { root: Root; host: HTMLElement }[] = [];
function render(node: ReactNode) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(node));
    const m = { root, host };
    mounted.push(m);
    return {
        container: host,
        rerender: (n: ReactNode) => act(() => root.render(n)),
        unmount: () => { act(() => root.unmount()); host.remove(); mounted.splice(mounted.indexOf(m), 1); },
        getByTestId: (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement,
    };
}
afterEach(() => { for (const m of mounted.splice(0)) { act(() => m.root.unmount()); m.host.remove(); } });

const block = kxCss.slice(kxCss.indexOf('«Cobre a la vista» — cimientos'));
const openingCss = block.slice(block.indexOf('/* Opening (§4.4)'), block.indexOf('@media (prefers-reduced-motion'));
const reducedCss = block.slice(block.indexOf('@media (prefers-reduced-motion'));
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const ms = (v: string) => (v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000);

function setReduced(on: boolean) {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
        matches: on && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
    }));
}

// WCAG 2.x relative luminance contrast
function contrast(a: string, b: string) {
    const lum = (h: string) => {
        const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
            .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}

describe('1 · tokens', () => {
    it('the 4 new tokens, with their values; no Tadeo-era tokens', () => {
        expect(kxCss).toContain('--kx-funda: #7482A0;');
        expect(kxCss).toContain('--kx-funda-sombra: #4A5670;');
        expect(kxCss).toContain('--kx-cobre: var(--kx-stripe);');
        expect(kxCss).toContain('--kx-foco: radial-gradient(60% 50% at 50% 38%, rgba(255, 247, 230, .09), transparent);');
        expect(kxCss).not.toMatch(/--kx-tinta|--kx-goma/);
    });
    it('the base palette is the approved one', () => {
        for (const v of ['--kx-bg: #020617;', '--kx-surface: #111C33;', '--kx-surface-2: #1A2742;', '--kx-raised: #22314F;',
            '--kx-ink: #F5F2EC;', '--kx-ink-3: #8C9AB0;', '--kx-amber: #F59E0B;']) expect(kxCss).toContain(v);
    });
});

describe('2 · contraste', () => {
    const SURFACES = ['#020617', '#111C33', '#1A2742', '#22314F'];
    it('graphic objects ≥ 3:1 on every level: funda, both ends of the copper, icon line at rest', () => {
        for (const bg of SURFACES) for (const fg of ['#7482A0', '#F59E0B', '#D97706', '#8C9AB0']) {
            expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
        }
    });
    it('tab labels ≥ 4.5:1 on the bar (#020617): at rest (ink-3) and active (ink)', () => {
        expect(contrast('#8C9AB0', '#020617')).toBeGreaterThanOrEqual(4.5);
        expect(contrast('#F5F2EC', '#020617')).toBeGreaterThanOrEqual(4.5);
    });
    it('funda vs copper is < 3:1, so the cut carries a lip (never colour alone)', () => {
        expect(contrast('#7482A0', '#F59E0B')).toBeLessThan(3);
        expect(block).toMatch(/\.kx-line__cut::before \{[^}]*width: 2px; height: 14px/);
    });
});

describe('3 · título de pantalla', () => {
    it('Fraunces upright, 22 px, weight 400, never italic', () => {
        expect(block).toMatch(/\.kx-screen-title \{ font-family: "Fraunces", Georgia, serif; font-size: 22px; font-weight: 400; font-style: normal;/);
        const el = render(<MemoryRouter><LanguageProvider><BankHeader title="Cuentas" /></LanguageProvider></MemoryRouter>).container;
        const h1 = el.querySelector('h1')!;
        expect(h1.className).toContain('kx-screen-title');
        expect(h1.className).not.toMatch(/italic|font-semibold|font-bold/);
    });
});

describe('4 · línea de cobre', () => {
    it('geometry: funda 10 px + 1 px shadow, copper 6 px centred, cut lip 2 px', () => {
        expect(block).toContain('.kx-line { position: relative; height: 14px; }');
        expect(block).toContain('.kx-line__track { position: absolute; inset: 2px 0;'); // 10 px track
        expect(block).toContain('.kx-line__copper { position: absolute; inset: 2px 0;'); // 6 px copper
        expect(block).toMatch(/\.kx-line__funda \{[^}]*box-shadow: inset 0 -1px 0 var\(--kx-funda-sombra\)/);
    });
    it('moves with transform only — never width', () => {
        expect(block).toMatch(/\.kx-line__funda \{[^}]*transform: scaleX\(calc\(1 - var\(--kx-done\)\)\)/);
        expect(block).toMatch(/\.kx-line__cut \{[^}]*transform: translateX\(calc\(var\(--kx-done\) \* 100%\)\)/);
        expect(block).not.toMatch(/transition:[^;]*width/);
        expect(noComments(lineSrc)).not.toMatch(/width/);
    });
    it('mount is still; forward = 480 ms + glint; backward = 240 ms, no glint', () => {
        const el = render(<CopperLine done={0.25} label="Avance" />);
        const line = () => el.getByTestId('copper-line');
        expect(line().getAttribute('aria-valuenow')).toBe('25');
        expect(line().style.getPropertyValue('--kx-done')).toBe('0.25');
        expect(line().dataset.dir).toBeUndefined();
        el.rerender(<CopperLine done={0.5} label="Avance" />);
        expect(line().dataset.dir).toBe('down');
        expect(line().dataset.flash).toBe('');
        el.rerender(<CopperLine done={0.4} label="Avance" />);
        expect(line().dataset.dir).toBe('up');
        expect(line().dataset.flash).toBeUndefined();
        el.rerender(<CopperLine done={1} label="Avance" />);
        expect(line().dataset.edge).toBe('');
    });
    it('the cut is placed by TIME travelled (whole months of the plan), never by money', () => {
        expect(monthsBetween('2026-01-31', '2026-02-01')).toBe(1);
        expect(monthsBetween('2026-11-25', '2027-04-01')).toBe(5);
        expect(timeTravelled('2026-01-15', '2027-01-10', '2026-07-31')).toBe(0.5);
        expect(timeTravelled('2026-01-15', '2027-01-10', '2025-12-01')).toBe(0);
        expect(timeTravelled('2026-01-15', '2027-01-10', '2028-01-01')).toBe(1);
        expect(timeTravelled('2026-05-01', '2026-05-30', '2026-05-10')).toBe(1); // a plan of < 1 month
    });
});

describe('5 · iconos', () => {
    it('18 icons, each exactly [line, tip]', () => {
        expect(Object.keys(GLYPHS)).toHaveLength(18);
        for (const [n, g] of Object.entries(GLYPHS)) expect(g, n).toHaveLength(2);
    });
    it('24 grid, stroke 2, round caps and joins, no fill; tip copper when lit, line colour when not', () => {
        const svg = render(<KxHome />).container.querySelector('svg')!;
        expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
        expect(svg.getAttribute('stroke-width')).toBe('2');
        expect(svg.getAttribute('stroke-linecap')).toBe('round');
        expect(svg.getAttribute('stroke-linejoin')).toBe('round');
        expect(svg.getAttribute('fill')).toBe('none');
        expect(svg.querySelectorAll('path')).toHaveLength(2);
        expect(svg.querySelector('[data-tip]')!.getAttribute('stroke')).toBe('var(--kx-amber)');
        const off = render(<KxHome lit={false} strokeWidth={1.5} />).container.querySelector('svg')!;
        expect(off.querySelector('[data-tip]')!.getAttribute('stroke')).toBe('currentColor');
        expect(off.getAttribute('stroke-width')).toBe('2'); // one stroke weight in the whole app
    });
    it('all 18 together ≤ 12 KB uncompressed; no icon library added', () => {
        expect(new TextEncoder().encode(iconsSrc).length).toBeLessThanOrEqual(12 * 1024);
        expect(iconsSrc).not.toMatch(/from '(?!react')/);
    });
});

describe('6 · barra inferior', () => {
    const bar = () => render(
        <MemoryRouter initialEntries={['/dashboard/calendar']}><LanguageProvider><TabBar /></LanguageProvider></MemoryRouter>,
    ).container;
    it('5 tabs, 56 px, 11 px labels always visible, each ≥ 44 px wide', () => {
        const tabs = bar().querySelectorAll('[data-testid="tab"]');
        expect(tabs).toHaveLength(5);
        tabs.forEach((t) => {
            expect(t.className).toMatch(/\bh-14\b/);
            expect(t.className).toContain('text-[11px]');
            expect(t.className).toContain('min-w-[44px]');
            expect(t.textContent!.trim().length).toBeGreaterThan(0);
            expect(t.className).not.toMatch(/\bbg-/); // no pill behind the active tab
        });
    });
    it('active = a 24×3 copper segment that slides (shared layoutId); copper tip only on the active icon', () => {
        const el = bar();
        const ind = el.querySelectorAll('[data-testid="tab-indicator"]');
        expect(ind).toHaveLength(1);
        expect(ind[0].className).toMatch(/\bw-6\b/);
        expect(ind[0].className).toContain('h-[3px]');
        expect((ind[0] as HTMLElement).style.background).toBe('var(--kx-cobre)');
        expect(kxSrc).toContain('layoutId="kx-tab-indicator"');
        const lit = [...el.querySelectorAll('[data-tip]')].filter((p) => p.getAttribute('stroke') === 'var(--kx-amber)');
        expect(lit).toHaveLength(1);
        expect(lit[0].closest('a')!.getAttribute('aria-current')).toBe('page');
    });
    it('no floating centre button', () => {
        expect(bar().querySelectorAll('[data-testid="tabbar"] button')).toHaveLength(0);
    });
});

describe('7 · apertura', () => {
    beforeEach(() => { vi.useFakeTimers(); sessionStorage.clear(); resetOpening(); setReduced(false); });
    afterEach(() => { vi.useRealTimers(); document.documentElement.classList.remove('kx-opening'); });

    it('the CSS timeline ends inside 1000 ms and OPENING_MS is exactly 1000', () => {
        expect(OPENING_MS).toBe(1000);
        const ends = [...openingCss.matchAll(/animation: ([^;]+);/g)].flatMap((m) => m[1].split(','))
            .map((a) => a.trim().split(/\s+/).filter((p) => /^\d+(\.\d+)?m?s$/.test(p)).map(ms))
            .map(([dur = 0, delay = 0]) => dur + delay);
        expect(ends.length).toBeGreaterThanOrEqual(6);
        expect(Math.max(...ends)).toBeLessThanOrEqual(OPENING_MS);
        expect(openingCss).toContain('kx-iris 320ms var(--kx-ease-out) 600ms both');
    });
    it('runs on a cold start into the app: overlay + clipped #root, gone at exactly 1000 ms', () => {
        const el = render(<Opening pathname="/dashboard" />);
        expect(document.body.querySelector('[data-testid="opening"]')).not.toBeNull();
        expect(document.documentElement.classList.contains('kx-opening')).toBe(true);
        act(() => { vi.advanceTimersByTime(999); });
        expect(document.body.querySelector('[data-testid="opening"]')).not.toBeNull();
        act(() => { vi.advanceTimersByTime(1); });
        expect(document.body.querySelector('[data-testid="opening"]')).toBeNull();
        expect(document.documentElement.classList.contains('kx-opening')).toBe(false);
        el.unmount();
    });
    it('a tap ends it at once (final state well inside 120 ms)', () => {
        render(<Opening pathname="/dashboard" />);
        act(() => { vi.advanceTimersByTime(300); window.dispatchEvent(new Event('pointerdown')); });
        expect(document.body.querySelector('[data-testid="opening"]')).toBeNull();
        expect(document.documentElement.classList.contains('kx-opening')).toBe(false);
    });
    it('once per session; never on the public landing', () => {
        render(<Opening pathname="/dashboard" />).unmount();
        resetOpening(); // a reload in the same session
        expect(render(<Opening pathname="/dashboard" />).container.ownerDocument.querySelector('[data-testid="opening"]')).toBeNull();
        sessionStorage.clear(); resetOpening();
        render(<Opening pathname="/" />);
        expect(document.body.querySelector('[data-testid="opening"]')).toBeNull();
    });
    it('the app is mounted underneath from ms 0: the overlay is a portal to body, never a gate', () => {
        expect(openingSrc).toContain('createPortal(');
        expect(openingSrc).not.toMatch(/return\s+null;\s*\/\/|children/);
    });
    it('the layer is ≤ 3 KB compressed (component + decision + its CSS), zero bitmaps', () => {
        const layer = openingSrc + openingLibSrc + openingCss;
        expect(gzipSync(layer).length).toBeLessThanOrEqual(3 * 1024);
        expect(layer).not.toMatch(/\.(png|jpe?g|webp|gif)\b/);
    });
});

describe('9 · movimiento', () => {
    it('nothing new loops; nothing new outside the opening lasts > 700 ms', () => {
        const outside = block.replace(openingCss, '');
        expect(block).not.toMatch(/infinite/);
        expect(outside).toMatch(/kx-glint var\(--kx-dur-base\) var\(--kx-ease-out\) 460ms both/); // 460 + 240 = 700
        expect(MAX_MS).toBe(700);
        for (const m of outside.matchAll(/(\d+)ms/g)) expect(Number(m[1])).toBeLessThanOrEqual(MAX_MS);
    });
    it('nothing new listens to scroll, and the line never takes a tap', () => {
        for (const s of [lineSrc, openingSrc, iconsSrc]) expect(noComments(s)).not.toMatch(/scroll/i);
        expect(block).toMatch(/\.kx-line__cut \{[^}]*pointer-events: none/);
    });
});

describe('10 · reducir movimiento', () => {
    beforeEach(() => { vi.useFakeTimers(); sessionStorage.clear(); resetOpening(); setReduced(true); });
    afterEach(() => { vi.useRealTimers(); setReduced(false); document.documentElement.classList.remove('kx-opening'); });
    it('CSS: no line transition, no glint, no iris; the opening is a 150 ms fade above the app', () => {
        expect(reducedCss).toContain('.kx-line__funda, .kx-line__cut { transition: none; }');
        expect(reducedCss).toContain('html.kx-opening #root { animation: none; }');
        expect(reducedCss).toMatch(/\.kx-open \{ z-index: 10000; pointer-events: none; animation: kx-fade-out 150ms linear both; \}/);
    });
    it('the opening is removed at 150 ms', () => {
        render(<Opening pathname="/dashboard" />);
        act(() => { vi.advanceTimersByTime(150); });
        expect(document.body.querySelector('[data-testid="opening"]')).toBeNull();
    });
});

describe('12 · metáfora', () => {
    it('no visible string in the new code says cable, pelar, enchufar or Tadeo', () => {
        const tab = kxSrc.slice(kxSrc.indexOf('export function TabBar'), kxSrc.indexOf('// ── Plain-language block'));
        for (const s of [iconsSrc, lineSrc, openingSrc, openingLibSrc, navSrc, tab]) {
            expect(noComments(s)).not.toMatch(/cable|pelar|pelad|enchuf|tadeo/i);
        }
    });
});
