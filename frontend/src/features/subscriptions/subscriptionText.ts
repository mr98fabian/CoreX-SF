export type Freq = 'monthly' | 'annual' | 'weekly';
export interface RecurringSub {
    id: number; name: string; amount: string; frequency: Freq; monthly_equivalent: string;
    next_charge_date: string | null; account_id: number | null; account_name: string | null;
    logo_url: string | null; status: 'active' | 'cancelled';
}
export interface SubsResponse { items: RecurringSub[]; monthly_total: string; annual_total: string }

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "en 3 días · 9 nov" — YYYY-MM-DD anchored at noon so negative timezones keep the day. */
export function whenInWords(iso: string | null, es: boolean, today = new Date()): string {
    if (!iso) return es ? 'sin fecha de cobro' : 'no charge date';
    const d = new Date(`${iso}T12:00:00`);
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
    const days = Math.round((d.getTime() - t.getTime()) / 86_400_000);
    const date = es ? `${d.getDate()} ${MONTHS_ES[d.getMonth()]}` : `${MONTHS_EN[d.getMonth()]} ${d.getDate()}`;
    const rel = days === 0 ? (es ? 'hoy' : 'today')
        : days === 1 ? (es ? 'mañana' : 'tomorrow')
        : days > 1 ? (es ? `en ${days} días` : `in ${days} days`)
        : (es ? `pasó hace ${-days} ${days === -1 ? 'día' : 'días'}` : `${-days} day${days === -1 ? '' : 's'} ago`);
    return `${rel} · ${date}`;
}

/** Paying card in faint text: last 4 digits when the name ends with them ("···4884"), else the name. */
export function cardHint(name: string | null): string | null {
    if (!name) return null;
    const m = name.match(/(\d{4})\D*$/);
    return m ? `···${m[1]}` : name;
}
