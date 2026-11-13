/**
 * Reloj de dinero: what's left over per day / week / month / year, and per hour of the month.
 * Reads ONLY GET /api/cashflow/summary (engine totals); conversions live in lib/moneyClock.
 * Colors: leftover amber · earn ink · spend debt-red · short (balance < 0) debt-red.
 * kx-paid (green) is not used here: green is only payment progress and the calendar.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useCashflowSummary } from '@/hooks/useCashflowSummary';
import { perHour, perPeriod, type Period } from '@/lib/moneyClock';
import { AmberRule, BankHeader, Section } from '@/components/kx';

const PERIODS: { id: Period; es: string; en: string; esPer: string; enPer: string }[] = [
    { id: 'day', es: 'Día', en: 'Day', esPer: 'al día', enPer: 'a day' },
    { id: 'week', es: 'Semana', en: 'Week', esPer: 'a la semana', enPer: 'a week' },
    { id: 'month', es: 'Mes', en: 'Month', esPer: 'al mes', enPer: 'a month' },
    { id: 'year', es: 'Año', en: 'Year', esPer: 'al año', enPer: 'a year' },
];

export default function MoneyClockPage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Reloj de dinero' : 'Money clock');
    const { formatMoney } = useFormatMoney();
    const { data, isLoading, isError, refetch } = useCashflowSummary();
    const [period, setPeriod] = useState<Period>('day');
    const p = PERIODS.find((x) => x.id === period)!;

    // The leftover follows the unfloored balance, so a short month says "Te falta"
    const short = (data?.balance_monthly ?? 0) < 0;
    const rows = data ? [
        { key: 'earn', label: es ? 'Ganas' : 'You earn', monthly: data.income_monthly, cls: 'text-kx-ink' },
        { key: 'spend', label: es ? 'Gastas' : 'You spend', monthly: data.outflow_monthly, cls: 'text-kx-debt' },
        { key: 'left', label: short ? (es ? 'Te falta' : 'You are short') : (es ? 'Te sobra' : 'Left over'), monthly: Math.abs(data.balance_monthly), cls: short ? 'text-kx-debt' : 'text-kx-amber' },
    ] : [];

    return (
        <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Reloj de dinero' : 'Money clock'} greeting={es ? 'lo que te sobra, al ritmo de este mes' : "what's left over, at this month's pace"} />
                <AmberRule />

                {isLoading && <div className="h-48 animate-pulse rounded-[20px] bg-kx-surface" aria-busy="true" />}

                {isError && (
                    <Section tone="debt" title={es ? 'No pudimos cargar tu reloj' : "We couldn't load your clock"}>
                        <button onClick={() => refetch()} className="text-sm font-semibold text-kx-amber">{es ? 'Reintentar' : 'Retry'}</button>
                    </Section>
                )}

                {data && !data.has_income && (
                    <Section tone="neutral" title={es ? 'Tu reloj necesita tu ingreso' : 'Your clock needs your income'}>
                        <div data-testid="clock-empty">
                            <p className="text-[14px] leading-relaxed text-kx-ink2">
                                {es ? 'Para saber cuánto te sobra cada día, primero registra lo que ganas (y lo que gastas). Sin ingreso no hay cifra honesta que mostrar.'
                                    : "To know what's left each day, first record what you earn (and what you spend). Without income there's no honest figure to show."}
                            </p>
                            <Link to="/dashboard/accounts/manage" className="kx-press mt-4 block rounded-2xl bg-kx-amber py-3 text-center text-[15px] font-bold text-[#111418]">
                                {es ? 'Registrar mi ingreso' : 'Record my income'}
                            </Link>
                        </div>
                    </Section>
                )}

                {data && data.has_income && (
                    <div data-testid="clock" className="space-y-5">
                        <div>
                            <p className="kx-label">{es ? 'al ritmo de este mes' : "at this month's pace"}</p>
                            <p data-testid="clock-hero" className={`mt-2 text-[17px] ${short ? 'text-kx-debt' : 'text-kx-ink2'}`}>
                                {short ? (es ? 'Te falta' : "You're short") : (es ? 'Te sobran' : 'You have left')}
                            </p>
                            <p className={`kx-hero-number text-[64px] leading-[0.95] sm:text-[84px] ${short ? 'text-kx-debt' : 'text-kx-amber'}`}>
                                {formatMoney(perPeriod(Math.abs(data.balance_monthly), period))}
                            </p>
                            <p className="mt-1 text-[15px] text-kx-ink2">{es ? p.esPer : p.enPer}</p>
                        </div>

                        <div role="tablist" aria-label={es ? 'Periodo' : 'Period'} className="grid grid-cols-4 gap-1 rounded-2xl border border-kx-line bg-kx-surface p-1">
                            {PERIODS.map((x) => (
                                <button key={x.id} role="tab" aria-selected={period === x.id} data-testid={`period-${x.id}`} onClick={() => setPeriod(x.id)}
                                    className={`kx-press rounded-xl py-2 text-[13px] font-semibold transition-colors ${period === x.id ? 'bg-kx-amber text-[#111418]' : 'text-kx-ink2 hover:text-kx-ink'}`}>
                                    {es ? x.es : x.en}
                                </button>
                            ))}
                        </div>

                        <ul className="divide-y divide-kx-line overflow-hidden rounded-[18px] border border-kx-line bg-kx-surface shadow-[var(--kx-elev-1)]">
                            {rows.map((r) => (
                                <li key={r.key} data-testid={`row-${r.key}`} className="flex items-center justify-between gap-3 px-4 py-3.5">
                                    <span className="text-[14px] text-kx-ink2">{r.label}</span>
                                    <span className={`kx-num text-[17px] font-semibold ${r.cls}`}>{formatMoney(perPeriod(r.monthly, period))}</span>
                                </li>
                            ))}
                        </ul>

                        <div data-testid="clock-hour" className="rounded-[18px] border border-kx-line bg-kx-surface px-4 py-3.5">
                            <p className="kx-label mb-2">{es ? 'Por hora (el mes completo, 730 h)' : 'Per hour (the whole month, 730 h)'}</p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                {rows.map((r) => (
                                    <div key={r.key}>
                                        <p className="text-[11.5px] text-kx-ink3">{r.label}</p>
                                        <p className={`kx-num text-[15px] font-semibold ${r.cls}`}>{formatMoney(perHour(r.monthly))}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <p className="text-[12px] text-kx-ink3">{es ? 'Cifras estimadas con tu ingreso y gastos registrados, incluidos los pagos de tus deudas.' : 'Estimated from your recorded income and spending, debt payments included.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
