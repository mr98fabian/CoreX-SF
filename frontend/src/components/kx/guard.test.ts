import { describe, it, expect } from 'vitest';
import indexCss from '@/index.css?raw';
import kxCss from '@/styles/kx.css?raw';

/**
 * Design guard: the kx system can't silently erode.
 * 1. backdrop-blur lives only in the allowed overlays (modals over content).
 * 2. features/ and layouts/ use kx tokens, not hard palette colors.
 */
const code: Record<string, string> = {
    ...(import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
    // CSS via explicit ?raw imports (vitest blanks CSS loaded through a glob)
    '/src/index.css': indexCss,
    '/src/styles/kx.css': kxCss,
};

const BLUR_ALLOWED = new Set([
    '/src/components/InsufficientFundsDialog.tsx',
    '/src/components/OnboardingWizard.tsx',
    '/src/components/UpgradeNudge.tsx',
    '/src/components/WidgetHelp.tsx',
    '/src/features/dashboard/components/RecurringConfirmModal.tsx', // allowed set; retired with /panel
]);

// Hard palette colors (chromatic hues). Neutral scrims like bg-black/50 behind a modal are fine.
const HARD_COLOR = /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|from|via|to|ring|shadow|fill|stroke|divide|outline|decoration)-(?:red|rose|emerald|green|teal|blue|sky|cyan|indigo|violet|purple|fuchsia|pink|lime|yellow|amber|orange)-\d{2,3}(?![\w-])/;
// Explicit, short allowlist: file → why
const COLOR_ALLOWED: Record<string, string> = {};

describe('Design guard', () => {
    it('scans the real source tree', () => {
        expect(Object.keys(code).length).toBeGreaterThan(100);
        expect(code['/src/features/home/HomePage.tsx']).toBeTruthy();
        expect(code['/src/index.css']).toBeTruthy();
    });

    it('backdrop-blur appears only in the allowed overlay set', () => {
        const offenders = Object.entries(code).filter(([f, s]) => /backdrop-blur/.test(s) && !BLUR_ALLOWED.has(f)).map(([f]) => f);
        expect(offenders).toEqual([]);
    });

    it('features/ and layouts/ use kx tokens, not hard palette colors', () => {
        const offenders = Object.entries(code)
            .filter(([f]) => /^\/src\/(features|layouts)\//.test(f) && !(f in COLOR_ALLOWED))
            .flatMap(([f, s]) => s.split('\n').flatMap((line, i) => {
                const m = line.match(HARD_COLOR);
                return m ? [`${f}:${i + 1} ${m[0]}`] : [];
            }));
        expect(offenders).toEqual([]);
    });

    it('the guard itself catches a violation', () => {
        expect('className="bg-red-500"').toMatch(HARD_COLOR);
        expect('className="hover:text-emerald-400"').toMatch(HARD_COLOR);
        expect('className="bg-kx-debt text-kx-ink"').not.toMatch(HARD_COLOR);
    });
});

describe('Design guard — amber-soft is a solid color, not a tint', () => {
    it('no bg-kx-amber-soft fills (it painted active items solid amber under amber text)', () => {
        const offenders = Object.entries(code).filter(([f, s]) => !f.endsWith('.css') && /bg-kx-amber-soft/.test(s)).map(([f]) => f);
        expect(offenders).toEqual([]);
    });
});
