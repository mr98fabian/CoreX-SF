/**
 * Calendario de eventos — the server's month (GET /api/calendar/events), built
 * with the SAME functions as the daily mission (dated_cashflow, plan_minimum on
 * due_day, corte_action_date). The client never computes occurrences for marks
 * or the day sheet: it only maps the server's day to the sheet's shape. The
 * debt background still comes from lib/calendarSeries (the projection).
 */
import type { DayDetail } from '@/lib/calendarSeries';

export const CALENDAR_KEY = 'calendario';

export interface CalendarCharge {
    nombre: string;
    monto: number;
    tipo: 'gasto' | 'suscripcion' | 'minimo';
    id?: number | null;
    logo_url?: string | null;
    cuenta?: string | null;
}
export interface CalendarDay {
    dia: number;
    fecha: string;
    marcas: { payday: boolean; cobro: boolean; corte: boolean };
    ingresos: { nombre: string; monto: number }[];
    cobros: CalendarCharge[];
    cortes: { nombre: string; saldo: number; pagar_antes_de: string }[];
    total_entra: number;
    total_sale: number;
}
export interface CalendarMonthEvents {
    mes: string;
    dias: CalendarDay[];
    total_mes_sale: number;
    total_mes_entra: number;
    vacio: boolean;
    suscripciones_sin_fecha: number;
    /** debts with balance and no due_day: never painted on a made-up day (U-11) */
    deudas_sin_fecha: string[];
    etiqueta: string;
}

/** "2026-11" for (2026, 10) — month is 0-based like Date. */
export const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;

/** Server day → the day sheet's shape. `projected` is the background's projection for that day. */
export function toDayDetail(day: CalendarDay, projected: number): DayDetail {
    const of = (t: CalendarCharge['tipo']) => day.cobros.filter((c) => c.tipo === t);
    return {
        date: new Date(`${day.fecha}T12:00:00`),
        projected,
        incoming: day.ingresos.map((x) => ({ name: x.nombre, amount: x.monto })),
        expenses: of('gasto').map((x) => ({ name: x.nombre, amount: x.monto })),
        minimums: of('minimo').map((x) => ({ name: x.nombre, amount: x.monto })),
        subscriptions: of('suscripcion').map((x) => ({ id: x.id ?? 0, name: x.nombre, amount: x.monto, logo_url: x.logo_url ?? null, account_name: x.cuenta ?? null })),
        cuts: day.cortes.map((c) => ({ name: c.nombre, balance: c.saldo, payBy: c.pagar_antes_de })),
        totalIn: day.total_entra,
        totalOut: day.total_sale,
    };
}
