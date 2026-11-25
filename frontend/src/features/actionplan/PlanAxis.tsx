/**
 * Plan («Cobre a la vista», misión 19, direccion-de-arte §6.4): the plan as ONE vertical
 * line, 16 px from the edge, from today (top) to the debt-free month (bottom). Each month is
 * a stretch; each debt that ends is a mark with its name and the month in Plex Mono; icon 14
 * closes the line. Travelled = copper, ahead = funda — by TIME (decisión b de Fabian).
 * Every date comes from the server (freedom date, the plan's movements); nothing is computed
 * from money here.
 */
import { useEffect, useState } from 'react';
import { VerticalLine } from '@/components/kx';
import { KxFree, KxPaid } from '@/components/kx/icons';

const SEEN = 'kx-plan-axis-done';
const readSeen = () => { try { const v = sessionStorage.getItem(SEEN); return v === null ? null : Number(v); } catch { return null; } };

export interface AxisMark { name: string; month: string; note?: string } // month = YYYY-MM

const MES = { es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
const ym = (iso: string) => { const [y, m] = iso.slice(0, 7).split('-').map(Number); return y * 12 + m - 1; };
const ROW = 40; // min px between two labels (a label may take two lines)

export function PlanAxis({ today, freedom, marks, paidNow, es }: {
    /** YYYY-MM-DD */ today: string; /** YYYY-MM-DD, the server's debt-free date */ freedom: string;
    marks: AxisMark[]; /** debts already at $0 */ paidNow: string[]; es: boolean;
}) {
    const names = MES[es ? 'es' : 'en'];
    const label = (key: number) => `${names[key % 12]} ${Math.floor(key / 12)}`;
    const start = ym(today), end = Math.max(ym(freedom), start);
    const span = Math.max(1, end - start);
    // Time travelled: the part of the current month already behind you (decisión b)
    const [ty, tm, td] = today.split('-').map(Number);
    const done = Math.min(1, (td / new Date(ty, tm, 0).getDate()) / span);
    // Enter from where the line was last time; if it moved forward, it travels there (480 ms)
    const [shown, setShown] = useState(() => { const v = readSeen(); return v !== null && v < done ? v : done; });
    useEffect(() => {
        try { sessionStorage.setItem(SEEN, String(done)); } catch { /* storage blocked */ }
        if (shown === done) return;
        const raf = requestAnimationFrame(() => setShown(done));
        return () => cancelAnimationFrame(raf);
    }, [done, shown]);

    // Labels: today, each debt that ends (in time order), the free month. Never closer than ROW px.
    const rows: { at: number; key: string; node: React.ReactNode }[] = [];
    const height = Math.min(560, Math.max(220, span * 14));
    const place = (month: number) => ((month - start) / span) * height;
    rows.push({ at: 0, key: 'hoy', node: <><span className="kx-tech text-[12px] text-kx-ink3">{label(start)}</span> <span className="text-[13px] text-kx-ink2">{es ? 'Hoy' : 'Today'}</span></> });
    for (const n of paidNow) rows.push({ at: 0, key: `p-${n}`, node: <span className="flex items-center gap-1.5 text-[13px] text-kx-ink2"><KxPaid size={14} />{n} · {es ? 'ya en $0' : 'already at $0'}</span> });
    for (const m of [...marks].sort((a, b) => ym(a.month) - ym(b.month))) {
        rows.push({ at: place(ym(m.month)), key: `m-${m.name}`, node: <><span className="kx-tech text-[12px] text-kx-ink3">{label(ym(m.month))}</span> <span className="text-[13px] font-semibold text-kx-ink">{m.name}</span> <span className="text-[12px] text-kx-ink3">{es ? 'en $0' : 'at $0'}{m.note ? ` · ${m.note}` : ''}</span></> });
    }
    let last = -ROW;
    for (const r of rows) { r.at = Math.max(r.at, last + ROW); last = r.at; }
    const free = Math.max(height, last + ROW + 4);

    return (
        <div className="relative" style={{ height: free + 28 }} data-testid="plan-axis">
            <VerticalLine done={shown} height={free} label={es ? `Plan: de ${label(start)} a ${label(end)}` : `Plan: from ${label(start)} to ${label(end)}`} />
            {rows.map((r) => (
                <div key={r.key} className="absolute left-11 right-0 leading-snug" style={{ top: r.at - 2 }} data-testid="axis-mark">{r.node}</div>
            ))}
            <div className="absolute left-[11px] flex items-center gap-2" style={{ top: free - 4 }} data-testid="axis-end">
                <span className="text-kx-ink"><KxFree size={24} /></span>
                <span className="kx-tech text-[12px] text-kx-ink2">{label(end)}</span>
            </div>
        </div>
    );
}
