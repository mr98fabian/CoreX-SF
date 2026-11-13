/**
 * Análisis v2 — computed from the KoreX model (recurring items + subscriptions +
 * accounts), not from imported transactions. Reads ONLY GET /api/analytics/v2,
 * which composes existing sources on the server (no math here: every amount is
 * the server's, the bars and "Te quedan" already close to the cent).
 * One hero per screen. Never a $0.00 card: no data → guided empty state;
 * endpoint error → retry. "Te quedan" is the summary's balance_monthly: the
 * engine counts subscriptions (duplicates once), so this page and the Plan agree.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiFetch } from '@/lib/api';
import { MoneyAmount } from '@/components/MoneyAmount';
import { AmberRule, BankHeader, HeroNumber, Raccoon, Section } from '@/components/kx';

export interface AnalyticsV2 {
    estado: 'ok' | 'vacio';
    motivo: 'sin_recurrentes' | 'sin_ingresos' | 'sin_gastos' | null;
    etiqueta: string;
    heroe: { sale_de_tu_bolsillo: number };
    bloque: { entra: number; gastos_de_vida: number; suscripciones: number; pagos_a_deudas: number; te_quedan: number };
    en_que_se_va: { nombre: string; monto: number; tipo: 'gasto' | 'suscripciones' | 'otros'; pct: number }[];
    deudas: { interes_por_dia: number; objetivo: { nombre: string; apr: number } | null; pagado_este_mes: number };
    suscripciones: { activas: number; total_mensual: number; top_3?: { nombre: string; monto: number }[] };
    duplicados?: { cantidad: number; monto_mensual: number; servicios: string[] };
}

const CASHFLOW_ROUTE = '/dashboard/accounts/manage';
const SUBS_ROUTE = '/dashboard/subscriptions';

function EstimateChip({ es }: { es: boolean }) {
    return <span data-testid="estimate-chip" className="ml-2 inline-block rounded-full border border-kx-line px-2 py-0.5 align-middle text-[10.5px] font-semibold uppercase tracking-wide text-kx-amber">{es ? 'estimado' : 'estimate'}</span>;
}

function Line({ label, value, strong = false, sign, testId }: { label: string; value: number; strong?: boolean; sign?: '+' | '−'; testId: string }) {
    return (
        <div className={`flex items-baseline justify-between py-2 ${strong ? 'border-t border-kx-line pt-3' : ''}`} data-testid={testId}>
            <span className={strong ? 'text-sm font-semibold text-kx-ink' : 'text-sm text-kx-ink2'}>{label}</span>
            <span className={`kx-num text-sm ${strong ? 'font-semibold text-kx-ink' : 'text-kx-ink'}`}>
                {sign && <span className="mr-1 text-kx-ink3">{sign}</span>}<MoneyAmount value={value} />
            </span>
        </div>
    );
}

export default function AnalyticsPage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Análisis' : 'Analysis');
    const [data, setData] = useState<AnalyticsV2 | null>(null);
    const [error, setError] = useState(false);

    const fetchV2 = useCallback(() => apiFetch<AnalyticsV2>('/api/analytics/v2')
        .then((d) => { setData(d); setError(false); })
        .catch(() => setError(true)), []);
    useEffect(() => { fetchV2(); }, [fetchV2]);
    const retry = () => { setError(false); setData(null); fetchV2(); };

    const shell = (body: React.ReactNode) => (
        <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Análisis' : 'Analysis'} greeting={es ? 'a dónde va tu dinero' : 'where your money goes'} />
                <AmberRule />
                {body}
            </div>
        </div>
    );

    if (error) {
        return shell(
            <Section tone="debt" title={es ? 'No pudimos cargar tu análisis' : "We couldn't load your analysis"}>
                <div data-testid="analytics-error">
                    <p className="text-sm text-kx-ink2">{es ? 'Revisa tu conexión e inténtalo de nuevo. Tus datos están a salvo.' : 'Check your connection and try again. Your data is safe.'}</p>
                    <button type="button" onClick={retry} data-testid="analytics-retry" className="mt-3 text-sm font-semibold text-kx-amber">{es ? 'Reintentar' : 'Retry'}</button>
                </div>
            </Section>,
        );
    }

    if (!data) return shell(<div className="h-48 kx-shimmer rounded-[20px]" aria-busy="true" data-testid="analytics-loading" />);

    if (data.estado === 'vacio') {
        const noItems = data.motivo === 'sin_recurrentes';
        const noSpend = data.motivo === 'sin_gastos';
        return shell(
            <Section tone="amber" title={es ? 'Tu análisis empieza con tus recurrentes' : 'Your analysis starts with your recurring items'}>
                <div data-testid="analytics-empty" data-motivo={data.motivo ?? ''}>
                    <Raccoon moment="empty" className="mb-2" />
                    <p className="text-sm text-kx-ink2">
                        {noItems
                            ? (es ? 'Carga tus ingresos y gastos fijos (sueldo, renta, luz, súper…) y KoreX te muestra a dónde va tu dinero cada mes.' : 'Add your income and fixed expenses (salary, rent, utilities, groceries…) and KoreX shows you where your money goes each month.')
                            : noSpend
                                ? (es ? 'Ya tienes tu ingreso. Agrega tus gastos fijos (renta, luz, súper…) para ver a dónde se va.' : 'Your income is in. Add your fixed expenses (rent, utilities, groceries…) to see where it goes.')
                                : (es ? 'Ya tienes gastos cargados. Agrega tu ingreso para ver cuánto te queda cada mes.' : 'Your expenses are in. Add your income to see what you keep each month.')}
                    </p>
                    <Link to={CASHFLOW_ROUTE} data-testid="analytics-cta" className="mt-4 inline-flex items-center rounded-xl bg-kx-amber px-4 py-2.5 text-sm font-bold text-kx-on-amber">
                        {noItems ? (es ? 'Cargar mis recurrentes' : 'Add my recurring items') : noSpend ? (es ? 'Agregar mis gastos' : 'Add my expenses') : (es ? 'Agregar mi ingreso' : 'Add my income')}
                        <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                </div>
            </Section>,
        );
    }

    const b = data.bloque;
    const d = data.deudas;
    const label = (n: string) => (n === 'Suscripciones' ? (es ? 'Suscripciones' : 'Subscriptions') : n === 'Otros' ? (es ? 'Otros' : 'Other') : n);
    const hasDebts = b.pagos_a_deudas > 0 || !!d.objetivo;

    return shell(
        <>
            <div data-testid="analytics-hero">
                <HeroNumber
                    label={es ? 'Sale de tu bolsillo · al mes' : 'Out of your pocket · per month'}
                    amount={data.heroe.sale_de_tu_bolsillo}
                    phrase={<>{es ? 'Gastos de vida + suscripciones activas.' : 'Living expenses + active subscriptions.'}<EstimateChip es={es} /></>} />
            </div>

            <Section tone="neutral" title={es ? 'Tu mes, en cinco líneas' : 'Your month, in five lines'}>
                <div data-testid="analytics-block">
                    <Line testId="line-entra" label={es ? 'Entra' : 'Comes in'} value={b.entra} />
                    <Line testId="line-vida" label={es ? 'Gastos de vida' : 'Living expenses'} value={b.gastos_de_vida} sign="−" />
                    {b.suscripciones > 0 && <Line testId="line-subs" label={es ? 'Suscripciones' : 'Subscriptions'} value={b.suscripciones} sign="−" />}
                    {b.pagos_a_deudas > 0 && <Line testId="line-deudas" label={es ? 'Pagos a deudas' : 'Debt payments'} value={b.pagos_a_deudas} sign="−" />}
                    <Line testId="line-quedan" label={es ? 'Te quedan' : 'You keep'} value={b.te_quedan} strong />
                    <p className="mt-1 text-[11.5px] text-kx-ink3">{es ? 'Estimado con tus recurrentes y suscripciones de hoy.' : 'Estimated from your recurring items and subscriptions today.'}</p>
                    {data.duplicados && data.duplicados.cantidad > 0 && (
                        <p className="mt-1 text-[11.5px] text-kx-ink3" data-testid="dupes-note">
                            {es
                                ? <>Contamos una sola vez {data.duplicados.cantidad} {data.duplicados.cantidad === 1 ? 'servicio que tienes' : 'servicios que tienes'} como gasto y como suscripción (<MoneyAmount value={data.duplicados.monto_mensual} /> al mes).</>
                                : <>{data.duplicados.cantidad} {data.duplicados.cantidad === 1 ? 'service' : 'services'} listed both as an expense and a subscription {data.duplicados.cantidad === 1 ? 'is' : 'are'} counted once (<MoneyAmount value={data.duplicados.monto_mensual} /> a month).</>}
                        </p>
                    )}
                </div>
            </Section>

            <Section tone="neutral" title={es ? 'A dónde va tu dinero' : 'Where your money goes'}>
                <ul className="space-y-3" data-testid="analytics-bars">
                    {data.en_que_se_va.map((bar) => (
                        <li key={`${bar.tipo}-${bar.nombre}`} data-testid="bar" data-monto={bar.monto}>
                            <div className="flex items-baseline justify-between text-sm">
                                <span className="truncate text-kx-ink">{label(bar.nombre)}</span>
                                <span className="kx-num text-kx-ink2"><MoneyAmount value={bar.monto} /></span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-kx-raised">
                                <div className="kx-fill h-full rounded-full bg-kx-amber" style={{ width: `${Math.max(2, Math.min(100, bar.pct))}%` }} />
                            </div>
                        </li>
                    ))}
                </ul>
            </Section>

            {hasDebts && (
                <Section tone="neutral" title={es ? 'Tus deudas este mes' : 'Your debts this month'}>
                    <div data-testid="analytics-debts" className="space-y-1">
                        <Line testId="debt-min" label={es ? 'Pagos mínimos del mes' : 'Minimum payments this month'} value={b.pagos_a_deudas} />
                        {d.interes_por_dia > 0 && <Line testId="debt-daily" label={es ? 'Interés por día' : 'Interest per day'} value={d.interes_por_dia} />}
                        {d.objetivo && (
                            <p className="py-2 text-sm text-kx-ink2" data-testid="debt-target">
                                {es ? 'Objetivo de ataque: ' : 'Attack target: '}<b className="text-kx-ink">{d.objetivo.nombre}</b>
                                <span className="kx-tech ml-1 text-kx-ink3">{d.objetivo.apr.toFixed(2)}%</span>
                            </p>
                        )}
                        <p className="text-[13px] text-kx-ink2" data-testid="debt-paid">
                            {d.pagado_este_mes > 0
                                ? <>{es ? 'Este mes ya pagaste ' : 'This month you already paid '}<b className="kx-num text-kx-ink"><MoneyAmount value={d.pagado_este_mes} /></b>{es ? ' a tus deudas.' : ' to your debts.'}</>
                                : (es ? 'Aún no registras pagos a tus deudas este mes.' : 'No debt payments recorded this month yet.')}
                        </p>
                    </div>
                </Section>
            )}

            <Section tone="neutral" title={es ? 'Suscripciones' : 'Subscriptions'}
                action={<Link to={SUBS_ROUTE} className="flex items-center text-xs font-semibold text-kx-amber" data-testid="subs-link">{es ? 'Ver todas' : 'See all'}<ChevronRight className="h-4 w-4" /></Link>}>
                <p className="text-sm text-kx-ink2" data-testid="analytics-subs">
                    {data.suscripciones.activas > 0
                        ? <>{es ? `${data.suscripciones.activas} activas · ` : `${data.suscripciones.activas} active · `}<b className="kx-num text-kx-ink"><MoneyAmount value={data.suscripciones.total_mensual} /></b>{es ? ' al mes' : ' per month'}</>
                        : (es ? 'No tienes suscripciones registradas.' : 'No subscriptions recorded.')}
                </p>
                {(data.suscripciones.top_3?.length ?? 0) > 0 && (
                    <ul className="mt-2 space-y-1" data-testid="subs-top3">
                        {data.suscripciones.top_3!.map((x) => (
                            <li key={x.nombre} className="flex items-baseline justify-between text-sm">
                                <span className="truncate text-kx-ink">{x.nombre}</span>
                                <span className="kx-num text-kx-ink2"><MoneyAmount value={x.monto} /></span>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
        </>,
    );
}
