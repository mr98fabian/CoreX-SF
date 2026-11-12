/**
 * KoreX Fase 6 base components (dark-first system, see src/styles/kx.css).
 * One saturated moment per screen: <AmberStripe>. Stages always travel as
 * color + label + bar (<StageChip> + <StageBar>), never color alone.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { NAV_PRIMARY, NAV_MORE, isNavActive } from '@/lib/nav';
import { AppMenuSection } from '@/components/AppMenuSection';
import { STAGE_LABEL, type Stage } from '@/lib/stage';
import { useLanguage } from '@/contexts/LanguageContext';
import { prefersReducedMotion } from '@/lib/motion';
import { useStripeScroll } from '@/hooks/useStripeScroll';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { CountUp } from './motion';
import { motion } from 'framer-motion';
import { tx } from '@/lib/motion';
import { editorialDate } from '@/lib/editorialDate';
import { onKeyboardChange } from '@/lib/keyboard';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

function StripeLight() {
    return <span aria-hidden="true" data-kx-motion="stripe" className="kx-stripe-light" />;
}

// ── Amber stripe — the signature. Swept band from the approved v8 header. ──
export function AmberStripe({ children, height = 158, className }: { children?: ReactNode; height?: number; className?: string }) {
    const ref = useStripeScroll<HTMLDivElement>();
    const still = prefersReducedMotion();
    return (
        <div ref={ref} className={cx('relative overflow-hidden px-6 pt-4', className)} style={{ height }}>
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 390 158" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <linearGradient id="kxStripe" x1="0" y1="0" x2="1" y2="0.55">
                        <stop offset="0" stopColor="#B45309" />
                        <stop offset="0.55" stopColor="#F59E0B" />
                        <stop offset="1" stopColor="#FBBF24" />
                    </linearGradient>
                </defs>
                <path d="M0,0 L390,0 L390,52 C300,92 210,120 120,132 C70,139 30,143 0,146 Z" fill="url(#kxStripe)" />
                <path d="M0,146 C30,143 70,139 120,132 C210,120 300,92 390,52 L390,64 C300,104 215,130 128,141 C75,148 32,152 0,155 Z" fill="#FDE68A" opacity="0.35" />
            </svg>
            {!still && <StripeLight />}
            <div className="relative z-[1] flex h-full flex-col">{children}</div>
        </div>
    );
}

/** Thin stripe accent for screens other than Inicio ("equilibrio, no repetición"). */
export function AmberRule({ className }: { className?: string }) {
    const ref = useStripeScroll<HTMLDivElement>();
    return (
        <div ref={ref} aria-hidden="true" className={cx('relative h-[5px] w-full overflow-hidden rounded-full', className)} style={{ background: 'var(--kx-stripe)' }}>
            {!prefersReducedMotion() && <StripeLight />}
        </div>
    );
}

// ── Bank header: greeting + visible security line ──
export function BankHeader({ greeting, title }: { greeting?: string; title?: string }) {
    const { language } = useLanguage();
    const es = language === 'es';
    return (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
            <div className="min-w-0">
                <p data-testid="kx-dateline" className="font-editorial text-[13px] first-letter:uppercase text-kx-ink3">{editorialDate(new Date(), es ? 'es' : 'en')}</p>
                {greeting && <p className="text-sm text-kx-ink2">{greeting}</p>}
                {title && <h1 className="text-[22px] font-semibold tracking-tight text-kx-ink">{title}</h1>}
            </div>
            <p className="flex shrink-0 items-center gap-1.5 text-[11px] text-kx-ink3">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                {es ? 'Conexión segura · Sesión protegida' : 'Secure connection · Protected session'}
            </p>
        </div>
    );
}

// ── State phrase (always BEFORE the numbers) ──
export function StatePhrase({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'paid' }) {
    const dot = tone === 'paid' ? 'bg-kx-paid shadow-[0_0_0_4px_rgba(52,211,153,.18)]' : 'bg-kx-amber shadow-[0_0_0_4px_rgba(245,158,11,.18)]';
    return (
        <p className="flex items-start gap-2.5 text-[16.5px] font-semibold leading-snug text-kx-ink">
            <span className={cx('mt-[6px] h-[11px] w-[11px] flex-none rounded-full', dot)} aria-hidden="true" />
            <span>{children}</span>
        </p>
    );
}

// ── Hero number: ONE per screen, with its interpreting phrase ──
export function HeroNumber({ label, amount, phrase }: { label: string; amount: number; phrase: ReactNode }) {
    const { formatMoney } = useFormatMoney();
    // Counts from the previous value after a payment; the final value is the server's
    const render = (n: number) => {
        const [d, c] = formatMoney(n).split('.');
        return <>{d}{c && <sup className="ml-0.5 align-super text-[23px] text-kx-ink3">.{c}</sup>}</>;
    };
    return (
        <div className="kx-lit" data-kx-elev="2">
            <p className="kx-label">{label}</p>
            <p className="kx-hero-number mt-1.5 text-[52px] text-kx-ink">
                <CountUp value={amount} format={render} label={formatMoney} />
            </p>
            <p className="mt-2.5 text-[13.5px] text-kx-ink2">{phrase}</p>
        </div>
    );
}

// ── Stage chip + bar (triple coding: color + label + progress) ──
const CHIP: Record<Stage, string> = {
    debt: 'bg-[var(--kx-debt-chip-bg)] text-[var(--kx-debt-chip-ink)]',
    almost: 'bg-[var(--kx-almost-chip-bg)] text-[var(--kx-almost-chip-ink)]',
    paid: 'bg-[var(--kx-paid-chip-bg)] text-[var(--kx-paid-chip-ink)]',
    support: 'bg-kx-raised text-kx-ink2',
};
const BAR: Record<Stage, string> = {
    debt: 'bg-[var(--kx-debt-bar)]', almost: 'bg-[var(--kx-almost-bar)]', paid: 'bg-[var(--kx-paid-bar)]', support: 'bg-kx-ink3',
};

export function StageChip({ stage, pct, suffix }: { stage: Stage; pct?: number | null; suffix?: string }) {
    const { language } = useLanguage();
    const label = STAGE_LABEL[stage][language === 'es' ? 'es' : 'en'];
    const extra = suffix ?? (pct != null && stage !== 'paid' ? ` · ${Math.round(pct * 100)}%` : stage === 'paid' ? ' ✓' : '');
    return (
        <span className={cx('kx-stage-tint whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] font-bold tracking-[.07em]', CHIP[stage])}>
            {label}{extra}
        </span>
    );
}

export function StageBar({ stage, pct }: { stage: Stage; pct: number | null }) {
    const width = pct == null ? 0 : Math.max(stage === 'paid' ? 100 : 3, Math.round(pct * 100));
    return (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar"
            aria-valuenow={pct == null ? undefined : Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
            <i className={cx('kx-stage-tint kx-stage-bar block h-full origin-left rounded-full', BAR[stage])} style={{ width: `${width}%` }} />
        </div>
    );
}

// ── Savings-goal bar (Metas, Modo casa): thin, amber, never the debt stage colors ──
export function GoalBar({ pct, label }: { pct: number; label?: string }) {
    const v = Math.max(0, Math.min(100, Math.round(pct)));
    return (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--kx-ink)_10%,transparent)]" role="progressbar"
            aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} data-testid="goal-bar">
            <i className="block h-full origin-left rounded-full bg-kx-amber transition-[width] duration-[var(--kx-dur-base)]" style={{ width: `${v > 0 ? Math.max(3, v) : 0}%` }} />
        </div>
    );
}

// ── PAGADA stamp: bordered, rotated −4°, sober ──
export function PaidStamp({ className }: { className?: string }) {
    const { language } = useLanguage();
    return (
        <span className={cx('inline-block -rotate-[4deg] rounded-md border-2 border-kx-warm px-2 py-0.5 text-[11px] font-bold tracking-[.14em] text-kx-warm', className)}>
            {language === 'es' ? 'PAGADA' : 'PAID'}
        </span>
    );
}

// ── Named section with stage color (3–4 items max) ──
type Tone = Stage | 'neutral' | 'amber';
const SEC: Record<Tone, { box: string; title: string }> = {
    debt: { box: 'bg-[var(--kx-debt-sec-bg)] border-[var(--kx-debt-sec-line)]', title: 'text-kx-debt' },
    almost: { box: 'bg-[var(--kx-almost-sec-bg)] border-[var(--kx-almost-sec-line)]', title: 'text-kx-almost' },
    paid: { box: 'bg-[var(--kx-paid-sec-bg)] border-[var(--kx-paid-sec-line)]', title: 'text-kx-paid' },
    support: { box: 'bg-kx-surface border-kx-line', title: 'text-kx-ink2' },
    neutral: { box: 'bg-kx-surface border-kx-line', title: 'text-kx-ink2' },
    amber: { box: 'bg-[rgba(245,158,11,.07)] border-[rgba(245,158,11,.4)]', title: 'text-kx-amber-soft' },
};

export function Section({ tone = 'neutral', title, children, className, action, bare = false }: {
    tone?: Tone; title: ReactNode; children: ReactNode; className?: string; action?: ReactNode;
    /** children already are the panel (calendar grid, stage ledger): no second frame */
    bare?: boolean;
}) {
    return (
        // Continuous language (calendar family): the title sits flush above ONE
        // panel; the panel is the only frame — no box-in-box.
        <section className={className}>
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <h2 className={cx('text-[11px] font-bold uppercase tracking-[.16em]', SEC[tone].title)}>{title}</h2>
                {action}
            </div>
            {bare ? children : (
                <div className={cx('kx-rows kx-elev-1 rounded-[var(--kx-radius-card)] border px-4 py-3.5', SEC[tone].box)}>
                    {children}
                </div>
            )}
        </section>
    );
}

// ── Ledger row (fila-libro): name, tabular amount, optional stage band ──
export function LedgerRow({ title, sub, amount, stage, onClick, children, logo }: {
    title: ReactNode; sub?: ReactNode; amount?: ReactNode; stage?: Stage; onClick?: () => void; children?: ReactNode; logo?: ReactNode;
}) {
    const band = stage && stage !== 'support' ? BAR[stage] : 'bg-transparent';
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag onClick={onClick} className={cx('kx-row relative block w-full border-t border-[var(--kx-line-soft)] py-3 pl-3 text-left first:border-t-0 first:pt-0.5',
            onClick && 'kx-press cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber')}>
            <span aria-hidden="true" className={cx('kx-stage-tint absolute bottom-3 left-0 top-3 w-[3px] rounded-full first:top-0.5', band)} />
            <span className={cx('flex justify-between gap-2.5', logo ? 'items-center' : 'items-baseline')}>
                <span className="flex min-w-0 items-center gap-2.5">
                    {logo}
                    <span className="min-w-0 truncate text-[15px] font-semibold text-kx-ink">
                        {title}{sub && <span className="ml-1.5 text-[12.5px] font-normal text-kx-ink3">{sub}</span>}
                    </span>
                </span>
                {amount != null && <span className="kx-num font-editorial whitespace-nowrap text-[17px] text-kx-ink">{amount}</span>}
            </span>
            {children}
        </Tag>
    );
}

// ── Primary pill: ONE per screen ──
export function PrimaryPill({ children, onClick, disabled, type = 'button' }: {
    children: ReactNode; onClick?: () => void; disabled?: boolean; type?: 'button' | 'submit';
}) {
    return (
        <button type={type} onClick={onClick} disabled={disabled}
            className="kx-press block w-full rounded-xl bg-kx-amber px-4 py-3 text-center text-sm font-bold text-[#111418] hover:opacity-90 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kx-amber">
            {children}
        </button>
    );
}

// ── Bottom tab bar (< 768px): exactly NAV_PRIMARY, active by isNavActive ──
// Lives IN the shell's flex column (header / content / tab bar), not fixed: it
// sits on the shell's bottom edge whatever height the view has, and the content
// can never scroll under it. Hidden while the soft keyboard is open.
export function TabBar() {
    const { language, t } = useLanguage();
    const es = language === 'es';
    const { pathname } = useLocation();
    const [keyboard, setKeyboard] = useState(false);
    useEffect(() => onKeyboardChange(setKeyboard), []);
    return (
        <nav aria-label={es ? 'Navegación principal' : 'Main navigation'} data-testid="tabbar" data-keyboard={keyboard ? 'open' : 'closed'}
            className={cx('relative z-40 shrink-0 border-t border-[#131E33] bg-kx-bg px-2 pb-[max(18px,var(--kx-safe-bottom))] pt-2.5 md:hidden', keyboard ? 'hidden' : 'flex')}>
            {NAV_PRIMARY.map(({ to, icon: Icon, labelKey }) => {
                const active = isNavActive(pathname, to);
                return (
                    <Link key={to} to={to} aria-current={active ? 'page' : undefined}
                        className={cx('kx-press relative min-w-0 flex-1 text-center text-[10.5px] transition-colors duration-[var(--kx-dur-base)]', active ? 'font-semibold text-kx-amber' : 'text-kx-ink3')}>
                        {active && (
                            <motion.span layoutId="kx-tab-indicator" transition={tx('base', prefersReducedMotion())}
                                aria-hidden="true" className="absolute -top-2.5 left-1/2 -ml-4 h-[3px] w-8 rounded-full bg-kx-amber" />
                        )}
                        <Icon className="mx-auto mb-1 h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
                        <span className="block truncate">{t(labelKey)}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

// ── Plain-language block of a value + its phrase (rule 2: no figure without a phrase) ──
export function FigureLine({ phrase, figure }: { phrase: ReactNode; figure?: ReactNode }) {
    return (
        <p className="text-[13.5px] leading-snug text-kx-ink2">
            {phrase}{figure != null && <> <b className="kx-num font-semibold text-kx-ink">{figure}</b></>}
        </p>
    );
}

// ── Sidebar / hamburger list: NAV_PRIMARY, then "Más" + NAV_MORE (same isNavActive) ──
export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
    const { t } = useLanguage();
    const { pathname } = useLocation();
    return (
        <nav className="flex-1 overflow-y-auto px-3 py-4" data-testid="sidebar-nav" aria-label={t('nav.coreX')}>
            {[NAV_PRIMARY, NAV_MORE].map((group, gi) => (
                <div key={gi} className={gi ? 'mt-4 border-t border-kx-line pt-3' : ''} data-testid={gi ? 'nav-more' : 'nav-primary'}>
                    {gi === 1 && <p className="kx-label mb-1.5 px-3">{t('nav.more')}</p>}
                    <div className="space-y-1.5">
                        {group.map(({ to, icon: Icon, labelKey }) => {
                            const active = isNavActive(pathname, to);
                            return (
                                <Link key={to} to={to} aria-current={active ? 'page' : undefined} onClick={onNavigate}
                                    className={cx('flex h-10 w-full items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors',
                                        active ? 'bg-[color-mix(in_srgb,var(--kx-amber)_14%,transparent)] text-kx-amber' : 'text-kx-ink2 hover:bg-kx-raised hover:text-kx-ink')}>
                                    <Icon size={18} strokeWidth={1.5} aria-hidden="true" /> <span className="whitespace-nowrap">{t(labelKey)}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            ))}
            <AppMenuSection />
        </nav>
    );
}
