/**
 * Inicio («Cobre a la vista», misión 19, direccion-de-arte §6.2): state phrase first → ONE
 * hero («Debes ≈») with the screen's light → a funda-coloured connector carrying the two
 * data and the daily interest → the mission, whose button is the only copper surface.
 * Comparison, stages, house and league fold under «Tu avance en detalle».
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/features/auth/AuthContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useKxSummary } from '@/hooks/useKxSummary';
import { MissionCard } from '@/components/kx/MissionCard';
import { BankHeader, Connector, EmptyState, ErrorState, HeroNumber, PaidStamp, Section, StatePhrase } from '@/components/kx';
import { KxAccounts } from '@/components/kx/icons';
import { StampDrop } from '@/components/kx/motion';
import { useJustPaid } from '@/hooks/useJustPaid';
import { useVelocityCompare } from '@/hooks/useVelocityCompare';
import { CompareChart } from './CompareChart';
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
    const compare = useVelocityCompare();
    const [showMore, setShowMore] = useState(false);
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
                <ErrorState text={es ? 'No pudimos cargar tus datos. Revisa tu conexión; tus datos están a salvo.' : "We couldn't load your data. Check your connection; your data is safe."}
                    retry={es ? 'Reintentar' : 'Retry'} onRetry={s.reload} />
            </div>
        );
    }

    const noDebt = s.debts.length === 0 || s.totalDebt <= 0;
    const freedomLabel = s.freedom ? `${names[s.freedom.month]} ${s.freedom.year}` : null;

    // Rule 2: the plain-language state comes BEFORE any number (§5.2: no exclamations)
    const phrase = noDebt
        ? (s.debts.length === 0
            ? (es ? 'Aún no hay deudas: agrega la primera para ver tu camino.' : 'No debts yet: add your first one to see your path.')
            : (es ? 'Sin deuda. Todas tus cuentas están en $0.' : 'Debt-free. All your accounts are at $0.'))
        : s.counts.paid > 0
            ? (es ? `Vas bien: ${s.counts.paid} ${s.counts.paid === 1 ? 'deuda ya está' : 'deudas ya están'} en $0.` : `On track: ${s.counts.paid} ${s.counts.paid === 1 ? 'debt is' : 'debts are'} already at $0.`)
            : (es ? 'Tu plan está en marcha: cada pago acerca el verde.' : 'Your plan is moving: every payment brings the green closer.');

    // §6.2: ONE hero («Debes ≈») with its light → a funda-coloured connector down to the
    // mission, whose button is the only copper surface on the screen. Everything else folds.
    return (
        <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="px-6 pb-1 pt-4">
                <BankHeader greeting={firstName ? (es ? `Hola, ${firstName}` : `Hi, ${firstName}`) : undefined} />
            </div>

            <div className="mx-auto max-w-xl space-y-5 px-5 pt-4">
                <StatePhrase tone={s.counts.paid > 0 || noDebt ? 'paid' : 'amber'}>{phrase}</StatePhrase>
                {justPaid.size > 0 && (
                    <p className="flex items-center gap-3 text-sm text-kx-ink2">
                        <StampDrop drop><PaidStamp /></StampDrop>
                        {es ? `${s.staged.filter((a) => justPaid.has(a.id)).map((a) => a.name).join(', ')} llegó a $0.` : `${s.staged.filter((a) => justPaid.has(a.id)).map((a) => a.name).join(', ')} hit $0.`}
                    </p>
                )}

                {s.debts.length === 0 ? (
                    <EmptyState icon={KxAccounts} text={es ? 'Aún no has añadido cuentas.' : "You haven't added any accounts yet."}
                        action={es ? 'Añadir cuenta' : 'Add account'} to="/dashboard/accounts/manage" />
                ) : (
                    <>
                        <HeroNumber label={es ? 'Debes ≈' : 'You owe ≈'} amount={s.totalDebt}
                            phrase={<span data-testid="freedom-line">{es ? 'Libre de deudas: ' : 'Debt-free: '}<b className="font-semibold capitalize text-kx-ink">{noDebt ? (es ? 'hoy' : 'today') : freedomLabel ?? (es ? 'calculando…' : 'calculating…')}</b>
                                <span className="text-kx-ink3">{es ? ' · al ritmo actual de tu plan (estimado)' : ' · at your plan’s current pace (estimate)'}</span></span>} />

                        <Connector>
                            <div className="space-y-3 pb-4">
                                <p className="kx-tech text-[13px] text-kx-ink2" data-testid="two-data">
                                    {es ? 'Disponible para tu plan: ' : 'Available for your plan: '}<b className="kx-num font-semibold text-kx-ink">{formatMoney(s.available)}</b>
                                    <span className="text-kx-ink3">{es ? ' · Efectivo en cuentas: ' : ' · Cash in accounts: '}{formatMoney(s.liquid)}</span>
                                </p>
                                <DailyInterestLine es={es} periods={s.dailyPeriods} debtBalances={s.debts.map((a) => a.bal)} />
                            </div>
                        </Connector>

                        {/* HOY — the single active signal: the server's mission, same as the Plan */}
                        {s.mission && (
                            <MissionCard mission={s.mission} faltante={s.faltante} es={es}
                                action={<Link to="/dashboard/action-plan" data-testid="mission-action"
                                    className="kx-press mt-3 flex min-h-[48px] items-center justify-center rounded-xl bg-kx-amber px-4 text-sm font-bold text-kx-on-amber focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kx-amber">
                                    {es ? 'Ver cómo hacerlo' : 'See how'}</Link>} />
                        )}

                        {/* Comparison, stages, house and league: folded by default (§6.2) */}
                        <button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} data-testid="home-more"
                            className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-kx-line px-4 text-[13.5px] text-kx-ink2">
                            {es ? 'Tu avance en detalle' : 'Your progress in detail'}
                            <ChevronRight className={`h-4 w-4 transition-transform duration-[var(--kx-dur-base)] ${showMore ? 'rotate-90' : ''}`} />
                        </button>
                        {showMore && (
                            <div className="space-y-6" data-testid="home-more-panel">
                                {!noDebt && compare.data && compare.data.estado !== 'sin_deudas' && (
                                    <CompareChart data={compare.data} es={es}
                                        action={<Link to="/dashboard/calendar" className="flex min-h-[44px] items-center text-xs font-semibold text-kx-amber-text">{es ? 'Ver calendario' : 'Open calendar'}<ChevronRight className="h-4 w-4" /></Link>} />
                                )}
                                <Section tone="neutral" bare title={es ? 'Tus deudas en 3 colores' : 'Your debts in 3 colors'}>
                                    <div className="kx-rows overflow-hidden rounded-[18px] border border-kx-line">
                                        {([
                                            ['debt', es ? 'En deuda' : 'In debt', 'text-kx-debt', 'var(--kx-debt-bar)'],
                                            ['almost', es ? 'Casi' : 'Almost', 'text-kx-almost', 'var(--kx-almost-bar)'],
                                            ['paid', es ? 'Pagadas' : 'Paid', 'text-kx-paid', 'var(--kx-paid-bar)'],
                                        ] as const).map(([stage, label, ink, color]) => (
                                            <button key={stage} onClick={() => navigate(`/dashboard/accounts?stage=${stage}`)}
                                                className="kx-press flex min-h-[44px] w-full items-center gap-3 border-t border-white/[.06] px-4 py-3 text-left first:border-t-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kx-amber">
                                                <span className="h-7 w-[3px] flex-none rounded-full" style={{ background: color }} aria-hidden="true" />
                                                <span className={`flex-1 text-[12px] font-bold uppercase tracking-[.12em] ${ink}`}>{label}</span>
                                                <span className={`kx-num font-editorial text-[28px] leading-none ${ink}`}>{s.counts[stage]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </Section>
                                <HouseModule es={es} />
                                <LeagueBlock es={es} />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
