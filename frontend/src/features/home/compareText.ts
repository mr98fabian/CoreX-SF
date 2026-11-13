/** Wording of the Inicio chart. Only endpoint fields (GET /api/velocity/compare);
 *  the wording is CHOSEN by them, never computed from them. */
import type { VelocityCompare } from '@/hooks/useVelocityCompare';

/** 'YYYY-MM' or 'YYYY-MM-DD' → "mar 2027" (anchored at noon: never slips a month) */
export function monthLabel(fecha: string, es: boolean): string {
    const d = new Date(`${fecha.slice(0, 7)}-01T12:00:00`);
    return new Intl.DateTimeFormat(es ? 'es' : 'en', { month: 'short', year: 'numeric' }).format(d).replace('.', '');
}

const fmtNum = (n: number, es: boolean) => new Intl.NumberFormat(es ? 'es' : 'en', { maximumFractionDigits: 1 }).format(n);

/** The sentence under the title. Only endpoint fields; wording chosen by them. */
export function comparePhrase(c: VelocityCompare, es: boolean, money: (n: number) => string): string {
    const a = c.ahorro;
    if (c.estado === 'sin_ahorro') {
        const when = c.plan?.fecha_libre ? monthLabel(c.plan.fecha_libre, es) : '';
        return es ? `Hoy tu plan y pagar solo el mínimo llegan el mismo día: ${when}. Si liberas excedente, se adelanta.`
            : `Today your plan and paying only the minimum arrive the same day: ${when}. Free up surplus and it comes sooner.`;
    }
    const time = a.meses > 24
        ? (es ? `${fmtNum(a.anios, es)} años` : `${fmtNum(a.anios, es)} years`)
        : (es ? `${a.meses} ${a.meses === 1 ? 'mes' : 'meses'}` : `${a.meses} ${a.meses === 1 ? 'month' : 'months'}`);
    if (a.es_minimo) {
        return es ? `Con tu plan sales más de ${time} antes y te ahorras más de ${money(a.intereses)} en intereses (estimado).`
            : `With your plan you’re out more than ${time} sooner and save more than ${money(a.intereses)} in interest (estimate).`;
    }
    if (a.meses === 0) {
        return es ? `Con tu plan sales el mismo mes y te ahorras ≈ ${money(a.intereses)} en intereses (estimado).`
            : `With your plan you’re out the same month and save ≈ ${money(a.intereses)} in interest (estimate).`;
    }
    return es ? `Con tu plan sales ≈ ${time} antes y te ahorras ≈ ${money(a.intereses)} en intereses (estimado).`
        : `With your plan you’re out ≈ ${time} sooner and save ≈ ${money(a.intereses)} in interest (estimate).`;
}

/** Where the dotted line goes after the chart's edge */
export function minimumsEnd(c: VelocityCompare, es: boolean): string {
    const m = c.minimos!;
    if (m.tope_simulador) return es ? `más de ${fmtNum(m.anios, es)} años` : `more than ${fmtNum(m.anios, es)} years`;
    if (m.cortado) return es ? `sigue hasta ${m.anio_libre}` : `goes on until ${m.anio_libre}`;
    return m.fecha_libre ? (es ? `libre ${monthLabel(m.fecha_libre, es)}` : `free ${monthLabel(m.fecha_libre, es)}`) : '';
}
