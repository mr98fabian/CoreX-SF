/**
 * Misión 19 — «Cobre a la vista», composición. One describe per acceptance criterion of
 * misiones/2026-11-25-rediseno-composicion.md (the names match its table).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import homeSrc from '@/features/home/HomePage.tsx?raw';
import calSrc from '@/components/kx/DebtCalendar.tsx?raw';
import calPageSrc from '@/features/home/CalendarPage.tsx?raw';
import planSrc from '@/features/attack/AttackPage.tsx?raw';
import axisSrc from '@/features/actionplan/PlanAxis.tsx?raw';
import accSrc from '@/features/accounts/AccountsStagePage.tsx?raw';
import subsSrc from '@/features/subscriptions/SubscriptionsPage.tsx?raw';
import loginSrc from '@/features/auth/LoginPage.tsx?raw';
import loginCopySrc from '@/features/auth/loginCopy.ts?raw';
import statesSrc from '@/components/kx/states.tsx?raw';
import ceremonySrc from '@/components/kx/Ceremony.tsx?raw';
import interestSrc from '@/features/home/DailyInterestLine.tsx?raw';
import kxCss from '@/styles/kx.css?raw';
import kxIndexSrc from '@/components/kx/index.tsx?raw';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { HeroNumber } from '@/components/kx';
import { EmptyState, ErrorState } from '@/components/kx/states';
import { PaidLine, STAMP_AT_MS } from '@/components/kx/Ceremony';
import { KxAccounts } from '@/components/kx/icons';
import { PlanAxis } from '@/features/actionplan/PlanAxis';
import { SubscriptionsView } from '@/features/subscriptions/SubscriptionsPage';
import { DailyInterestLine } from '@/features/home/DailyInterestLine';
import type { SubsResponse } from '@/features/subscriptions/subscriptionText';

const mounted: { root: Root; host: HTMLElement }[] = [];
function render(node: ReactNode) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<MemoryRouter><LanguageProvider>{node}</LanguageProvider></MemoryRouter>));
    mounted.push({ root, host });
    return host;
}
afterEach(() => { for (const m of mounted.splice(0)) { act(() => m.root.unmount()); m.host.remove(); } });

function setReduced(on: boolean) {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
        matches: on && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
        addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
    }));
}
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
function contrast(a: string, b: string) {
    const lum = (h: string) => {
        const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
            .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}

describe('Inicio (§6.2)', () => {
    it('one hero «Debes ≈», 56 px, with the light behind', () => {
        expect(homeSrc).toContain("<HeroNumber label={es ? 'Debes ≈' : 'You owe ≈'} amount={s.totalDebt}");
        const hero = render(<HeroNumber label="Debes ≈" amount={33678.5} phrase="x" />).querySelector('[data-testid="hero"]')!;
        expect(hero.querySelector('.kx-hero-number')!.className).toContain('text-[56px]');
        expect((hero.querySelector('span[aria-hidden="true"]') as HTMLElement).style.background).toBe('var(--kx-foco)');
    });
    it('a funda connector runs from the hero to the mission; its button is the only copper surface', () => {
        const order = ['<HeroNumber', '<Connector>', '<MissionCard'].map((t) => homeSrc.indexOf(t));
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(statesSrc).toMatch(/w-\[10px\][^"]*bg-\[var\(--kx-funda\)\]/);
        expect(count(homeSrc, /bg-kx-amber\b/g)).toBe(1);
        expect(homeSrc).toMatch(/data-testid="mission-action"[\s\S]{0,200}bg-kx-amber/);
        expect(homeSrc).not.toContain('<AmberStripe');
    });
    it('the two data in one Plex Mono line, without a card', () => {
        expect(homeSrc).toMatch(/<p className="kx-tech [^"]*" data-testid="two-data">/);
        expect(homeSrc).toMatch(/Disponible para tu plan: '[^\n]*formatMoney\(s\.available\)/);
        expect(homeSrc).toContain('Efectivo en cuentas: ');
    });
    it('the daily interest is a line of text with icon 11', () => {
        const el = render(<DailyInterestLine es periods={{ dia: 16.04, semana: 112, mes: 480, anio: 5800 }} debtBalances={[100]} />);
        expect(el.querySelector('[data-testid="daily-interest"] svg[data-kx-icon="Interest"]')).not.toBeNull();
        expect(interestSrc).not.toMatch(/<Section/);
    });
    it('comparison, stages, house and league are folded by default', () => {
        expect(homeSrc).toContain('const [showMore, setShowMore] = useState(false);');
        const folded = homeSrc.slice(homeSrc.indexOf('{showMore && ('));
        for (const c of ['<CompareChart', '<HouseModule', '<LeagueBlock', "Tus deudas en 3 colores"]) expect(folded).toContain(c);
    });
});

describe('Calendario (§6.3)', () => {
    it('the grid stays; a copper line runs under every week, by time (cut on today)', () => {
        expect(calSrc).toContain('role="grid"');
        expect(calSrc).toMatch(/data-testid="week-line"[\s\S]{0,120}<CopperLine done=\{weekDone\(week\)\}/);
        expect(calSrc).toMatch(/if \(at >= 0\) return \(at \+ 0\.5\) \/ 7;/);
    });
    it('marks with icons: copper dot = charge, icon 8 = cut, icon 10 = payday in --kx-pay; two at most, then +N', () => {
        expect(calSrc).toMatch(/data-testid="charge-mark" className="[^"]*bg-kx-amber/);
        expect(calSrc).toMatch(/data-testid="cut-mark"[^>]*><KxCut/);
        expect(calSrc).toMatch(/data-testid="payday-mark" className="text-kx-pay[^"]*"><KxPayday/);
        expect(calSrc).toContain('all.slice(0, 2)');
        expect(calSrc).toContain('+{all.length - 2}');
    });
    it('the day sheet keeps its content (same component, same props)', () => {
        expect(calSrc).toContain('{live && <DaySheet detail={openDay} onClose={() => setOpenDay(null)} today={today} />}');
    });
    it('no stripe on the page; error = icon 17 + Reintentar', () => {
        expect(calPageSrc).not.toContain('AmberRule');
        expect(calPageSrc).toContain('<ErrorState');
    });
});

describe('Plan (§6.4)', () => {
    it('hero = the debt-free date in Fraunces', () => {
        expect(planSrc).toMatch(/data-testid="hero"[\s\S]{0,400}kx-hero-number[\s\S]{0,200}\{freedomText\(s\.freedom\)\}/);
        expect(planSrc).not.toMatch(/kx-hero-number text-\[68px\]/);
    });
    it('one vertical line 16 px from the edge, today → free month; a mark per debt that ends, month in Plex Mono; icon 14 at the end', () => {
        const el = render(<PlanAxis today="2026-11-25" freedom="2028-05-01" es paidNow={['Tarjeta Z']}
            marks={[{ name: 'Tarjeta B', month: '2026-12' }, { name: 'Auto', month: '2027-08' }]} />);
        const line = el.querySelector('[data-testid="vertical-line"]') as HTMLElement;
        expect(line.style.left).toBe('16px');
        const marks = [...el.querySelectorAll('[data-testid="axis-mark"]')].map((m) => m.textContent);
        expect(marks[0]).toContain('nov 2026');
        expect(marks.join('|')).toMatch(/Tarjeta Z · ya en \$0\|dic 2026 Tarjeta B en \$0\|ago 2027 Auto en \$0/);
        expect(el.querySelector('[data-testid="axis-mark"] .kx-tech')).not.toBeNull();
        expect(el.querySelector('[data-testid="axis-end"] svg[data-kx-icon="Free"]')).not.toBeNull();
        expect(el.querySelector('[data-testid="axis-end"]')!.textContent).toContain('may 2028');
    });
    it('the marks come from the server (its movements), never from money math on the screen', () => {
        expect(planSrc).toMatch(/for \(const ev of p\.events \?\? \[\]\)[\s\S]{0,160}map\.set\(name, p\.date\.slice\(0, 7\)\)/);
        expect(planSrc).toContain('<PlanAxis today={localDay()} freedom={freedomIso} marks={marks} paidNow={paidNow} es={es} />');
        expect(noComments(axisSrc)).not.toMatch(/balance|amount|\* rate/);
    });
    it('entering after the debt went down: the funda travels from the last position (480 ms, the line)', () => {
        expect(axisSrc).toContain("const SEEN = 'kx-plan-axis-done';");
        expect(axisSrc).toMatch(/requestAnimationFrame\(\(\) => setShown\(done\)\)/);
    });
});

describe('Cuentas (§6.5)', () => {
    it('one hero «Efectivo en cuentas»', () => {
        expect(accSrc).toContain("<HeroNumber label={es ? 'Efectivo en cuentas' : 'Cash in accounts'} amount={s.liquid}");
        expect(count(accSrc, /<HeroNumber/g)).toBe(1);
    });
    it('each debt has its line (no progress bar); the stage only in its chip', () => {
        expect(accSrc).not.toMatch(/StageBar|<LedgerRow[^>]*stage=/);
        expect(accSrc).toContain('<CopperLine done={a.paid ?? 0}');
        expect(accSrc).not.toMatch(/tone=\{stage\}/);
    });
    it('the attack target first with icon 6; paid last, copper + PAGADA, folded past 3; own money apart without a line', () => {
        expect(accSrc.indexOf('data-testid="attack-target"')).toBeLessThan(accSrc.indexOf('{visible.map('));
        expect(accSrc).toContain('<KxMission size={18} />');
        expect(accSrc).toContain("stage === 'paid' && !showAllPaid && all.length > 3 ? all.slice(0, 3) : all");
        expect(accSrc).toMatch(/stage === 'paid'\s*\? <PaidLine/);
        const support = accSrc.slice(accSrc.indexOf('{/* Your own money goes apart'), accSrc.indexOf('{filter && groups[filter]?.length === 0'));
        expect(support).not.toMatch(/CopperLine|PaidLine/);
    });
});

describe('Suscripciones (§6.6)', () => {
    const DATA: SubsResponse = {
        monthly_total: '40.00', annual_total: '480.00', items: [
            { id: 1, name: 'Netflix', amount: '15.49', frequency: 'monthly', status: 'active', next_charge_date: null, account_id: null, account_name: null, monthly_equivalent: '15.49' },
            { id: 2, name: 'netflix ', amount: '15.49', frequency: 'monthly', status: 'active', next_charge_date: null, account_id: null, account_name: null, monthly_equivalent: '15.49' },
            { id: 3, name: 'Gym', amount: '9.02', frequency: 'monthly', status: 'cancelled', next_charge_date: null, account_id: null, account_name: null, monthly_equivalent: '9.02' },
        ],
    } as SubsResponse;
    it('hero = what they charge you a month ≈; rows with icon 5', () => {
        const el = render(<SubscriptionsView data={DATA} es onAdd={() => {}} onEdit={() => {}} />);
        expect(el.querySelector('[data-testid="hero"] .kx-label')!.textContent).toBe('Te cobran al mes ≈');
        expect(el.querySelectorAll('svg[data-kx-icon="Subscriptions"]').length).toBe(2);
    });
    it('repeated ones carry a text note, no alarm colour; cancelled go to «Canceladas»', () => {
        const el = render(<SubscriptionsView data={DATA} es onAdd={() => {}} onEdit={() => {}} />);
        const notes = el.querySelectorAll('[data-testid="sub-repeated"]');
        expect(notes).toHaveLength(2);
        notes.forEach((n) => expect(n.className).not.toMatch(/kx-debt|kx-warm|danger/));
        expect(el.textContent).toContain('Canceladas');
    });
    it('the action says «Cancelar suscripción»', () => {
        expect(subsSrc).toContain("{es ? 'Cancelar suscripción' : 'Cancel subscription'}");
        expect(subsSrc).not.toContain('Ya no la pago');
    });
});

describe('ceremonia de $0 (§4.6)', () => {
    beforeEach(() => { vi.useFakeTimers(); setReduced(false); });
    afterEach(() => { vi.useRealTimers(); });
    it('inside the row: funda goes (next frame, 480 ms), PAGADA lands at 700 ms; ≤ 1.3 s; nothing blocks', () => {
        const el = render(<PaidLine label="Tarjeta" ceremony />);
        const line = () => el.querySelector('[data-testid="copper-line"]') as HTMLElement;
        expect(line().style.getPropertyValue('--kx-done')).toBe('0');
        act(() => { vi.advanceTimersByTime(20); });
        expect(line().style.getPropertyValue('--kx-done')).toBe('1');
        act(() => { vi.advanceTimersByTime(STAMP_AT_MS - 21); });
        expect(el.querySelector('[data-testid="paid-stamp-slot"]')!.textContent).toBe('');
        act(() => { vi.advanceTimersByTime(1); });
        expect(el.querySelector('[data-testid="paid-stamp-slot"]')!.textContent).toBe('PAGADA');
        expect(STAMP_AT_MS).toBe(700);
        expect(noComments(ceremonySrc)).not.toMatch(/confetti|Raccoon|Audio|moment\(|pointer-events|fixed/);
    });
    it('a row that is simply paid: copper whole + PAGADA, still', () => {
        const el = render(<PaidLine label="Tarjeta" ceremony={false} />);
        expect((el.querySelector('[data-testid="copper-line"]') as HTMLElement).style.getPropertyValue('--kx-done')).toBe('1');
        expect(el.textContent).toContain('PAGADA');
    });
});

describe('Login (§6.1)', () => {
    it('logo 48 px + name, the copper line open as the horizon, the sentence; no hero number', () => {
        expect(loginSrc).toMatch(/data-testid="login-logo"/);
        expect(loginSrc).toMatch(/className="h-12 w-12" data-testid="login-logo"/);
        expect(loginSrc).toContain('<CopperLine done={1} label={c.tagline} />');
        expect(loginCopySrc).toContain("tagline: 'Tu plan para salir de deudas.',");
        expect(loginSrc).not.toMatch(/kx-hero-number|HeroNumber|BackgroundOrbs/);
    });
    it('Entrar is copper, 52 px; Probar demo is an outline, 52 px; the tabs are not copper', () => {
        expect(loginSrc).toMatch(/data-testid="login-submit"\s*className="w-full min-h-\[52px\][\s\S]{0,140}bg-kx-amber/);
        expect(loginSrc).toMatch(/data-testid="login-demo"\s*className="w-full min-h-\[52px\] rounded-xl border border-kx-line/);
        expect(loginSrc).not.toContain("'bg-kx-amber text-kx-on-amber shadow-md '");
    });
});

describe('estados vacíos y de error (§5.1)', () => {
    it('empty = icon 40 px in ink-3 + one line + one button', () => {
        const el = render(<EmptyState icon={KxAccounts} text="Aún no has añadido cuentas." action="Añadir cuenta" to="/x" />);
        const icon = el.querySelector('[data-testid="empty-state"] svg')!;
        expect(icon.getAttribute('width')).toBe('40');
        expect(icon.parentElement!.className).toContain('text-kx-ink3');
        expect(el.querySelectorAll('[data-testid="empty-state"] p')).toHaveLength(1);
        expect(el.querySelector('[data-testid="empty-state"] a')!.textContent).toBe('Añadir cuenta');
    });
    it('error = icon 17 + what happened + Reintentar', () => {
        const retry = vi.fn();
        const el = render(<ErrorState text="No pudimos cargar tus cuentas." retry="Reintentar" onRetry={retry} />);
        expect(el.querySelector('svg[data-kx-icon="Alert"]')).not.toBeNull();
        act(() => { (el.querySelector('button') as HTMLButtonElement).click(); });
        expect(retry).toHaveBeenCalled();
    });
    it('every screen of the bar uses them; all at $0 = the Plan with the whole line in copper and «Sin deudas.»', () => {
        for (const s of [homeSrc, accSrc, subsSrc]) expect(s).toMatch(/<EmptyState|<ErrorState/);
        expect(planSrc).toMatch(/'Sin deudas\.'[\s\S]{0,300}<VerticalLine done=\{1\}/);
    });
});

describe('héroe y tono', () => {
    it('ONE hero per screen', () => {
        expect(count(homeSrc, /<HeroNumber/g)).toBe(1);
        expect(count(calSrc, /kx-hero-number/g)).toBe(1);
        expect(count(planSrc, /kx-hero-number/g)).toBe(1);
        expect(count(accSrc, /<HeroNumber/g)).toBe(1);
        expect(count(subsSrc, /<HeroNumber/g)).toBe(1);
        expect(count(loginSrc, /kx-hero-number|<HeroNumber/g)).toBe(0);
    });
    it('no visible string with the metaphor or Tadeo; no exclamations', () => {
        for (const s of [homeSrc, calSrc, calPageSrc, planSrc, axisSrc, accSrc, subsSrc, loginSrc, loginCopySrc, statesSrc, ceremonySrc]) {
            const code = noComments(s);
            expect(code).not.toMatch(/cable|pelar|pelad|enchuf|tadeo/i);
            expect(code).not.toMatch(/¡/);
        }
        expect(noComments(homeSrc)).not.toMatch(/<Raccoon/);
    });
});

describe('contraste y objetivos táctiles', () => {
    it('new pairs pass AA: connector (funda) ≥ 3:1, copper button ink ≥ 4.5:1, ink-3 icons ≥ 3:1', () => {
        for (const bg of ['#020617', '#111C33', '#1A2742']) expect(contrast('#7482A0', bg)).toBeGreaterThanOrEqual(3);
        expect(contrast('#1C1206', '#F59E0B')).toBeGreaterThanOrEqual(4.5);
        for (const bg of ['#020617', '#111C33', '#1A2742']) expect(contrast('#8C9AB0', bg)).toBeGreaterThanOrEqual(3);
    });
    it('the new controls are ≥ 44 px (52 on the login)', () => {
        expect(statesSrc).toContain('min-h-[44px]');
        expect(homeSrc).toMatch(/data-testid="home-more"\s*className="flex min-h-\[44px\]/);
        expect(homeSrc).toMatch(/data-testid="mission-action"\s*className="kx-press mt-3 flex min-h-\[48px\]/);
        expect(interestSrc).toContain('min-h-[44px] min-w-[44px]');
        expect(accSrc).toMatch(/data-testid="paid-toggle"\s*className="flex min-h-\[44px\]/);
        expect(subsSrc).toContain('flex h-11 w-11');
    });
});

describe('sin scroll horizontal (regresión hallada en la misión 19)', () => {
    it('the line clips its travelling cut; the vertical line clips its turned box; the light stays inside the page margin', () => {
        expect(kxCss).toMatch(/\.kx-line \{ position: relative; height: 14px; overflow: hidden; \}/);
        expect(statesSrc).toContain('absolute top-0 overflow-hidden" style={{ left: 16, width: 14, height }}');
        for (const s of [kxIndexSrc, planSrc]) expect(s).not.toContain('-inset-x-6 -inset-y-10');
    });
});

describe('reducir movimiento', () => {
    beforeEach(() => { vi.useFakeTimers(); setReduced(true); });
    afterEach(() => { vi.useRealTimers(); setReduced(false); });
    it('the ceremony renders its final state at once: whole copper and the stamp, no drop', () => {
        const el = render(<PaidLine label="Tarjeta" ceremony />);
        expect((el.querySelector('[data-testid="copper-line"]') as HTMLElement).style.getPropertyValue('--kx-done')).toBe('1');
        expect(el.textContent).toContain('PAGADA');
        expect(el.querySelector('[data-kx-motion="stamp"]')).toBeNull();
    });
});
