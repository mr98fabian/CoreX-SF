/**
 * Plan de ataque / Pago (Fase 6): the screen where you ACT.
 * Hero = today's attack ("Ataca la Amex con $X"), ONE primary button
 * (Confirmar) with its consequence phrase next to it, and the avalanche
 * drawn as a 3–4 step route (each step in its debt's stage color, the active
 * step in amber, future steps dimmed). Full simulation, plan settings and
 * other methods live one tap away (/dashboard/action-plan/full).
 *
 * Sources (engine, no math here): /api/strategy/command-center for today's
 * recommendation, the freedom-path timeline (useKxSummary) for each debt's
 * payoff month. The engine's days_accelerated is not shown: it is not
 * calibrated (documented tech debt) — the consequence uses the engine's
 * interest_saved_monthly instead.
 */
import { moment, primeAudio } from '@/lib/feedback';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { localDay } from '@/lib/stage';
import { findFundingAccount } from '@/lib/funding';
import { useKxSummary } from '@/hooks/useKxSummary';
import { useAccountLogos } from '@/hooks/useAccounts';
import { AccountLogo } from '@/components/AccountLogo';
import { AmberRule, BankHeader, PrimaryPill, Section, StageChip, StatePhrase } from '@/components/kx';
import { DrawnCheck } from '@/components/kx/motion';

interface CommandCenter {
    morning_briefing: {
        recommended_action: { amount: number; destination: string; destination_balance: number; destination_apr: number; reason: string } | null;
        impact?: { interest_saved_monthly?: number };
    } | null;
    confidence_meter?: { debts_ranked?: { name: string; apr: number; balance: number; is_target: boolean; daily_cost?: number }[]; strategy?: string };
}

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STEPS = 4;

export default function AttackPage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Plan de ataque' : 'Attack plan');
    const { formatMoney } = useFormatMoney();
    const { toast } = useToast();
    const s = useKxSummary();
    const logoOf = useAccountLogos();
    const [cc, setCc] = useState<CommandCenter | null>(null);
    const [ccError, setCcError] = useState(false);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ destination: string; amount: number } | null>(null);
    const names = es ? MONTHS_ES : MONTHS_EN;

    const fetchCc = () => apiFetch<CommandCenter>('/api/strategy/command-center').then(setCc).catch(() => setCcError(true));
    useEffect(() => { fetchCc(); }, []);

    // Payoff month per debt, from the same engine timeline as the calendar
    const payoff = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of (s.path?.timeline ?? []) as { date: string; events?: string[] }[]) {
            for (const ev of p.events ?? []) {
                const name = ev.replace(/ (Paid Off|Eliminated)$/, ''); // engine emits both forms
                if (!map.has(name)) {
                    const [y, m] = p.date.split('-').map(Number);
                    map.set(name, `${names[m - 1]} ${y}`);
                }
            }
        }
        return map;
    }, [s.path, names]);

    const funding = findFundingAccount(s.staged);
    // After confirming, keep showing what was just paid (the engine already recommends the next one)
    const rec = done ? { amount: done.amount, destination: done.destination, destination_balance: done.amount, destination_apr: cc?.morning_briefing?.recommended_action?.destination_apr ?? 0, reason: '' }
        : (cc?.morning_briefing?.recommended_action ?? null);
    // Presentation cap only: never ask to send more than the debt owes or the account holds
    const amount = rec ? Math.min(rec.amount, rec.destination_balance, funding?.bal ?? rec.amount) : 0;
    const ranked = (cc?.confidence_meter?.debts_ranked ?? []).slice(0, STEPS);
    const stageByName = new Map(s.debts.map((d) => [d.name, d.stage]));
    const saved = cc?.morning_briefing?.impact?.interest_saved_monthly ?? 0;

    const confirm = async () => {
        if (!rec || !funding || amount <= 0) return;
        primeAudio();
        setBusy(true);
        try {
            await apiFetch('/api/strategy/execute', {
                method: 'POST',
                body: JSON.stringify({
                    movement_key: `attack-${localDay()}-${rec.destination.replace(/\s/g, '')}`,
                    title: es ? `Ataque a ${rec.destination}` : `Attack on ${rec.destination}`,
                    amount, date_planned: localDay(), source: funding.name, destination: rec.destination,
                }),
            });
            setDone({ destination: rec.destination, amount });
            moment('payment');
            toast({ title: es ? `Ataque confirmado: ${formatMoney(amount)} a ${rec.destination}` : `Attack confirmed: ${formatMoney(amount)} to ${rec.destination}` });
            s.reload(); fetchCc();
        } catch {
            toast({ title: es ? 'No se pudo confirmar el ataque' : "Couldn't confirm the attack", variant: 'destructive' });
        } finally {
            setBusy(false);
        }
    };

    const loading = s.loading || (!cc && !ccError);

    return (
        <div className="kx-scope -m-4 min-h-full pb-28 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Plan de ataque' : 'Attack plan'} greeting={es ? 'la pantalla de actuar' : 'where you act'} />
                <AmberRule />

                {loading && <div className="h-48 kx-shimmer rounded-[20px]" aria-busy="true" />}
                {!loading && (s.error || ccError) && (
                    <Section tone="debt" title={es ? 'No pudimos cargar tu plan' : "We couldn't load your plan"}>
                        <button onClick={() => { setCcError(false); s.reload(); fetchCc(); }} className="text-sm font-semibold text-kx-amber">{es ? 'Reintentar' : 'Retry'}</button>
                    </Section>
                )}

                {!loading && !s.error && !ccError && (!rec || amount <= 0) && (
                    <Section tone={s.debts.length ? 'paid' : 'neutral'} title={es ? 'Hoy no hay ataque' : 'No attack today'}>
                        <p className="text-sm text-kx-ink2">
                            {s.debts.length === 0
                                ? (es ? 'Agrega tus deudas para que KoreX arme tu ruta.' : 'Add your debts so KoreX can build your route.')
                                : (es ? 'Tu efectivo disponible hoy está cubriendo tu escudo: no hay monto libre para atacar.' : 'Your cash today is covering your shield: nothing free to attack with.')}
                        </p>
                    </Section>
                )}

                {!loading && !s.error && rec && amount > 0 && (
                    <>
                        <StatePhrase tone={done ? 'paid' : 'amber'}>
                            {done ? (es ? 'Listo: tu ataque de hoy quedó registrado. Míralo en Actividad.' : 'Done: today’s attack is recorded. See it in Activity.')
                                : (es ? `Hoy toca atacar la ${rec.destination}: es la que más interés te cobra.` : `Today you attack ${rec.destination}: it charges you the most interest.`)}
                        </StatePhrase>

                        <div>
                            <p className="kx-label">{es ? 'Tu ataque de hoy' : 'Today’s attack'}</p>
                            <p className="mt-1.5 text-[17px] text-kx-ink2">{done ? (es ? `Atacaste la ${rec.destination} con` : `You attacked ${rec.destination} with`) : (es ? `Ataca la ${rec.destination} con` : `Attack ${rec.destination} with`)}</p>
                            {/* The v9 editorial graft: the giant number is the hero of the screen where you act */}
                            <p className="kx-hero-number text-[68px] leading-[0.95] text-kx-ink sm:text-[88px]">{formatMoney(amount)}</p>
                            <p className="mt-2 text-[13.5px] text-kx-ink2">
                                {funding && <>{es ? 'Sale de ' : 'From '}<b className="font-semibold text-kx-ink">{funding.name}</b></>}
                                {!done && <>{es ? ` · tasa de la deuda ` : ` · debt rate `}<span className="kx-tech">{rec.destination_apr.toFixed(2)}%</span></>}
                            </p>
                        </div>

                        <div className="space-y-2.5">
                            {!funding && !done && (
                                <p role="alert" className="rounded-[14px] border border-kx-line bg-kx-raised px-4 py-3 text-[13.5px] text-kx-ink">
                                    {es ? 'Te falta una cuenta de fondeo: agrega la cuenta de donde sale el dinero para poder confirmar ataques.'
                                        : 'You need a funding account: add the account the money comes from to confirm attacks.'}
                                    {' '}<Link to="/accounts" className="font-semibold text-kx-amber">{es ? 'Agregar cuenta' : 'Add account'}</Link>
                                </p>
                            )}
                            <PrimaryPill onClick={confirm} disabled={busy || !!done || !funding}>{done ? <span className="inline-flex items-center gap-1.5">{es ? 'Confirmado' : 'Confirmed'}<DrawnCheck /></span> : (es ? 'Confirmar' : 'Confirm')}</PrimaryPill>
                            {saved > 0 && !done && (
                                <p className="text-center text-[13px] text-kx-ink2">
                                    {es ? 'Si pagas hoy, dejas de pagar ≈ ' : 'If you pay today, you stop paying ≈ '}
                                    <b className="kx-num font-semibold text-kx-ink">{formatMoney(saved)}</b>{es ? ' de interés al mes (estimado).' : ' in interest a month (estimate).'}
                                </p>
                            )}
                        </div>
                    </>
                )}

                {!loading && ranked.length > 0 && (
                    <Section tone="neutral" bare title={es ? 'Tu ruta · avalancha' : 'Your route · avalanche'}>
                        {/* One ledger: editorial step numbers, hairlines, amber band = today's target */}
                        <ol className="kx-rows overflow-hidden rounded-[var(--kx-radius-card)] border border-kx-line bg-kx-surface">
                            {ranked.map((d, i) => {
                                const active = d.is_target || (i === 0 && !ranked.some((x) => x.is_target));
                                const stage = stageByName.get(d.name) ?? 'debt';
                                const when = payoff.get(d.name);
                                return (
                                    <li key={d.name} className={`relative flex items-start gap-3.5 border-t border-[var(--kx-line-soft)] px-4 py-3 first:border-t-0 ${active ? 'bg-[rgba(245,158,11,.06)]' : ''}`}>
                                        {active && <span aria-hidden="true" className="absolute bottom-3 left-0 top-3 w-[3px] rounded-full bg-kx-amber" />}
                                        <span className={`kx-num font-editorial w-6 flex-none text-right text-[26px] leading-none ${active ? 'text-kx-amber' : 'text-kx-ink3'}`}>{i + 1}</span>
                                        <span className={`min-w-0 flex-1 ${active ? '' : 'opacity-70'}`}>
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="flex min-w-0 items-center gap-2.5">
                                                    <AccountLogo name={d.name} src={logoOf(d.name)} />
                                                    <span className="truncate text-[15px] font-semibold text-kx-ink">{d.name}</span>
                                                </span>
                                                <StageChip stage={stage} suffix="" />
                                            </span>
                                            <span className="mt-0.5 block text-[12.5px] text-kx-ink2">
                                                {when ? (es ? `muere en ${when} (estimado)` : `paid off in ${when} (estimate)`) : (es ? 'fecha por calcular' : 'date pending')}
                                                {' · '}<span className="kx-tech">{d.apr.toFixed(2)}%</span>
                                                {d.daily_cost != null && d.daily_cost > 0 && (
                                                    <span data-testid="daily-cost">{es ? ' · te cobra ' : ' · charges you '}<span className="kx-num">{formatMoney(d.daily_cost)}</span>{es ? '/día' : '/day'}</span>
                                                )}
                                            </span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </Section>
                )}

                {!loading && (
                    <Link to="/dashboard/action-plan/full" className="block rounded-full border border-dashed border-[#263449] py-3 text-center text-[13px] text-kx-ink3">
                        {es ? 'Simulación completa, ajustes del plan y otros métodos · ' : 'Full simulation, plan settings and other methods · '}<b className="font-semibold text-kx-ink2">{es ? 'abrir' : 'open'}</b>
                    </Link>
                )}
            </div>
        </div>
    );
}
