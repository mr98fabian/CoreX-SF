/**
 * EN→ES sweep (2026-11-13): LoginPage, NotFoundPage, PrivacyPolicyPage and TermsOfServicePage
 * render in Spanish first and English as the fallback; their visible text lives in copy files.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

let lang: 'es' | 'en' = 'es';
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: lang, t: (k: string) => k }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/features/auth/AuthContext', () => ({
    useAuth: () => ({ user: null, loading: false, signInWithGoogle: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), resetPassword: vi.fn(), signInAsDemo: vi.fn() }),
}));

import LoginPage from '@/features/auth/LoginPage';
import NotFoundPage from '@/features/error/NotFoundPage';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import TermsOfServicePage from './TermsOfServicePage';
import { PRIVACY_COPY } from './privacyCopy';
import { termsSections } from './termsCopy';
import { LOGIN_COPY } from '@/features/auth/loginCopy';
import { NOT_FOUND_COPY } from '@/features/error/notFoundCopy';
import loginSrc from '@/features/auth/LoginPage.tsx?raw';
import notFoundSrc from '@/features/error/NotFoundPage.tsx?raw';
import privacySrc from './PrivacyPolicyPage.tsx?raw';
import termsSrc from './TermsOfServicePage.tsx?raw';
import legalDocSrc from './LegalDocument.tsx?raw';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root | null = null;
async function render(node: ReactNode, l: 'es' | 'en') {
    lang = l;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<MemoryRouter>{node}</MemoryRouter>));
    // visible text only: <style> blocks (CSS keyframes) are not read by anyone
    const clone = host.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('style').forEach((n) => n.remove());
    return clone.textContent ?? '';
}
afterEach(() => {
    if (root) act(() => root!.unmount());
    if (host) document.body.removeChild(host);
    root = null; host = null;
});

// Terms of art and proper names kept in English inside the Spanish legal text on purpose
const KEPT_IN_ENGLISH = [/"AS IS"/g, /"AS AVAILABLE"/g, /Consumer Arbitration Rules/g, /American Arbitration Association/g,
    /Digital Millennium Copyright Act/g, /small claims court/g, /Kontrolly Consulting LLC/g, /KoreX Financial System( v1\.0)?/g,
    /KoreX System/g, /Supabase Auth/g, /Google OAuth( 2\.0)?/g, /Row-Level Security/g, /Peace Shield/g, /data brokers/g, /goodwill/g, /managers/gi];
const ENGLISH = /\b(the|and|your|you|with|of|to|is|are|we|our|not|please|sign in|password|account|back|go|page|terms|privacy|policy|effective|contents|rights reserved)\b/i;
function englishLeft(text: string) {
    let t = text;
    for (const r of KEPT_IN_ENGLISH) t = t.replace(r, ' ');
    return t.match(ENGLISH)?.[0] ?? null;
}

const PAGES: [string, () => ReactNode, { es: string; en: string }][] = [
    ['LoginPage', () => <LoginPage />, { es: 'Iniciar sesión', en: 'Sign In' }],
    ['NotFoundPage', () => <NotFoundPage />, { es: 'El mapache buscó por todas partes', en: 'The raccoon searched everywhere' }],
    ['PrivacyPolicyPage', () => <PrivacyPolicyPage />, { es: 'Política de Privacidad', en: 'Privacy Policy' }],
    ['TermsOfServicePage', () => <TermsOfServicePage />, { es: 'Términos del Servicio', en: 'Terms of Service' }],
];

describe('render in Spanish (default) and English', () => {
    for (const [name, page, marks] of PAGES) {
        it(`${name}: Spanish, with no English left`, async () => {
            const text = await render(page(), 'es');
            expect(text).toContain(marks.es);
            expect(englishLeft(text), `${name} ES still shows English`).toBeNull();
        });
        it(`${name}: English fallback`, async () => {
            const text = await render(page(), 'en');
            expect(text).toContain(marks.en);
        });
    }

    it('legal pages: same clauses, same order, in both languages', () => {
        expect(PRIVACY_COPY.es.sections.map((s) => s.id)).toEqual(PRIVACY_COPY.en.sections.map((s) => s.id));
        expect(termsSections('es', 2026).map((s) => s.id)).toEqual(termsSections('en', 2026).map((s) => s.id));
        expect(termsSections('es', 2026)).toHaveLength(18);
        expect(PRIVACY_COPY.es.sections).toHaveLength(12);
        // the liability cap and the arbitration body survive the translation verbatim
        const lim = termsSections('es', 2026).find((s) => s.id === 'limitation')!.content;
        expect(lim).toContain('DOCE (12) MESES');
        expect(lim).toContain('US$100.00');
        expect(termsSections('es', 2026).find((s) => s.id === 'arbitration')!.content).toContain('American Arbitration Association (AAA)');
    });

    it('privacy, legal accuracy (2026-11-13): real RLS architecture and every data provider, in both languages', () => {
        const sec = (l: 'es' | 'en', id: string) => PRIVACY_COPY[l].sections.find((s) => s.id === id)!.content;
        // storage: public access denied (RLS without policies + grants revoked), isolation done by the backend
        expect(sec('en', 'storage')).toContain('direct public access to the database is denied');
        expect(sec('en', 'storage')).toContain('Only our backend reaches the database, and it separates each user');
        expect(sec('es', 'storage')).toContain('el acceso público directo a la base de datos está denegado');
        expect(sec('es', 'storage')).toContain('Solo nuestro backend accede a la base de datos');
        expect(sec('en', 'storage')).not.toContain('database policies ensure users can only access their own data');
        expect(sec('es', 'storage')).not.toContain('políticas de la base de datos que garantizan');
        // security measures (section 8): RLS without policies + revoked permissions, backend isolation
        expect(sec('en', 'security-measures')).toContain('Row-Level Security enabled on all tables with no access policies');
        expect(sec('es', 'security-measures')).toContain('Row-Level Security activado en todas las tablas sin políticas de acceso');
        expect(sec('en', 'security-measures')).not.toContain('Row-Level Security policies on all user data tables');
        expect(sec('es', 'security-measures')).not.toContain('Políticas de Row-Level Security en todas');
        // 2026-11-14: Google Play named as the Android app's payment processor
        expect([PRIVACY_COPY.en.effectiveDate, PRIVACY_COPY.es.effectiveDate]).toEqual(['November 14, 2026', '14 de noviembre de 2026']);
        // providers: Railway, Lemon Squeezy (web) and Google Play (Android), same "• **Name** — role" format
        for (const l of ['es', 'en'] as const) {
            const providers = sec(l, 'sharing').split('\n').filter((line) => line.startsWith('• **'));
            expect(providers.map((p) => p.match(/\*\*(.+?)\*\*/)![1])).toEqual(['Supabase', 'Google', 'Vercel', 'Railway', 'Lemon Squeezy', 'Google Play']);
            for (const p of providers) expect(p).toMatch(/^• \*\*[^*]+\*\* — .+\.$/);
        }
    });

    it('copy files: every key exists in both languages', () => {
        expect(Object.keys(LOGIN_COPY.es).sort()).toEqual(Object.keys(LOGIN_COPY.en).sort());
        expect(Object.keys(NOT_FOUND_COPY.es).sort()).toEqual(Object.keys(NOT_FOUND_COPY.en).sort());
    });
});

describe('guardian: no hardcoded visible English in the four swept files', () => {
    const FILES: [string, string][] = [['LoginPage', loginSrc], ['NotFoundPage', notFoundSrc], ['PrivacyPolicyPage', privacySrc],
        ['TermsOfServicePage', termsSrc], ['LegalDocument', legalDocSrc]];
    const strip = (src: string) => src
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/className=(\{`[\s\S]*?`\}|"[^"]*")/g, '').replace(/<style>[\s\S]*?<\/style>/g, '')
        .replace(/^import .*$/gm, '');
    const WORDS = /\b(the|and|your|you|with|of|to|is|not|sign|password|account|email|back|go|page|terms|privacy|policy|create|forgot|continue|loading|demo|raccoon|dashboard|reset|send|confirm|full name|agree|or)\b/i;

    for (const [name, src] of FILES) {
        it(`${name}: no English JSX text and no English string literals`, () => {
            const code = strip(src);
            // 1) text written straight between JSX tags
            const jsxText = [...code.matchAll(/(?<![=-])>([^<>{}();]+)</g)].map((m) => m[1].trim())
                .filter((t) => /[A-Za-z]{2,}/.test(t) && WORDS.test(t));
            // 2) visible attributes written as literals
            const attrs = [...code.matchAll(/\b(?:label|placeholder|alt|title|aria-label)="([^"]*)"/g)].map((m) => m[1])
                .filter((t) => /[A-Za-z]/.test(t) && t !== 'KoreX'); // '••••••••' is not language
            // 3) sentences in string literals (messages, errors). Provider error strings matched
            //    with .includes(...) are never shown, so they are left out.
            const noIncludes = code.replace(/\.includes\((['"])[^'"]*\1\)/g, '');
            const sentences = [...noIncludes.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map((m) => m[2].trim())
                .filter((t) => /^[A-Za-z][A-Za-z'’]*(\s+[A-Za-z'’!?.,]+)+$/.test(t) && !t.startsWith('Bearer '));
            const offenders = [...jsxText, ...attrs, ...sentences];
            expect(offenders, `${name} hardcodes: ${offenders.join(' | ')}`).toEqual([]);
        });
    }

    it('the guard bites', () => {
        const bad = strip(`<p className="x">Go Back</p>\nsetError('Invalid email or password');`);
        expect([...bad.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).some((t) => WORDS.test(t))).toBe(true);
        expect(WORDS.test('Invalid email or password')).toBe(true);
    });
});
