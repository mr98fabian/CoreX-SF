import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import layoutSrc from '@/layouts/DashboardLayout.tsx?raw';
import sheetSrc from '@/components/ui/sheet.tsx?raw';
import kxCss from '@/styles/kx.css?raw';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
let reduced = false;
vi.mock('@/lib/motion', async (orig) => ({ ...(await orig<object>()), useReducedMotion: () => reduced, prefersReducedMotion: () => reduced }));

import { HeroNumber, LedgerRow, Section } from './index';
import { StampDrop } from './motion';
import { editorialDate } from '@/lib/editorialDate';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
async function render(node: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(node));
    return host;
}
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } reduced = false; });

const reducedBlock = kxCss.slice(kxCss.lastIndexOf('@media (prefers-reduced-motion: reduce)'));

describe('Profundidad 2.5D', () => {
    it('the permanent layout has no backdrop blur and sheets have none either', () => {
        expect(layoutSrc).not.toMatch(/backdrop-blur/);
        expect(sheetSrc).not.toMatch(/backdrop-blur/);
        expect(sheetSrc).toContain('kx-sheet');
    });

    it('elevation tokens exist for both themes, shadows only (no colored glow)', () => {
        for (const n of [1, 2, 3]) expect(kxCss.match(new RegExp(`--kx-elev-${n}:`, 'g'))).toHaveLength(2);
        const shadows = kxCss.match(/--kx-elev-\d:[^;]+;/g)!.join(' ');
        expect(shadows).not.toMatch(/rgba\((?!0, 0, 0|255, 255, 255|60, 40, 10)/); // black / white highlight / warm paper shadow (Noche con luz): never a coloured glow
    });

    it('elevation lives on containers, never on list rows; the hero carries the light', async () => {
        const el = await render(<>
            <Section title="Cuentas"><LedgerRow title="Visa" onClick={() => undefined} /></Section>
            <HeroNumber label="Deuda total" amount={1000} phrase="x" />
        </>);
        expect(el.querySelector('.kx-elev-1')).not.toBeNull();
        expect(el.querySelector('.kx-row')!.className).not.toMatch(/kx-elev/);
        expect(el.querySelector('.kx-row')!.className).toContain('kx-press');
        expect(el.querySelector('.kx-lit')).not.toBeNull();
    });

    it('reduced motion turns off the parallax, the page layers and the sheet rise', () => {
        expect(reducedBlock).toMatch(/\.kx-lit::before\s*\{\s*transform:\s*none;\s*animation:\s*none;/);
        expect(reducedBlock).toMatch(/\.kx-page\s*\{\s*animation:\s*none;/);
        expect(reducedBlock).toMatch(/\.kx-sheet[^{]*\{\s*animation:\s*none !important;/);
    });

    it('parallax hangs off --kx-scroll with transform only (≤ 10 px)', () => {
        expect(kxCss).toContain('transform: translate3d(0, calc(var(--kx-scroll, 0) * 10px), 0);');
    });

    it('the stamp drops with its shadow on the same spring; reduced motion renders it still', async () => {
        let el = await render(<StampDrop drop><b>PAGADA</b></StampDrop>);
        expect(el.querySelector('[data-kx-motion="stamp-shadow"]')).not.toBeNull();
        act(() => root.unmount()); document.body.removeChild(host!); host = null;
        reduced = true;
        el = await render(<StampDrop drop><b>PAGADA</b></StampDrop>);
        expect(el.querySelector('[data-kx-motion="stamp-shadow"]')).toBeNull();
    });

    it('editorial dateline is anchored at noon', () => {
        expect(editorialDate('2026-11-07', 'es')).toBe('sábado, 7 de noviembre');
        expect(editorialDate('2026-11-07', 'en')).toBe('Saturday, November 7');
    });
});
