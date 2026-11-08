/**
 * Inicio → "Hoy tu deuda te cobra $X": the estimated interest the debt charges
 * per day, as a technical row under the hero (never a second hero). Every
 * figure comes from /api/dashboard (engine helper daily_interest + periods);
 * this file only picks which period to show. One data, one widget: it replaces
 * InterestBleedBanner, DailyInterestTicker and the old line in the stage detail.
 */
import { useState } from 'react';
import { MoneyCount } from '@/components/kx/motion';

export type Period = 'dia' | 'semana' | 'mes' | 'anio';
export type InterestPeriods = Record<Period, number>;
const KEY = 'kx-interest-period';
const LABELS: Record<Period, [string, string]> = { dia: ['Día', 'Day'], semana: ['Semana', 'Week'], mes: ['Mes', 'Month'], anio: ['Año', 'Year'] };
const LEAD: Record<Period, [string, string]> = {
    dia: ['Hoy tu deuda te cobra', 'Today your debt charges you'],
    semana: ['Esta semana tu deuda te cobra', 'This week your debt charges you'],
    mes: ['Este mes tu deuda te cobra', 'This month your debt charges you'],
    anio: ['Este año tu deuda te cobra', 'This year your debt charges you'],
};

function readPeriod(): Period {
    try {
        const v = localStorage.getItem(KEY);
        return v === 'semana' || v === 'mes' || v === 'anio' ? v : 'dia';
    } catch { return 'dia'; }
}

export function DailyInterestLine({ es, periods, debtBalances }: { es: boolean; periods: InterestPeriods | undefined; debtBalances: number[] }) {
    const [period, setPeriod] = useState<Period>(readPeriod);
    if (debtBalances.length === 0 || !periods) return null; // no debt accounts: the block doesn't exist
    const i = es ? 0 : 1;
    const owes = debtBalances.some((b) => b > 0);

    if (!owes) {
        return (
            <p data-testid="daily-interest" data-state="free" className="text-[13px] text-kx-ink2">
                {es ? 'Tu deuda ya no te cobra nada al día.' : 'Your debt no longer charges you anything per day.'}
            </p>
        );
    }
    if (periods.dia <= 0) {
        return (
            <div data-testid="daily-interest" data-state="promo" className="text-[13px] text-kx-ink2">
                <p>{es ? 'Hoy tu deuda no te cobra interés.' : "Today your debt isn't charging interest."}</p>
                <p className="text-xs text-kx-ink3">{es ? 'Tus saldos están al 0% por ahora.' : 'Your balances are at 0% for now.'}</p>
            </div>
        );
    }
    const choose = (p: Period) => { setPeriod(p); try { localStorage.setItem(KEY, p); } catch { /* private mode */ } };
    return (
        <div data-testid="daily-interest" data-state="charging" className="text-[13px] text-kx-ink2">
            <p>
                {LEAD[period][i]} <MoneyCount value={periods[period]} className="kx-num font-semibold text-kx-ink" />
                <span className="text-xs text-kx-ink3"> · {es ? 'estimado, al ritmo de hoy' : "estimate, at today's pace"}</span>
            </p>
            <div className="mt-1 flex items-center gap-3">
                <span className="text-xs text-kx-ink3">{es ? 'baja con cada pago' : 'drops with every payment'}</span>
                <span className="ml-auto flex gap-1" role="group" aria-label={es ? 'Periodo' : 'Period'}>
                    {(Object.keys(LABELS) as Period[]).map((p) => (
                        <button key={p} onClick={() => choose(p)} aria-pressed={p === period}
                            className={`rounded-full px-2 py-0.5 text-[11px] ${p === period ? 'bg-kx-raised font-semibold text-kx-ink' : 'text-kx-ink3'}`}>
                            {LABELS[p][i]}
                        </button>
                    ))}
                </span>
            </div>
        </div>
    );
}
