/**
 * Inicio (Fase 6, approved v7): state phrase first → ONE hero number (total
 * debt) → amber stripe with the debt-free date → three named sections:
 * HOY (the only active signal), TU AVANCE (calendar heat map), TUS DEUDAS EN 3
 * COLORES (tap a color → Cuentas filtered). Details (daily interest, APRs,
 * minimums) live one tap away.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/features/auth/AuthContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { usePageTitle } from '@/hooks/usePageTitle';
import { nextCut, useKxSummary } from '@/hooks/useKxSummary';
import { AmberStripe, BankHeader, HeroNumber, PaidStamp, Section, StatePhrase } from '@/components/kx';
import { StampDrop } from '@/components/kx/motion';
import { useJustPaid } from '@/hooks/useJustPaid';
import { DebtCalendar } from '@/components/kx/DebtCalendar';
import { HouseModule } from './HouseModule';
import { DailyInterestLine } from './DailyInterestLine';
import { LeagueBlock } from './LeagueBlock';

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function HomePage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Inicio' : 'Home');
    const { user } = useAuth();
    const { formatMoney } = useFormatMoney();
    const navigate = useNavigate();
    const s = useKxSummary();
    const [showDetail, setShowDetail] = useState(false);
    const justPaid = useJustPaid(s.staged);
    const names = es ? MONTHS_ES : MONTHS_EN;
    const firstName = (user?.user_metadata?.full_name || '').split(' ')[0];

    if (s.loading) {
        return (
            <div className="kx-scope -m-4 min-h-full space-y-4 p-5 md:-m-8 md:p-8" aria-busy="true">
                <div className="h-[158px] kx-shimmer rounded-2xl" />
                <div className="h-6 w-2/3 kx-shimmer rounded" />
                <div className="h-14 w-1/2 kx-shimmer rounded" />
                <div className="h-40 kx-shimmer rounded-[20px]" />
                <p className="sr-only">{es ? 'Cargando tu Inicio…' : 'Loading your home…'}</p>
            </div>
        );
    }

    if (s.error) {
        return (
            <div className="kx-scope -m-4 min-h-full p-5 md:-m-8 md:p-8">
                <Section tone="debt" title={es ? 'No pudimos cargar tus datos' : "We couldn't load your data"}>
                    <p className="text-sm text-kx-ink2">{es ? 'Revisa tu conexión e inténtalo de nuevo. Tus datos están a salvo.' : 'Check your connection and try again. Your data is safe.'}</p>
                    <button onClick={s.reload} className="mt-3 text-sm font-semibold text-kx-amber">{es ? 'Reintentar' : 'Retry'}</button>
                </Section>
            </div>
        );
    }

    const cut = nextCut(s.debts);
    const noDebt = s.debts.length === 0 || s.totalDebt <= 0;
    const freedomLabel = s.freedom ? `${names[s.freedom.month]} ${s.freedom.year}` : null;

    // Rule 2: the plain-language state comes BEFORE any number
    const phrase = noDebt
        ? (s.debts.length === 0
            ? (es ? 'Aún no hay deudas: agrega la primera para ver tu camino.' : 'No debts yet: add your first one to see your path.')
            : (es ? '¡Sin deuda! Todas tus cuentas están en $0.' : 'Debt-free! All your accounts are at $0.'))
        : s.counts.paid > 0
            ? (es ? `Vas bien: ${s.counts.paid} ${s.counts.paid === 1 ? 'deuda ya está' : 'deudas ya están'} en $0.` : `On track: ${s.counts.paid} ${s.counts.paid === 1 ? 'debt is' : 'debts are'} already at $0.`)
            : (es ? 'Tu plan está en marcha: cada pago acerca el verde.' : 'Your plan is moving: every payment brings the green closer.');

    return (
        <div className="kx-scope -m-4 min-h-full pb-28 md:-m-8 lg:pb-10">
            <AmberStripe>
                <BankHeader greeting={firstName ? (es ? `Hola, ${firstName}` : `Hi, ${firstName}`) : undefined} />
                <div className="mt-auto pb-[18px]">
                    <p className="text-[12.5px] text-kx-ink">{es ? 'Libre de deudas' : 'Debt-free'}</p>
                    <p className="font-editorial text-[27px] font-[500] capitalize tracking-tight text-kx-ink">
                        {noDebt ? (es ? 'Hoy' : 'Today') : freedomLabel ?? (es ? 'Calculando…' : 'Calculating…')}
                    </p>
                    <p className="text-[12.5px] text-kx-ink">{es ? 'al ritmo actual de tu plan (estimado)' : 'at your plan’s current pace (estimate)'}</p>
                </div>
            </AmberStripe>

            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <StatePhrase tone={s.counts.paid > 0 || noDebt ? 'paid' : 'amber'}>{phrase}</StatePhrase>
                {justPaid.size > 0 && (
                    <p className="flex items-center gap-3 text-sm text-kx-ink2">
                        <StampDrop drop><PaidStamp /></StampDrop>
                        {es ? `${s.staged.filter((a) => justPaid.has(a.id)).map((a) => a.name).join(', ')} llegó a $0.` : `${s.staged.filter((a) => justPaid.has(a.id)).map((a) => a.name).join(', ')} hit $0.`}
                    </p>
                )}

                <HeroNumber label={es ? 'Deuda total' : 'Total debt'} amount={s.totalDebt}
                    phrase={<>{es ? 'Disponible para tu plan: ' : 'Available for your plan: '}<b className="kx-num font-semibold text-kx-ink">{formatMoney(s.liquid)}</b></>} />
                <DailyInterestLine es={es} periods={s.dailyPeriods} debtBalances={s.debts.map((a) => a.bal)} />

                {/* HOY — the single active signal */}
                {cut && (
                    <Section tone="amber" title={es ? 'Hoy · tu único pendiente' : 'Today · your one to-do'}>
                        <div className="flex items-center gap-4">
                            <div className="flex-none border-r border-[rgba(245,158,11,.3)] pr-4 text-center">
                                <p className="kx-num font-editorial text-2xl text-kx-ink">{cut.date.getDate()}</p>
                                <p className="kx-tech text-[10px] uppercase text-kx-amber-soft">{names[cut.date.getMonth()].slice(0, 3)}</p>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[15px] font-semibold text-kx-ink">{es ? `Corta la ${cut.acc.name}` : `${cut.acc.name} closes`}</p>
                                <p className="text-[13.5px] text-kx-ink2">
                                    {es ? 'Te faltan ' : 'You need '}<b className="kx-num font-semibold text-kx-amber-soft">{formatMoney(cut.acc.bal)}</b>
                                    {es ? ' para reportar $0 ese día.' : ' to report $0 that day.'}
                                </p>
                            </div>
                        </div>
                    </Section>
                )}

                {/* TU AVANCE — the calendar (heat map here; full piece one tap away) */}
                {!noDebt && (
                    <Section tone="neutral" bare title={es ? 'Tu avance · el color es tu deuda' : 'Your progress · color is your debt'}
                        action={<Link to="/dashboard/calendar" className="flex items-center text-xs font-semibold text-kx-amber">{es ? 'Ver calendario' : 'Open calendar'}<ChevronRight className="h-4 w-4" /></Link>}>
                        <DebtCalendar compact months={s.months} maxDebt={s.totalDebt} paydays={s.paydays} cutDays={s.cutDays} chargesIn={s.chargesIn} dayDetail={s.dayDetail} />
                    </Section>
                )}

                {/* TUS DEUDAS EN 3 COLORES — tap filters Cuentas */}
                {s.debts.length > 0 && (
                    <Section tone="neutral" bare title={es ? 'Tus deudas en 3 colores' : 'Your debts in 3 colors'}>
                        {/* One continuous panel, ledger rows — same treatment as the calendar */}
                        <div className="kx-rows overflow-hidden rounded-[18px] border border-kx-line">
                            {([
                                ['debt', es ? 'En deuda' : 'In debt', 'text-kx-debt', 'var(--kx-debt-bar)'],
                                ['almost', es ? 'Casi' : 'Almost', 'text-kx-almost', 'var(--kx-almost-bar)'],
                                ['paid', es ? 'Pagadas' : 'Paid', 'text-kx-paid', 'var(--kx-paid-bar)'],
                            ] as const).map(([stage, label, ink, color]) => (
                                <button key={stage} onClick={() => navigate(`/dashboard/accounts?stage=${stage}`)}
                                    className="kx-press flex w-full items-center gap-3 border-t border-white/[.06] px-4 py-3 text-left first:border-t-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kx-amber"
                                    style={{ background: `linear-gradient(90deg, color-mix(in srgb, ${color} 16%, transparent), transparent 70%)` }}>
                                    <span className="h-7 w-[3px] flex-none rounded-full" style={{ background: color }} aria-hidden="true" />
                                    <span className={`flex-1 text-[12px] font-bold uppercase tracking-[.12em] ${ink}`}>{label}</span>
                                    <span className={`kx-num font-editorial text-[28px] leading-none ${ink}`}>{s.counts[stage]}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowDetail((v) => !v)} aria-expanded={showDetail}
                            className="mt-4 w-full rounded-full border border-dashed border-[#263449] py-2.5 text-[13px] text-kx-ink3">
                            {showDetail ? (es ? 'Ocultar detalle' : 'Hide detail') : (es ? 'El detalle vive a un toque · ver' : 'Detail is one tap away · show')}
                        </button>
                        {showDetail && (
                            <div className="mt-3 space-y-1.5 text-[13px] text-kx-ink2">
                                <Link to="/dashboard/accounts" className="block font-semibold text-kx-amber">{es ? 'Tasas, mínimos y fechas por cuenta ›' : 'Rates, minimums and dates per account ›'}</Link>
                            </div>
                        )}
                    </Section>
                )}

                <HouseModule es={es} />
                <LeagueBlock es={es} />

                {s.debts.length === 0 && (
                    <Link to="/dashboard/accounts" className="block rounded-xl bg-kx-amber py-3 text-center text-sm font-bold text-[#111418]">
                        {es ? 'Agregar mi primera deuda' : 'Add my first debt'}
                    </Link>
                )}
            </div>
        </div>
    );
}
