/**
 * Plan («Cobre a la vista», misión 19, direccion-de-arte §6.4) — the screen where you act.
 * ONE hero: the debt-free date (Fraunces, with the screen's light). Then today's mission or
 * attack with ONE primary button (Confirmar), and the avalanche as one vertical line from
 * today to the free month: each debt that ends is a mark (name + month in Plex Mono), icon 14
 * closes it. Full simulation, plan settings and other methods live one tap away
 * (/dashboard/action-plan/full).
 *
 * Sources (engine, no math here): /api/strategy/command-center for today's recommendation,
 * the freedom-path timeline (useKxSummary) for each debt's payoff month and the free month.
 */
import { moment, primeAudio } from '@/lib/feedback';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { localDay } from '@/lib/stage';
import { findFundingAccount } from '@/lib/funding';
import { useKxSummary } from '@/hooks/useKxSummary';
import { useCommandCenter } from '@/hooks/useCommandCenter';
import { BankHeader, ErrorState, PrimaryPill, Section, StatePhrase, VerticalLine } from '@/components/kx';
import { PlanAxis, type AxisMark } from '@/features/actionplan/PlanAxis';
import { DrawnCheck } from '@/components/kx/motion';
import { MissionCard } from '@/components/kx/MissionCard';
import { MoneyAmount } from '@/components/MoneyAmount';

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const STEPS = 4;

export default function AttackPage() {
    const { language } = useLanguage();
    const es = language === 'es';
    const freedomText = (f: { year: number; month: number }) => `${(es ? MONTHS_ES : MONTHS_EN)[f.month]} ${es ? 'de ' : ''}${f.year}`;
    usePageTitle(es ? 'Plan de ataque' : 'Attack plan');
    const { formatMoney } = useFormatMoney();
    const { toast } = useToast();
    const s = useKxSummary();
    // Cached (React Query): a revisit paints at once and refreshes behind; plan writes invalidate it (lib/planSync)
    const ccQuery = useCommandCenter();
    const cc = ccQuery.data ?? null;
    const ccError = ccQuery.isError && !cc;
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState<{ destination: string; amount: number } | null>(null);

    // Payoff month per debt, from the same engine timeline as the calendar
    const payoffMonth = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of (s.path?.timeline ?? []) as { date: string; events?: string[] }[]) {
            for (const ev of p.events ?? []) {
                const name = ev.replace(/ (Paid Off|Eliminated)$/, '');
                if (!map.has(name)) map.set(name, p.date.slice(0, 7));
            }
        }
        return map;
    }, [s.path]);

    const funding = findFundingAccount(s.staged);
    // After confirming, keep showing what was just paid (the engine already recommends the next one)
    const rec = done ? { amount: done.amount, destination: done.destination, destination_balance: done.amount, destination_apr: cc?.morning_briefing?.recommended_action?.destination_apr ?? 0, reason: '' }
        : (cc?.morning_briefing?.recommended_action ?? null);
    // The server already caps it (attack_impact: never more than the debt owes or the cash held)
    const amount = rec ? rec.amount : 0;
    const ranked = (cc?.confidence_meter?.debts_ranked ?? []).slice(0, STEPS);
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
            // No manual refresh: the POST is a plan write, so apiFetch already invalidated the plan (summary + command-center)
        } catch {
            toast({ title: es ? 'No se pudo confirmar el ataque' : "Couldn't confirm the attack", variant: 'destructive' });
        } finally {
            setBusy(false);
        }
    };

    const loading = s.loading || (!cc && !ccError);
    // The same mission Inicio shows (server). An obligation comes first; the attack is what is left after it.
    const mission = cc?.mision?.mision ?? null;
    const obligationFirst = !!mission && mission.tipo !== 'avalancha';
    // §6.4 axis: each debt ends where the server's timeline says (its own event); paid ones on top
    const paidNow = s.debts.filter((d) => d.bal <= 0).map((d) => d.name);
    const allPaid = s.debts.length > 0 && paidNow.length === s.debts.length;
    const daily = new Map(ranked.map((d) => [d.name, d.daily_cost ?? 0]));
    const marks: AxisMark[] = s.debts.filter((d) => d.bal > 0 && payoffMonth.has(d.name))
        .map((d) => ({ name: d.name, month: payoffMonth.get(d.name)!, note: daily.get(d.name) ? (es ? `te cobra ${formatMoney(daily.get(d.name)!)}/día` : `charges ${formatMoney(daily.get(d.name)!)}/day`) : undefined }));
    const freedomIso = s.freedom ? `${s.freedom.year}-${String(s.freedom.month + 1).padStart(2, '0')}-01` : null;

    return (
        <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Plan de ataque' : 'Attack plan'} greeting={es ? 'la pantalla de actuar' : 'where you act'} />

                {/* §6.4: ONE hero — the debt-free date — then the plan as one vertical line */}
                {!loading && !s.error && allPaid && (
                    <div className="space-y-4" data-testid="plan-free">
                        <h2 className="kx-screen-title text-kx-ink">{es ? 'Sin deudas.' : 'Debt-free.'}</h2>
                        <div className="relative" style={{ height: 120 }}>
                            <VerticalLine done={1} height={120} label={es ? 'Plan completo' : 'Plan complete'} />
                        </div>
                    </div>
                )}
                {!loading && !s.error && !allPaid && s.freedom && (
                    <div className="relative" data-testid="hero">
                        <span aria-hidden="true" className="pointer-events-none absolute -inset-x-4 -inset-y-10 -z-10" style={{ background: 'var(--kx-foco)' }} />
                        <p className="kx-label">{es ? 'Libre de deudas · estimado' : 'Debt-free · estimate'}</p>
                        <p className={`kx-hero-number mt-1.5 first-letter:uppercase text-kx-ink ${freedomText(s.freedom).length > 9 ? 'text-[44px]' : 'text-[56px]'}`}>{freedomText(s.freedom)}</p>
                    </div>
                )}

                {loading && <div className="h-48 kx-shimmer rounded-[20px]" aria-busy="true" />}
                {!loading && (s.error || ccError) && <ErrorState text={es ? 'No pudimos cargar tu plan.' : "We couldn't load your plan."} retry={es ? 'Reintentar' : 'Retry'} onRetry={s.reload} />}

                {!loading && !s.error && !ccError && cc?.excedente?.comido_por_suscripciones && (
                    <Section tone="debt" title={es ? 'Tus suscripciones se comen todo tu excedente' : 'Your subscriptions eat your whole surplus'}>
                        <p className="text-sm text-kx-ink2" data-testid="subs-eat-surplus">
                            {es ? 'Pagas ' : 'You pay '}<b className="kx-num text-kx-ink"><MoneyAmount value={cc.excedente.suscripciones_mensuales} /></b>
                            {es ? ' al mes en suscripciones y no queda excedente para atacar: tu plan va solo con los pagos mínimos (estimado). Revisa cuáles puedes cancelar.'
                                : ' a month in subscriptions and nothing is left to attack with: your plan runs on minimum payments only (estimate). See which ones you can cancel.'}
                        </p>
                        <Link to="/dashboard/subscriptions" className="mt-2 inline-block text-sm font-semibold text-kx-amber">{es ? 'Ver mis suscripciones' : 'See my subscriptions'}</Link>
                    </Section>
                )}

                {!loading && !s.error && !ccError && obligationFirst && mission && <MissionCard mission={mission} faltante={cc?.mision?.faltante} es={es} />}

                {!loading && !s.error && !ccError && !obligationFirst && (!rec || amount <= 0) && (
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
                                : obligationFirst
                                    ? (es ? `Con lo que sobra después de ese pago, ataca la ${rec.destination}: es la que más interés te cobra.` : `With what is left after that payment, attack ${rec.destination}: it charges you the most interest.`)
                                    : (es ? `Hoy toca atacar la ${rec.destination}: es la que más interés te cobra.` : `Today you attack ${rec.destination}: it charges you the most interest.`)}
                        </StatePhrase>

                        <div>
                            <p className="kx-label">{es ? 'Tu ataque de hoy' : 'Today’s attack'}</p>
                            <p className="mt-1.5 text-[17px] text-kx-ink2">{done ? (es ? `Atacaste la ${rec.destination} con` : `You attacked ${rec.destination} with`) : (es ? `Ataca la ${rec.destination} con` : `Attack ${rec.destination} with`)}</p>
                            {/* Misión 19: the screen's one hero is the debt-free date; the attack is the action's figure */}
                            <p className="kx-num font-editorial text-[34px] leading-none text-kx-ink" data-testid="attack-amount">{formatMoney(amount)}</p>
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

                {!loading && !s.error && !allPaid && freedomIso && (
                    <Section tone="neutral" bare title={es ? 'Tu ruta · avalancha' : 'Your route · avalanche'}>
                        <PlanAxis today={localDay()} freedom={freedomIso} marks={marks} paidNow={paidNow} es={es} />
                    </Section>
                )}

                {!loading && (
                    <Link to="/dashboard/action-plan/full" className="block min-h-[44px] rounded-full border border-dashed border-kx-line py-3 text-center text-[13px] text-kx-ink3">
                        {es ? 'Simulación completa, ajustes del plan y otros métodos · ' : 'Full simulation, plan settings and other methods · '}<b className="font-semibold text-kx-ink2">{es ? 'abrir' : 'open'}</b>
                    </Link>
                )}
            </div>
        </div>
    );
}
