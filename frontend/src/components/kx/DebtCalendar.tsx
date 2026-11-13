/**
 * DebtCalendar — KoreX's signature piece: your debt painted on time.
 * Each day's background is the projected total debt that day (red → yellow →
 * green at $0); ‹ › navigates month by month to the freedom month; paydays get
 * a blue dot; the $0 day gets a ★. Phrase first, then the month's hero number.
 *
 * Data: months from lib/calendarSeries (engine monthly series, days
 * interpolated — documented tech debt). `compact` = heat-map only, for Inicio.
 *
 * Anti-generic treatment (2026-11-05): the month is ONE painting — no boxes.
 * Each week is a band whose gradient runs through that week's days, bands sit
 * edge to edge, and days are separated by hairlines like a ledger. The day
 * number (Fraunces) is the protagonist; marks are sober: blue dot = payday,
 * amber ring + HOY = today, ★ = the $0 day, amber ◆ = statement cut, grey dash
 * = a charge. With `live`, every event (paydays, charges, cuts, the day sheet,
 * the month total) comes from the server (GET /api/calendar/events, the daily
 * mission's own functions); the client only paints. Fixed positions so marks
 * never collide: ◆ top-left · dash bottom-right · dot bottom-centre.
 * `compact` (Inicio) keeps only the dot and the ◆.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAnimate } from 'framer-motion';
import { tx, useReducedMotion } from '@/lib/motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { Link } from 'react-router-dom';
import { daysIn, debtColor, debtOn, type CalendarMonth, type DayDetail } from '@/lib/calendarSeries';
import { toDayDetail } from '@/lib/calendarEvents';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { DaySheet } from './DaySheet';

const MONTHS = {
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const DOW = { es: ['D', 'L', 'M', 'X', 'J', 'V', 'S'], en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'] };

export interface DebtCalendarProps {
    months: CalendarMonth[];
    maxDebt: number;
    /** landing example only: paydays painted from sample data */
    paydays?: (year: number, month: number) => Set<number>;
    /** real user: events from the server (GET /api/calendar/events) + tap → day sheet */
    live?: boolean;
    compact?: boolean;
    example?: boolean; // landing demo: label as example data
}

const DOW_LONG = { es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };

export function DebtCalendar({ months, maxDebt, paydays, live, compact, example }: DebtCalendarProps) {
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
        // The whole panel travels in the direction you navigate (clear, not long: 480 ms)
        animateGrid(gridRef.current, { x: [dir.current * 56, 0], opacity: [0.15, 1] }, tx('slow'));
    }, [idx, reduced, animateGrid, gridRef]);
    const mo = months[Math.min(idx, months.length - 1)];
    const { events } = useCalendarEvents(live && mo ? mo.year : null, live && mo ? mo.month : null);
    const names = MONTHS[es ? 'es' : 'en'];
    const [openDay, setOpenDay] = useState<DayDetail | null>(null);
    const [today] = useState(() => new Date());

    const cells = useMemo(() => {
        if (!mo) return [];
        const lead = new Date(mo.year, mo.month, 1).getDay();
        const sample = paydays?.(mo.year, mo.month) ?? new Set<number>();
        const byDay = new Map((events?.dias ?? []).map((d) => [d.dia, d]));
        const out: { day: number | null; debt: number; pay: boolean; cut?: boolean; free: boolean; charge?: boolean }[] =
            Array.from({ length: lead }, () => ({ day: null, debt: 0, pay: false, free: false }));
        for (let d = 1; d <= daysIn(mo.year, mo.month); d++) {
            const ev = byDay.get(d);
            out.push({
                day: d, debt: debtOn(mo, d), free: mo.zeroDay === d,
                pay: live ? !!ev?.marcas.payday : sample.has(d),
                charge: !!ev?.marcas.cobro, cut: !!ev?.marcas.corte,
            });
        }
        return out;
    }, [mo, paydays, live, events]);
    // Month summary: everything that leaves this month (server total, subscriptions included)
    const monthCharges = live ? (events?.total_mes_sale ?? null) : null;
    const openDetail = (day: number) => {
        const ev = events?.dias.find((d) => d.dia === day);
        if (ev && mo) setOpenDay(toDayDetail(ev, debtOn(mo, day)));
    };

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
        <div className="kx-lit">
            {!compact && (
                <>
                    <p className="text-[15px] font-semibold text-kx-ink">{phrase}</p>
                    <div className="mt-3 flex items-center justify-between">
                        <button type="button" onClick={() => go(-1)} disabled={idx === 0}
                            aria-label={es ? 'Mes anterior' : 'Previous month'}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-kx-line bg-kx-raised text-kx-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber">
                            <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
                        </button>
                        <p className="text-xl font-bold capitalize tracking-tight text-kx-ink" aria-live="polite">{monthName} {mo.year}</p>
                        <button type="button" onClick={() => go(1)} disabled={idx >= months.length - 1}
                            aria-label={es ? 'Mes siguiente' : 'Next month'}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-kx-line bg-kx-raised text-kx-ink disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber">
                            <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
                        </button>
                    </div>
                    <div className="mb-1 mt-2.5 text-center">
                        <p className="text-[10.5px] font-bold uppercase tracking-[.15em] text-kx-ink2">{es ? 'Debes' : 'You owe'}</p>
                        <p className="kx-hero-number mt-0.5 text-[36px] text-kx-ink">{mo.end <= 0 ? approx(0) : `≈ ${approx(mo.end)}`}</p>
                        <p className="text-xs text-kx-ink2">{heroNote}</p>
                        {monthCharges != null && monthCharges > 0 && (
                            <p className="mt-1 text-xs text-kx-ink2" data-testid="month-charges">
                                {es ? 'Te cobran este mes ' : 'Charged this month '}<b className="kx-num text-kx-ink">{formatMoney(monthCharges)}</b>
                                <span className="text-kx-ink3">{es ? ' · incluye suscripciones' : ' · includes subscriptions'}</span>
                            </p>
                        )}
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

            <div className="mb-1.5 grid grid-cols-7" aria-hidden="true">
                {DOW[es ? 'es' : 'en'].map((d, i) => <span key={i} className="kx-tech text-center text-[10px] tracking-wide text-kx-ink3">{d}</span>)}
            </div>
            {/* One painting: week bands edge to edge, hairlines between days, no per-day boxes */}
            <div ref={gridRef} className="overflow-hidden rounded-[18px] border border-white/10" role="grid" aria-label={`${monthName} ${mo.year}`}>
                {Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => {
                    const week = cells.slice(w * 7, w * 7 + 7);
                    while (week.length < 7) week.push({ day: null, debt: 0, pay: false, free: false });
                    // Empty slots borrow the nearest real day's tone so the band never breaks
                    const real = week.filter((c) => c.day !== null);
                    const tone = (i: number) => {
                        const c = week[i].day !== null ? week[i] : (i < 3 ? real[0] : real[real.length - 1]);
                        return c.free ? 'rgb(52,211,153)' : debtColor(c.debt, maxDebt).background;
                    };
                    const band = `linear-gradient(90deg, ${week.map((_c, i) => `${tone(i)} ${((i + 0.5) / 7 * 100).toFixed(1)}%`).join(', ')})`;
                    return (
                        <div key={w} role="row" className="kx-cal-cell grid grid-cols-7 border-t border-black/15 first:border-t-0" style={{ background: band }}>
                            {week.map((c, i) => {
                                if (c.day === null) return <span key={i} role="gridcell" className="aspect-square border-l border-black/10 first:border-l-0" />;
                                const ink = c.free ? { color: '#052E1B' } : { color: debtColor(c.debt, maxDebt).color };
                                const isToday = c.day === today.getDate() && mo.month === today.getMonth() && mo.year === today.getFullYear();
                                const date = new Date(mo.year, mo.month, c.day);
                                const marks = [
                                    isToday && (es ? 'hoy' : 'today'),
                                    c.pay && (es ? 'día de nómina' : 'payday'),
                                    c.cut && (es ? 'día de corte' : 'statement cut'),
                                    c.charge && (es ? 'día de cobro' : 'charge day'),
                                    c.free && (es ? '¡libre de deudas!' : 'debt-free!'),
                                ].filter(Boolean).join(', ');
                                const label = `${DOW_LONG[es ? 'es' : 'en'][date.getDay()]} ${c.day}${es ? ' de' : ''} ${monthName}${marks ? `, ${marks}` : ''}, ${c.debt <= 0 ? (es ? 'sin deuda' : 'no debt') : `${es ? 'proyección' : 'projection'} ≈ ${approx(c.debt)}`}`;
                                const body = (
                                    <>
                                        <span className={cx('kx-num font-editorial', compact ? 'text-[13px]' : 'text-[16px]')} style={{ fontWeight: isToday ? 560 : 400 }}>{c.day}</span>
                                        {isToday && <span className="pointer-events-none absolute inset-[3px] rounded-[10px] ring-2 ring-kx-amber" aria-hidden="true" />}
                                        {isToday && !compact && <span className="kx-tech pointer-events-none absolute left-1/2 top-[3px] -translate-x-1/2 rounded-sm bg-kx-amber px-1 text-[7.5px] font-bold leading-[11px] text-kx-on-amber" aria-hidden="true">{es ? 'HOY' : 'TODAY'}</span>}
                                        {c.free && <span className="absolute right-1 top-0.5 text-[10px] text-kx-amber" aria-hidden="true">★</span>}
                                        {c.cut && <span data-testid="cut-mark" className="pointer-events-none absolute left-1 top-0.5 text-[9px] leading-none text-kx-amber [text-shadow:0_0_2px_rgba(0,0,0,.7)]" aria-hidden="true">◆</span>}
                                        {c.charge && !compact && <span data-testid="charge-mark" className="absolute bottom-[5px] right-1.5 h-[2px] w-[6px] rounded-full bg-kx-ink2" aria-hidden="true" />}
                                        {c.pay && <span data-testid="payday-mark" className="absolute bottom-[4px] left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-kx-pay ring-1 ring-black/20" aria-hidden="true" />}
                                    </>
                                );
                                const cls = 'relative flex aspect-square items-center justify-center border-l border-black/10 first:border-l-0';
                                return live ? (
                                    <button key={i} type="button" role="gridcell" aria-label={label} onClick={() => openDetail(c.day!)} data-day={c.day}
                                        className={cx(cls, 'kx-press focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-kx-amber')} style={ink}>
                                        {body}
                                    </button>
                                ) : (
                                    <span key={i} role="gridcell" aria-label={label} className={cls} style={ink}>{body}</span>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
            {live && <DaySheet detail={openDay} onClose={() => setOpenDay(null)} today={today} />}

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-kx-ink2">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: 'linear-gradient(90deg,#DC2626,#FBBF24,#34D399)' }} />{es ? 'fondo = tu deuda' : 'background = your debt'}</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-kx-pay" />{es ? 'día de pago' : 'payday'}</span>
                {live && !compact && <span className="flex items-center gap-1.5"><span className="h-[2px] w-[8px] rounded-full bg-kx-ink2" />{es ? 'te cobran' : 'charge'}</span>}
                {live && <span className="flex items-center gap-1.5"><span className="text-[10px] text-kx-amber">◆</span>{es ? 'corte' : 'statement cut'}</span>}
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-2 ring-kx-amber" />{es ? 'hoy' : 'today'}</span>
                <span className="flex items-center gap-1.5"><span className="text-kx-amber">★</span>{es ? 'libre' : 'free'}</span>
            </div>
            {live && events?.vacio && (
                <p className="mt-2 text-[12.5px] text-kx-ink2" data-testid="cal-empty">
                    {es ? 'Aún no hay cobros ni ingresos cargados para este mes. ' : 'No charges or income on record for this month yet. '}
                    <Link to="/dashboard/accounts/manage" className="font-semibold text-kx-amber">{es ? 'Cargar mis recurrentes' : 'Add my recurring items'}</Link>
                </p>
            )}
            {live && !compact && (events?.suscripciones_sin_fecha ?? 0) > 0 && (
                <p className="mt-1.5 text-[12px] text-kx-ink3" data-testid="cal-undated">
                    {es ? `${events!.suscripciones_sin_fecha} ${events!.suscripciones_sin_fecha === 1 ? 'suscripción sin fecha de cobro' : 'suscripciones sin fecha de cobro'} · `
                        : `${events!.suscripciones_sin_fecha} subscription${events!.suscripciones_sin_fecha === 1 ? '' : 's'} without a charge date · `}
                    <Link to="/dashboard/subscriptions" className="font-semibold text-kx-amber">{es ? 'ponles fecha' : 'add a date'}</Link>
                </p>
            )}
            <p className="mt-2 text-[11px] text-kx-ink3">
                {example
                    ? (es ? 'Datos de ejemplo. Las cifras son estimaciones ilustrativas.' : 'Example data. Figures are illustrative estimates.')
                    : (es ? 'Proyección estimada según tu plan actual; no es una garantía.' : 'Estimated projection from your current plan; not a guarantee.')}
            </p>
        </div>
    );
}
