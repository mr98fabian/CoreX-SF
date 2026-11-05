/**
 * DebtCalendar — KoreX's signature piece: your debt painted on time.
 * Each day's background is the projected total debt that day (red → yellow →
 * green at $0); ‹ › navigates month by month to the freedom month; paydays get
 * a blue dot; the $0 day gets a ★. Phrase first, then the month's hero number.
 *
 * Data: months from lib/calendarSeries (engine monthly series, days
 * interpolated — documented tech debt). `compact` = heat-map only, for Inicio.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAnimate } from 'framer-motion';
import { tx, useReducedMotion } from '@/lib/motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { daysIn, debtColor, debtOn, type CalendarMonth } from '@/lib/calendarSeries';

const MONTHS = {
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const DOW = { es: ['D', 'L', 'M', 'X', 'J', 'V', 'S'], en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'] };

export interface DebtCalendarProps {
    months: CalendarMonth[];
    maxDebt: number;
    paydays?: (year: number, month: number) => Set<number>;
    cutDays?: (year: number, month: number) => Map<number, string>;
    compact?: boolean;
    example?: boolean; // landing demo: label as example data
}

export function DebtCalendar({ months, maxDebt, paydays, cutDays, compact, example }: DebtCalendarProps) {
    const { language } = useLanguage();
    const es = language === 'es';
    const { formatMoney } = useFormatMoney();
    // Projections are estimates: show them rounded to the dollar ("≈ $23,900"), never with cents
    const approx = (n: number) => formatMoney(Math.round(n)).replace(/[.,]00$/, '');
    const [idx, setIdx] = useState(0);
    // Living calendar: the grid slides in the direction you navigate while each
    // cell's background blends from the outgoing month's tone (.kx-cal-cell)
    const reduced = useReducedMotion();
    const [gridRef, animateGrid] = useAnimate<HTMLDivElement>();
    const dir = useRef(0);
    const go = (step: number) => { dir.current = step; setIdx((i) => Math.max(0, Math.min(months.length - 1, i + step))); };
    useEffect(() => {
        if (!dir.current || reduced || !gridRef.current) return;
        animateGrid(gridRef.current, { x: [dir.current * 18, 0], opacity: [0.35, 1] }, tx('slow'));
    }, [idx, reduced, animateGrid, gridRef]);
    const mo = months[Math.min(idx, months.length - 1)];
    const names = MONTHS[es ? 'es' : 'en'];

    const cells = useMemo(() => {
        if (!mo) return [];
        const lead = new Date(mo.year, mo.month, 1).getDay();
        const pay = paydays?.(mo.year, mo.month) ?? new Set<number>();
        const cuts = cutDays?.(mo.year, mo.month) ?? new Map<number, string>();
        const out: { day: number | null; debt: number; pay: boolean; cut?: string; free: boolean }[] =
            Array.from({ length: lead }, () => ({ day: null, debt: 0, pay: false, free: false }));
        for (let d = 1; d <= daysIn(mo.year, mo.month); d++) {
            out.push({ day: d, debt: debtOn(mo, d), pay: pay.has(d), cut: cuts.get(d), free: mo.zeroDay === d });
        }
        return out;
    }, [mo, paydays, cutDays]);

    if (!mo) return null;
    const monthName = names[mo.month];
    const freedom = months.find((m) => m.zeroDay);
    const isAfter = mo.start <= 0 && mo.end <= 0;

    // Phrase first (rule 2), then the hero number with its own phrase.
    const phrase = isAfter
        ? (es ? 'Sin deuda: el mes entero en verde.' : 'Debt-free: the whole month in green.')
        : mo.zeroDay
            ? (es ? `En ${monthName}, el verde: te liberas el ${mo.zeroDay}.` : `In ${monthName}, the green: you're free on the ${mo.zeroDay}th.`)
            : mo.end / Math.max(1, maxDebt) > 0.55
                ? (es ? `En ${monthName}, el rojo se aclara.` : `In ${monthName}, the red starts to fade.`)
                : (es ? `En ${monthName}, ya vas en amarillo.` : `In ${monthName}, you're into yellow.`);
    const heroNote = isAfter || mo.zeroDay
        ? (es ? 'deuda proyectada al cierre del mes' : 'projected debt at month close')
        : (es ? `al cierre del mes (estimado) · bajas ≈ ${approx(mo.start - mo.end)}` : `at month close (estimate) · down ≈ ${approx(mo.start - mo.end)}`);
    const progress = maxDebt > 0 ? (1 - mo.end / maxDebt) * 100 : 100;

    return (
        <div>
            {!compact && (
                <>
                    <p className="text-[15px] font-semibold text-kx-ink">{phrase}</p>
                    <div className="mt-3 flex items-center justify-between">
                        <button type="button" onClick={() => go(-1)} disabled={idx === 0}
                            aria-label={es ? 'Mes anterior' : 'Previous month'}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#263449] bg-kx-raised text-kx-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber">
                            <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
                        </button>
                        <p className="text-xl font-bold capitalize tracking-tight text-kx-ink" aria-live="polite">{monthName} {mo.year}</p>
                        <button type="button" onClick={() => go(1)} disabled={idx >= months.length - 1}
                            aria-label={es ? 'Mes siguiente' : 'Next month'}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#263449] bg-kx-raised text-kx-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber">
                            <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
                        </button>
                    </div>
                    <div className="mb-1 mt-2.5 text-center">
                        <p className="text-[10.5px] font-bold uppercase tracking-[.15em] text-kx-ink2">{es ? 'Debes' : 'You owe'}</p>
                        <p className="kx-hero-number mt-0.5 text-[36px] text-kx-ink">{mo.end <= 0 ? approx(0) : `≈ ${approx(mo.end)}`}</p>
                        <p className="text-xs text-kx-ink2">{heroNote}</p>
                    </div>
                    <div className="relative mx-0.5 mt-3.5 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#DC2626,#F97316 42%,#FBBF24 68%,#34D399)' }}>
                        <span className="absolute top-1/2 h-[17px] w-[17px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-kx-surface bg-white shadow transition-[left] duration-300"
                            style={{ left: `${Math.max(0, Math.min(100, progress)).toFixed(1)}%` }} aria-hidden="true" />
                    </div>
                    <div className="mx-0.5 mb-4 mt-1.5 flex justify-between text-[10px] font-semibold tracking-wide text-kx-ink3">
                        <span>{es ? 'Hoy · rojo' : 'Today · red'}</span>
                        <span>{freedom ? `${names[freedom.month].slice(0, 3)} ${freedom.year} · ${es ? 'verde' : 'green'}` : ''}</span>
                    </div>
                </>
            )}

            <div className="mb-1 grid grid-cols-7 gap-[5px]" aria-hidden="true">
                {DOW[es ? 'es' : 'en'].map((d, i) => <span key={i} className="text-center text-[10px] font-semibold tracking-wide text-kx-ink3">{d}</span>)}
            </div>
            <div ref={gridRef} className="grid grid-cols-7 gap-[5px]" role="grid" aria-label={`${monthName} ${mo.year}`}>
                {cells.map((c, i) => {
                    if (c.day === null) return <div key={i} />;
                    const style = c.free ? { background: '#34D399', color: '#052E1B', fontWeight: 700 } : debtColor(c.debt, maxDebt);
                    const label = `${c.day}: ${c.debt <= 0 ? (es ? 'sin deuda' : 'no debt') : `≈ ${approx(c.debt)}`}${c.pay ? (es ? ', día de pago' : ', payday') : ''}${c.cut ? `, ${c.cut}` : ''}${c.free ? (es ? ', ¡libre!' : ', free!') : ''}`;
                    return (
                        <div key={i} role="gridcell" aria-label={label} title={label}
                            className="kx-num kx-cal-cell relative flex aspect-square items-center justify-center rounded-[9px] text-[12.5px]" style={style}>
                            {c.day}
                            {c.free && <span className="absolute -right-0.5 -top-1.5 text-[10px] text-kx-amber" aria-hidden="true">★</span>}
                            {c.cut && !compact && <span className="absolute left-1 top-0.5 text-[8px] font-bold opacity-80" aria-hidden="true">{c.cut}</span>}
                            {c.pay && <span className="absolute bottom-[3px] left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-kx-pay" aria-hidden="true" />}
                        </div>
                    );
                })}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-kx-ink2">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: 'linear-gradient(90deg,#DC2626,#FBBF24,#34D399)' }} />{es ? 'fondo = tu deuda' : 'background = your debt'}</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-kx-pay" />{es ? 'día de pago' : 'payday'}</span>
                <span className="flex items-center gap-1.5"><span className="text-kx-amber">★</span>{es ? 'libre' : 'free'}</span>
            </div>
            <p className="mt-2 text-[11px] text-kx-ink3">
                {example
                    ? (es ? 'Datos de ejemplo. Las cifras son estimaciones ilustrativas.' : 'Example data. Figures are illustrative estimates.')
                    : (es ? 'Proyección estimada según tu plan actual; no es una garantía.' : 'Estimated projection from your current plan; not a guarantee.')}
            </p>
        </div>
    );
}
