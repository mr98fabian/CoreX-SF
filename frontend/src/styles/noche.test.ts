import { describe, it, expect } from 'vitest';
import rawCss from './kx.css?raw';
import kxSrc from '@/components/kx/index.tsx?raw';
import homeSrc from '@/features/home/HomePage.tsx?raw';

/**
 * "Noche con luz" (2026-11-12) — WCAG guards on the real tokens of kx.css.
 * Before: surface steps 1.07–1.13 (one flat plane), text on the amber stripe
 * 1.5–1.9:1, amber as text on light 2.05:1.
 */
const css = rawCss.split(String.fromCharCode(13) + String.fromCharCode(10)).join(String.fromCharCode(10)); // Windows checkouts keep CRLF
const sources = import.meta.glob('/src/**/*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function block(selector: string): Record<string, string> {
    const start = css.indexOf(selector);
    const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/(--kx-[a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\b/g)) out[m[1]] = m[2];
    return out;
}
const dark = block(':root,\n.dark {');
const light = { ...dark, ...block(':root:not(.dark) .kx-scope {') };

const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const SURFACES = ['--kx-bg', '--kx-surface', '--kx-surface-2', '--kx-raised', '--kx-sheet'];
const TEXT = ['--kx-ink', '--kx-ink-2', '--kx-ink-3'];
const STRIPE = ['#D97706', '#F59E0B', '#FBBF24', '#FDE68A'];

describe('Noche con luz — tokens', () => {
    it('the approved values are the ones in kx.css (dark and light)', () => {
        expect(dark).toMatchObject({ '--kx-bg': '#020617', '--kx-surface': '#111C33', '--kx-surface-2': '#1A2742', '--kx-raised': '#22314F',
            '--kx-line': '#2C3D5E', '--kx-ink': '#F5F2EC', '--kx-ink-2': '#AEB9CB', '--kx-ink-3': '#8C9AB0',
            '--kx-amber': '#F59E0B', '--kx-amber-text': '#FBBF24', '--kx-on-amber': '#1C1206' });
        expect(light).toMatchObject({ '--kx-bg': '#F3EFE7', '--kx-surface': '#FFFFFF', '--kx-surface-2': '#FBF8F2', '--kx-line': '#DDD5C5',
            '--kx-ink': '#1B1F2A', '--kx-ink-2': '#465061', '--kx-ink-3': '#5F6876', '--kx-amber': '#F59E0B', '--kx-amber-text': '#9A4A06' });
    });

    it.each([['dark', dark], ['light', light]] as const)('%s: the three text levels are ≥ 4.5:1 on every surface', (_n, t) => {
        for (const s of SURFACES) for (const x of TEXT) expect(ratio(t[x], t[s]), `${x} on ${s}`).toBeGreaterThanOrEqual(4.5);
    });

    it('dark: each level steps up ≥ 1.14:1 from the one below (they read as layers)', () => {
        expect(ratio(dark['--kx-surface'], dark['--kx-bg'])).toBeGreaterThanOrEqual(1.14);
        expect(ratio(dark['--kx-surface-2'], dark['--kx-surface'])).toBeGreaterThanOrEqual(1.14);
        expect(ratio(dark['--kx-raised'], dark['--kx-surface-2'])).toBeGreaterThanOrEqual(1.14);
    });

    it('ink on amber ≥ 4.5:1 across the whole stripe; amber as text ≥ 4.5:1 on every surface, both themes', () => {
        for (const stop of STRIPE) expect(ratio(dark['--kx-on-amber'], stop), stop).toBeGreaterThanOrEqual(4.5);
        for (const [name, t] of [['dark', dark], ['light', light]] as const) {
            for (const s of SURFACES) expect(ratio(t['--kx-amber-text'], t[s]), `${name} ${s}`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it('the stripe starts at #D97706 and its content uses the on-amber token; the header left the stripe', () => {
        const stripe = kxSrc.slice(kxSrc.indexOf('export function AmberStripe'), kxSrc.indexOf('export function AmberRule'));
        expect(stripe).toContain('stopColor="#D97706"');
        expect(stripe).not.toContain('#B45309');
        expect(css).not.toMatch(/--kx-stripe:[^;]*#B45309/);
        expect(stripe).toContain('kx-on-amber');
        const inStripe = homeSrc.slice(homeSrc.indexOf('<AmberStripe>'), homeSrc.indexOf('</AmberStripe>'));
        expect(inStripe).not.toMatch(/BankHeader|text-kx-ink/);
        expect(homeSrc.indexOf('<BankHeader')).toBeLessThan(homeSrc.indexOf('<AmberStripe>'));
    });

    it('amber as text maps to the text token; paper has grain; the system bars stay #020617', () => {
        expect(css).toMatch(/\.kx-scope \.text-kx-amber,\s*\.kx-scope \.text-kx-amber-soft \{ color: var\(--kx-amber-text\); \}/);
        const lightBlocks = css.split(':root:not(.dark) .kx-scope {').slice(1).join('');
        expect(lightBlocks).toMatch(/--kx-grain: url\(/);
        expect(lightBlocks).not.toMatch(/--kx-grain: none/);
        expect(dark['--kx-bg']).toBe('#020617');
    });

    it('no component keeps the old fixed dark hex', () => {
        const offenders = Object.entries(sources)
            .filter(([path, src]) => !path.includes('.test.') && /#(131E33|263449|111418)\b/i.test(src)).map(([p]) => p);
        expect(offenders).toEqual([]);
    });

    it('the raccoon appears in exactly three moments: empty, paid, quiet', () => {
        const uses = Object.entries(sources).filter(([p]) => !p.includes('.test.') && p.endsWith('.tsx'))
            .flatMap(([, src]) => [...src.matchAll(/<Raccoon moment="(\w+)"/g)].map((m) => m[1]));
        expect(uses.sort()).toEqual(['empty', 'paid', 'quiet']);
    });

    it('life: halo behind the hero number, bars fill on entry, motion tokens untouched', () => {
        expect(kxSrc).toMatch(/className="kx-lit kx-halo"/);
        expect(css).toMatch(/\.kx-halo::after/);
        expect(css).toMatch(/@keyframes kx-fill-in/);
        expect(css).toMatch(/--kx-dur-fast: 120ms;[\s\S]*--kx-dur-base: 240ms;[\s\S]*--kx-dur-slow: 480ms;/);
        expect(css).toMatch(/\.kx-fill \{ animation: none !important; \}/);
    });
});

// ── Modo light QA (2026-11-13) ──────────────────────────────────────────────
import darkSnapshot from './dark-tokens.snapshot.txt?raw';
import { debtColor } from '@/lib/calendarSeries';
import layoutSrc from '@/layouts/DashboardLayout.tsx?raw';
import landingSrc from '@/features/landing/KxLanding.tsx?raw';

const rgbOf = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
const lumRgb = (c: number[]) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const ratioRgb = (a: number[], b: number[]) => { const [h, l] = [lumRgb(a), lumRgb(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
const hexRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

describe('Modo light — QA', () => {
    it('the dark tokens are byte-identical to before this pass', () => {
        const blocks = [...css.matchAll(/:root,\s*\.dark \{[\s\S]*?\n\}/g)].map((m) => m[0]).join('\n\n') + '\n';
        expect(blocks).toBe(darkSnapshot.split(String.fromCharCode(13) + String.fromCharCode(10)).join(String.fromCharCode(10)));
    });

    it('meaning colours used as TEXT read on paper (≥ 4.5:1 on every light surface); meaning unchanged', () => {
        const light2 = { ...dark, ...block(':root:not(.dark) .kx-scope {') };
        for (const tok of ['--kx-debt', '--kx-almost', '--kx-paid', '--kx-pay', '--kx-warm']) {
            for (const s of SURFACES) expect(ratio(light2[tok], light2[s]), `${tok} on ${s}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(light2).toMatchObject({ '--kx-almost': '#8F5A00', '--kx-pay': '#0369A1', '--kx-warm': '#A8380B' });
        // the PAGADA stamp sits on the paid section tint (green 6% over paper)
        const paidSec = hexRgb('#34D399').map((v, i) => Math.round(v * 0.06 + hexRgb('#F3EFE7')[i] * 0.94));
        expect(ratioRgb(hexRgb(light2['--kx-warm']), paidSec)).toBeGreaterThanOrEqual(4.5);
    });

    it('calendar day numbers on paper are ≥ 4.5:1 at EVERY debt level; dark keeps its old colours', () => {
        for (let i = 0; i <= 100; i++) {
            const c = debtColor(i, 100, true);
            expect(ratioRgb(rgbOf(c.color.startsWith('#') ? `rgb(${hexRgb(c.color).join(',')})` : c.color), rgbOf(c.background)), `t=${i / 100}`).toBeGreaterThanOrEqual(4.5);
            expect(c.background).toMatch(/^rgb\(/); // opaque on paper
        }
        expect(debtColor(100, 100)).toEqual({ background: 'rgba(220,38,38,0.92)', color: '#F8FAFC', fontWeight: 500 });
        expect(debtColor(50, 100)).toEqual(debtColor(50, 100, false));
    });

    it('white brand logos invert on paper; sheets use the white level in light only', () => {
        expect(css).toMatch(/:root:not\(\.dark\) \.kx-logo \{ filter: invert\(1\); \}/);
        expect(layoutSrc).toMatch(/className="kx-logo h-12/);
        expect(landingSrc).toContain('className="kx-logo h-9"');
        expect(css).toMatch(/:root:not\(\.dark\) \.kx-scope\.bg-kx-sheet \{ background: var\(--kx-grain\) repeat, var\(--kx-sheet\); \}/);
    });
});
