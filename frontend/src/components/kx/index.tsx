/**
 * KoreX Fase 6 base components (dark-first system, see src/styles/kx.css).
 * One saturated moment per screen: <AmberStripe>. Stages always travel as
 * color + label + bar (<StageChip> + <StageBar>), never color alone.
 */
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Wallet, Activity, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { STAGE_LABEL, type Stage } from '@/lib/stage';
import { useLanguage } from '@/contexts/LanguageContext';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ── Amber stripe — the signature. Swept band from the approved v8 header. ──
export function AmberStripe({ children, height = 158, className }: { children?: ReactNode; height?: number; className?: string }) {
    return (
        <div className={cx('relative overflow-hidden px-6 pt-4', className)} style={{ height }}>
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
            <div className="relative z-[1] flex h-full flex-col">{children}</div>
        </div>
    );
}

/** Thin stripe accent for screens other than Inicio ("equilibrio, no repetición"). */
export function AmberRule({ className }: { className?: string }) {
    return <div aria-hidden="true" className={cx('h-[5px] w-full rounded-full', className)} style={{ background: 'var(--kx-stripe)' }} />;
}

// ── Bank header: greeting + visible security line ──
export function BankHeader({ greeting, title }: { greeting?: string; title?: string }) {
    const { language } = useLanguage();
    const es = language === 'es';
    return (
        <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
                {greeting && <p className="text-sm text-kx-ink2">{greeting}</p>}
                {title && <h1 className="truncate text-[22px] font-semibold tracking-tight text-kx-ink">{title}</h1>}
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
export function HeroNumber({ label, value, cents, phrase }: { label: string; value: string; cents?: string; phrase: ReactNode }) {
    return (
        <div>
            <p className="kx-label">{label}</p>
            <p className="kx-hero-number mt-1.5 text-[52px] text-kx-ink">
                {value}
                {cents && <sup className="ml-0.5 align-super text-[23px] text-kx-ink3">{cents}</sup>}
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
        <span className={cx('whitespace-nowrap rounded-full px-2 py-[3px] text-[10px] font-bold tracking-[.07em]', CHIP[stage])}>
            {label}{extra}
        </span>
    );
}

export function StageBar({ stage, pct }: { stage: Stage; pct: number | null }) {
    const width = pct == null ? 0 : Math.max(stage === 'paid' ? 100 : 3, Math.round(pct * 100));
    return (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar"
            aria-valuenow={pct == null ? undefined : Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
            <i className={cx('block h-full rounded-full', BAR[stage])} style={{ width: `${width}%` }} />
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

export function Section({ tone = 'neutral', title, children, className, action }: {
    tone?: Tone; title: ReactNode; children: ReactNode; className?: string; action?: ReactNode;
}) {
    return (
        <section className={cx('rounded-[var(--kx-radius-card)] border p-[18px]', SEC[tone].box, className)}>
            <div className="mb-3.5 flex items-center justify-between gap-2">
                <h2 className={cx('text-[11px] font-bold uppercase tracking-[.16em]', SEC[tone].title)}>{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

// ── Ledger row (fila-libro): name, tabular amount, optional stage band ──
export function LedgerRow({ title, sub, amount, stage, onClick, children }: {
    title: ReactNode; sub?: ReactNode; amount?: ReactNode; stage?: Stage; onClick?: () => void; children?: ReactNode;
}) {
    const band = stage && stage !== 'support' ? BAR[stage] : 'bg-transparent';
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag onClick={onClick} className={cx('relative block w-full border-t border-[var(--kx-line-soft)] py-3 pl-3 text-left first:border-t-0 first:pt-0.5',
            onClick && 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber')}>
            <span aria-hidden="true" className={cx('absolute bottom-3 left-0 top-3 w-[3px] rounded-full first:top-0.5', band)} />
            <span className="flex items-baseline justify-between gap-2.5">
                <span className="min-w-0 truncate text-[15px] font-semibold text-kx-ink">
                    {title}{sub && <span className="ml-1.5 text-[12.5px] font-normal text-kx-ink3">{sub}</span>}
                </span>
                {amount != null && <span className="kx-num whitespace-nowrap text-base font-semibold text-kx-ink">{amount}</span>}
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
            className="block w-full rounded-xl bg-kx-amber px-4 py-3 text-center text-sm font-bold text-[#111418] transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kx-amber">
            {children}
        </button>
    );
}

// ── Bottom tab bar: Inicio · Cuentas · Actividad · Ajustes ──
export function TabBar() {
    const { language } = useLanguage();
    const es = language === 'es';
    const tabs = [
        { to: '/dashboard', end: true, icon: Home, label: es ? 'Inicio' : 'Home' },
        { to: '/dashboard/accounts', icon: Wallet, label: es ? 'Cuentas' : 'Accounts' },
        { to: '/dashboard/activity', icon: Activity, label: es ? 'Actividad' : 'Activity' },
        { to: '/dashboard/settings', icon: SettingsIcon, label: es ? 'Ajustes' : 'Settings' },
    ];
    return (
        <nav aria-label={es ? 'Navegación principal' : 'Main navigation'}
            className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#131E33] bg-kx-bg px-2 pb-[max(18px,env(safe-area-inset-bottom))] pt-2.5 lg:hidden">
            {tabs.map(({ to, end, icon: Icon, label }) => (
                <NavLink key={to} to={to} end={end}
                    className={({ isActive }) => cx('flex-1 text-center text-[10.5px]', isActive ? 'font-semibold text-kx-amber' : 'text-kx-ink3')}>
                    <Icon className="mx-auto mb-1 h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden="true" />
                    {label}
                </NavLink>
            ))}
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
