/**
 * Inicio · "Tu plan contra pagar solo el mínimo" (2026-11-12, Fable's design).
 * Data: GET /api/velocity/compare (velocity_engine.compare_paths). The client
 * computes NOTHING financial: every amount, month count, year and state is a
 * field of the endpoint. Here we only draw (scales) and pick wording.
 */
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Section } from '@/components/kx';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import type { ComparePoint, VelocityCompare } from '@/hooks/useVelocityCompare';
import { comparePhrase, minimumsEnd, monthLabel } from './compareText';

const W = 320, H = 150, PL = 2, PR = 10, PT = 10, PB = 6;

export function CompareChart({ data: c, es, action }: { data: VelocityCompare; es: boolean; action?: ReactNode }) {
    const { formatMoneyShort } = useFormatMoney();
    const gid = useId().replace(/:/g, '');
    const box = useRef<HTMLDivElement>(null);
    const plan = c.plan!, mins = c.minimos!;
    const single = c.estado === 'sin_ahorro';
    const series: ComparePoint[][] = single ? [plan.puntos] : [plan.puntos, mins.puntos];
    const last = Math.max(...series.map((s) => s.length)) - 1;
    const [idx, setIdx] = useState<number | null>(null);

    // ── drawing scales (geometry only) ──
    const top = Math.max(...series.flat().map((p) => p.saldo), 1);
    const x = (m: number) => PL + (m / Math.max(c.dominio_meses, 1)) * (W - PL - PR);
    const y = (v: number) => PT + (1 - v / top) * (H - PT - PB);
    const path = (pts: ComparePoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.mes).toFixed(1)},${y(p.saldo).toFixed(1)}`).join('');

    const at = (pts: ComparePoint[], i: number) => (pts[i] ?? pts[pts.length - 1]);
    const scrubText = (i: number) => {
        const when = i === 0 ? (es ? 'hoy' : 'today') : monthLabel((mins.puntos[i] ?? plan.puntos[i] ?? at(plan.puntos, i)).fecha, es);
        const p = formatMoneyShort(i < plan.puntos.length ? plan.puntos[i].saldo : 0);
        if (single) return `${when} · ≈ ${p}`;
        const m = formatMoneyShort(i < mins.puntos.length ? mins.puntos[i].saldo : at(mins.puntos, i).saldo);
        return es ? `${when} · con plan ≈ ${p} · solo mínimos ≈ ${m}` : `${when} · with plan ≈ ${p} · minimums only ≈ ${m}`;
    };

    const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
        const r = box.current!.getBoundingClientRect();
        const svgX = ((e.clientX - r.left) / r.width) * W;
        const m = Math.round(((svgX - PL) / (W - PL - PR)) * c.dominio_meses);
        setIdx(Math.max(0, Math.min(last, m)));
    };
    const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
        const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1
            : e.key === 'PageUp' ? 12 : e.key === 'PageDown' ? -12 : null;
        const jump = e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
        if (step === null && jump === null) return;
        e.preventDefault();
        setIdx((cur) => Math.max(0, Math.min(last, jump ?? (cur ?? 0) + step!)));
    };

    const shown = idx ?? 0;
    const endLabel = monthLabel(at(single ? plan.puntos : mins.puntos, last).fecha, es);
    const contribution = formatMoneyShort(plan.aporte_mensual);

    return (
        <Section tone="neutral" action={action} title={es ? 'Tu plan contra pagar solo el mínimo' : 'Your plan vs paying only the minimum'}>
            <div data-testid="compare-chart" data-estado={c.estado}>
                <p className="text-[14px] leading-snug text-kx-ink" data-testid="compare-phrase">{comparePhrase(c, es, formatMoneyShort)}</p>
                {single && (
                    <Link to="/dashboard/subscriptions" className="mt-1 inline-block text-[13px] font-semibold text-kx-amber">
                        {es ? 'Revisar mis recurrentes ›' : 'Review my recurring charges ›'}
                    </Link>
                )}

                <div className="mt-3 flex justify-between text-[11px] text-kx-ink3">
                    <span className="kx-num">{formatMoneyShort(c.deuda_hoy)}</span>
                </div>
                <div ref={box} role="slider" tabIndex={0} aria-label={es ? 'Recorre los meses' : 'Scrub through the months'}
                    aria-valuemin={0} aria-valuemax={last} aria-valuenow={shown} aria-valuetext={scrubText(shown)}
                    onPointerDown={(e) => { box.current?.setPointerCapture?.(e.pointerId); fromPointer(e); }}
                    onPointerMove={(e) => { if (e.buttons || e.pointerType === 'mouse') fromPointer(e); }}
                    onKeyDown={onKey}
                    className="relative cursor-crosshair select-none rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kx-amber"
                    style={{ touchAction: 'pan-y' }}>
                    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" aria-hidden="true">
                        <defs>
                            {/* amber all the way; turns paid-green only over the last 12% of today's balance */}
                            <linearGradient id={`plan-${gid}`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={y(c.deuda_hoy)} y2={y(0)}>
                                <stop offset="0" stopColor="var(--kx-plan-line)" />
                                <stop offset="0.88" stopColor="var(--kx-plan-line)" />
                                <stop offset="1" stopColor="var(--kx-paid)" />
                            </linearGradient>
                        </defs>
                        {/* minimal axes, no grid */}
                        <path d={`M${PL},${PT}V${H - PB}H${W - PR}`} fill="none" stroke="var(--kx-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        {!single && (
                            <path data-testid="line-minimos" d={path(mins.puntos)} fill="none" stroke="var(--kx-ink-3)" strokeWidth="1.5"
                                strokeDasharray="2 4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        )}
                        <path data-testid="line-plan" d={path(plan.puntos)} fill="none" stroke={`url(#plan-${gid})`} strokeWidth="2.5"
                            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        {!plan.tope_simulador && (
                            <text data-testid="plan-star" x={x(plan.meses)} y={y(0) - 3} textAnchor="middle" fontSize="12" fill="var(--kx-paid)">★</text>
                        )}
                        {idx !== null && (
                            <line data-testid="scrub-guide" x1={x(idx)} x2={x(idx)} y1={PT} y2={H - PB} stroke="var(--kx-ink-2)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        )}
                    </svg>
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-kx-ink3">
                    <span>{es ? 'hoy' : 'today'}</span>
                    <span>{endLabel}</span>
                </div>

                <p className="kx-num mt-2 min-h-[1.25rem] text-[12.5px] text-kx-ink2" aria-live="polite" data-testid="scrub-line">
                    {idx !== null ? scrubText(idx) : (es ? 'Desliza sobre el gráfico para ver cada mes.' : 'Slide over the chart to see each month.')}
                </p>

                <ul className="mt-2 space-y-1 text-[12.5px] text-kx-ink2">
                    <li className="flex items-center gap-2">
                        <span className="h-[3px] w-5 rounded-full" style={{ background: 'linear-gradient(90deg, var(--kx-plan-line) 70%, var(--kx-paid))' }} aria-hidden="true" />
                        {es ? 'Con tu plan' : 'With your plan'}{plan.fecha_libre ? ` · ${es ? 'libre' : 'free'} ${monthLabel(plan.fecha_libre, es)}` : ''}
                    </li>
                    {!single && (
                        <li className="flex items-center gap-2" data-testid="legend-minimos">
                            <span className="w-5 border-t-[1.5px] border-dotted" style={{ borderColor: 'var(--kx-ink-3)' }} aria-hidden="true" />
                            {es ? 'Solo mínimos' : 'Minimums only'} · {minimumsEnd(c, es)}
                        </li>
                    )}
                </ul>

                <p className="mt-3 text-[11.5px] leading-snug text-kx-ink3" data-testid="compare-note">
                    {plan.fuente_aporte === 'porcentaje_liquidez'
                        ? (es ? `Solo mínimos: lo que el banco pide cada mes, que baja con el saldo. Plan: ${contribution} al mes (el % de tu efectivo que elegiste) más los pagos que se liberan. Estimado.`
                            : `Minimums only: what the bank asks each month, shrinking with the balance. Plan: ${contribution} a month (the % of your cash you chose) plus the payments that free up. Estimate.`)
                        : (es ? `Solo mínimos: lo que el banco pide cada mes, que baja con el saldo. Plan: tu excedente de ${contribution} al mes más los pagos que se liberan. Estimado.`
                            : `Minimums only: what the bank asks each month, shrinking with the balance. Plan: your surplus of ${contribution} a month plus the payments that free up. Estimate.`)}
                </p>
            </div>
        </Section>
    );
}
