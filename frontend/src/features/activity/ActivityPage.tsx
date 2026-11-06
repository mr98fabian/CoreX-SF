/**
 * Actividad (Fase 6): the live record of your money in plain language.
 * Time blocks (HOY / ESTA SEMANA / ESTE MES / ANTES), each with a summary
 * phrase; every movement is ONE sentence with a status chip
 * (registrado → aplicado → confirmado). Audit detail is a third layer (tap).
 *
 * Sources: /api/transactions/all (applied movements) and
 * /api/strategy/executed-logs (plan moves: executed = registrado, verified =
 * confirmado), plus /api/tokens/audit: writes your AI made with a token,
 * shown with an amber edge and the "vía tu IA" mark. Each AI row says WHAT
 * changed (the audit summary; older rows fall back to the generic phrase),
 * identical bursts collapse into one "×N · 19:42–19:44" row, and tapping
 * opens the full detail in place (action, summary, reason, date, token).
 */
import { Fragment, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useActivityData } from '@/hooks/useActivityData';
import { AmberRule, BankHeader, Section, StatePhrase } from '@/components/kx';
import { localDay } from '@/lib/stage';
import { groupAiBursts, type Grouped } from '@/lib/activityGroups';


type Status = 'registered' | 'applied' | 'confirmed';
type Kind = 'payment' | 'income' | 'spend' | 'plan' | 'ai';
interface Entry { key: string; date: string; kind: Kind; status: Status; amount: number; text: string; sub: string; audit: [string, string][]; ts?: number; label?: string; summary?: string }

const PER_BLOCK = 4; // rule 4
const dayKey = (d: Date) => localDay(d);

export default function ActivityPage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Actividad' : 'Activity');
    const { formatMoney, formatDateShort } = useFormatMoney();
    // Shared, cached entry (React Query) — re-entering Actividad paints instantly
    const data = useActivityData();
    const [filter, setFilter] = useState<'all' | 'payment' | 'income' | 'plan' | 'ai'>('all');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [openEntry, setOpenEntry] = useState<string | null>(null);
    const [now] = useState(() => Date.now()); // render must stay pure: one clock read per mount

    const load = data.reload;

    const entries: Grouped<Entry>[] = useMemo(() => {
        const out: Entry[] = [];
        for (const t of data.txs) {
            const amt = Math.abs(Number(t.amount));
            const kind: Kind = t.category === 'payment' ? 'payment' : t.amount > 0 ? 'income' : 'spend';
            const text = kind === 'payment'
                ? (es ? `Pagaste ${formatMoney(amt)} a ${t.account_name}` : `You paid ${formatMoney(amt)} to ${t.account_name}`)
                : kind === 'income'
                    ? (es ? `Entró ${formatMoney(amt)}: ${t.description}` : `${formatMoney(amt)} came in: ${t.description}`)
                    : (es ? `Gastaste ${formatMoney(amt)} en ${t.description}` : `You spent ${formatMoney(amt)} on ${t.description}`);
            out.push({ key: `t${t.id}`, date: t.date, kind, status: 'applied', amount: amt, text,
                sub: `${t.account_name} · ${formatDateShort(t.date)}`,
                audit: [[es ? 'Origen' : 'Source', 'POST /api/transactions'], [es ? 'Cuenta' : 'Account', t.account_name],
                    [es ? 'Categoría' : 'Category', t.category], ['ID', String(t.id)]] });
        }
        for (const m of data.moves) {
            const d = (m.date_executed || '').slice(0, 10);
            out.push({ key: `m${m.id}`, date: d, kind: 'plan', status: m.status === 'verified' ? 'confirmed' : 'registered',
                amount: Math.abs(Number(m.amount)), text: es ? `Movimiento del plan: ${m.title}` : `Plan move: ${m.title}`,
                sub: `${formatMoney(Math.abs(Number(m.amount)))} · ${d ? formatDateShort(d) : ''}`,
                audit: [[es ? 'Origen' : 'Source', 'POST /api/strategy/execute'], [es ? 'Estado' : 'Status', m.status], ['ID', String(m.id)]] });
        }
        for (const a of data.ai) {
            const when = new Date(`${a.created_at}Z`);
            const [method, path] = a.action.split(' ');
            const what = path.startsWith('/api/transactions') ? (es ? 'registró un pago' : 'recorded a payment')
                : path.startsWith('/api/cashflow') ? (method === 'DELETE' ? (es ? 'quitó un ingreso o gasto' : 'removed an income or bill') : (es ? 'actualizó tus ingresos o gastos' : 'updated your income or bills'))
                    : method === 'POST' ? (es ? 'agregó una cuenta' : 'added an account')
                        : method === 'DELETE' ? (es ? 'eliminó una cuenta' : 'deleted an account')
                            : (es ? 'corrigió una cuenta' : 'corrected an account');
            const via = `${es ? 'vía tu IA' : 'via your AI'}${a.token_name ? ` · ${a.token_name}` : ''} · ${when.toLocaleTimeString(es ? 'es-ES' : 'en-US', { hour: 'numeric', minute: '2-digit' })}`;
            const detail: [string, string][] = [
                [es ? 'Qué hizo' : 'What it did', what.charAt(0).toUpperCase() + what.slice(1)],
                ...(a.summary ? [[es ? 'Detalle' : 'Detail', a.summary] as [string, string]] : []),
                ...(a.note ? [[es ? 'Motivo' : 'Reason', a.note] as [string, string]] : []),
                [es ? 'Fecha y hora' : 'Date and time', when.toLocaleString(es ? 'es-ES' : 'en-US', { dateStyle: 'full', timeStyle: 'short' })],
                ['Token', a.token_name ?? `#${a.id}`],
                [es ? 'Estado' : 'Status', es ? 'Aplicado' : 'Applied'],
            ];
            out.push({ key: `a${a.id}`, date: localDay(when), kind: 'ai', status: 'applied', amount: 0, ts: when.getTime(),
                text: es ? `Tu IA ${what}` : `Your AI ${what}`,
                // the specific summary when the row has one; older rows keep the generic line
                sub: a.summary ? `${a.summary} · ${via}` : via,
                label: a.summary ?? what, summary: a.summary ?? undefined,
                audit: detail });
        }
        // Newest first (AI rows by exact time), then bursts of the same AI action collapse into one row
        out.sort((a, b) => b.date.localeCompare(a.date) || (b.ts ?? 0) - (a.ts ?? 0));
        return groupAiBursts(out);
    }, [data, es, formatMoney, formatDateShort]);

    const visible = entries.filter((e) => filter === 'all' || e.kind === filter);

    const blocks = useMemo(() => {
        const today = dayKey(new Date(now));
        const weekAgo = dayKey(new Date(now - 6 * 864e5));
        const monthStart = today.slice(0, 8) + '01';
        const def = [
            { id: 'today', title: es ? 'Hoy' : 'Today', test: (d: string) => d >= today }, // future-dated entries land in Hoy, never vanish
            { id: 'week', title: es ? 'Esta semana' : 'This week', test: (d: string) => d < today && d >= weekAgo },
            { id: 'month', title: es ? 'Este mes' : 'This month', test: (d: string) => d < weekAgo && d >= monthStart },
            { id: 'before', title: es ? 'Antes' : 'Earlier', test: (d: string) => d < monthStart && d < weekAgo },
        ];
        return def.map((b) => ({ ...b, items: visible.filter((e) => b.test(e.date)) })).filter((b) => b.items.length);
    }, [visible, es, now]);

    const summary = (items: Entry[]) => {
        const paid = items.filter((e) => e.kind === 'payment');
        const inc = items.filter((e) => e.kind === 'income');
        const parts: string[] = [];
        if (paid.length) parts.push(es ? `${paid.length} ${paid.length === 1 ? 'pago' : 'pagos'} por ${formatMoney(paid.reduce((s, e) => s + e.amount, 0))}`
            : `${paid.length} payment${paid.length === 1 ? '' : 's'} for ${formatMoney(paid.reduce((s, e) => s + e.amount, 0))}`);
        const ai = items.filter((e) => e.kind === 'ai');
        const aiCount = ai.reduce((n, e) => n + ((e as Grouped<Entry>).group?.length ?? 1), 0);
        if (ai.length) parts.push(es ? `${aiCount} ${aiCount === 1 ? 'acción' : 'acciones'} de tu IA` : `${aiCount} AI action${aiCount === 1 ? '' : 's'}`);
        if (inc.length) parts.push(es ? `${inc.length} ${inc.length === 1 ? 'ingreso' : 'ingresos'}` : `${inc.length} income`);
        const rest = items.length - paid.length - inc.length - ai.length;
        if (rest) parts.push(es ? `${rest} ${rest === 1 ? 'movimiento más' : 'movimientos más'}` : `${rest} more`);
        return parts.join(' · ');
    };

    const timeOf = (e: Entry) => (e.ts ? new Date(e.ts).toLocaleTimeString(es ? 'es-ES' : 'en-US', { hour: 'numeric', minute: '2-digit' }) : '');
    // "Amex Gold · saldo … · ×53 · 19:42–19:44" for a collapsed burst
    const burstLine = (e: Grouped<Entry>) => {
        const g = e.group ?? [e];
        const times = g.map((x) => x.ts ?? 0);
        const range = `${timeOf({ ...e, ts: Math.min(...times) })}–${timeOf({ ...e, ts: Math.max(...times) })}`;
        return `${e.summary ? `${e.summary} · ` : ''}×${g.length} · ${range}`;
    };

    const CHIP: Record<Status, [string, string]> = {
        registered: [es ? 'Registrado' : 'Recorded', 'bg-kx-raised text-kx-ink2'],
        applied: [es ? 'Aplicado' : 'Applied', 'bg-[var(--kx-almost-chip-bg)] text-[var(--kx-almost-chip-ink)]'],
        confirmed: [es ? 'Confirmado' : 'Confirmed', 'bg-[var(--kx-paid-chip-bg)] text-[var(--kx-paid-chip-ink)]'],
    };
    const DOT: Record<Kind, string> = { payment: 'bg-kx-paid', income: 'bg-kx-pay', spend: 'bg-kx-ink3', plan: 'bg-kx-ink2', ai: 'bg-kx-amber' };

    const weekPaid = entries.filter((e) => e.kind === 'payment' && e.date >= dayKey(new Date(now - 6 * 864e5)));
    const phrase = entries.length === 0
        ? (es ? 'Todavía no hay movimientos: cuando pagues o registres algo, aparecerá aquí.' : 'No activity yet: payments and records will show up here.')
        : weekPaid.length
            ? (es ? `Esta semana registraste ${weekPaid.length} ${weekPaid.length === 1 ? 'pago' : 'pagos'}.` : `This week you recorded ${weekPaid.length} payment${weekPaid.length === 1 ? '' : 's'}.`)
            : (es ? 'Sin pagos esta semana: tu último movimiento está abajo.' : 'No payments this week: your latest activity is below.');

    return (
        <div className="kx-scope -m-4 min-h-full pb-28 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Actividad' : 'Activity'} greeting={es ? 'el registro vivo de tu dinero' : 'the live record of your money'} />
                <AmberRule />

                {data.loading && [0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-[20px] bg-kx-surface" aria-busy="true" />)}
                {data.error && (
                    <Section tone="debt" title={es ? 'No pudimos cargar tu actividad' : "We couldn't load your activity"}>
                        <button onClick={load} className="text-sm font-semibold text-kx-amber">{es ? 'Reintentar' : 'Retry'}</button>
                    </Section>
                )}

                {!data.loading && !data.error && (
                    <>
                        <StatePhrase tone={weekPaid.length ? 'paid' : 'amber'}>{phrase}</StatePhrase>

                        <div className="flex flex-wrap gap-2" role="tablist" aria-label={es ? 'Filtrar actividad' : 'Filter activity'}>
                            {([['all', es ? 'Todo' : 'All'], ['payment', es ? 'Pagos' : 'Payments'], ['income', es ? 'Ingresos' : 'Income'], ['plan', es ? 'Plan' : 'Plan'], ['ai', es ? 'Tu IA' : 'Your AI']] as const).map(([id, label]) => (
                                <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}
                                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${filter === id ? 'border-kx-amber bg-kx-amber text-[#111418]' : 'border-[#263449] bg-kx-surface text-kx-ink2'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {blocks.length === 0 && (
                            <Section tone="neutral" title={es ? 'Nada por aquí' : 'Nothing here'}>
                                <p className="text-sm text-kx-ink2">{es ? 'No hay movimientos con este filtro.' : 'No activity for this filter.'}</p>
                            </Section>
                        )}

                        {blocks.map((b) => {
                            const all = expanded[b.id];
                            const shown = all ? b.items : b.items.slice(0, PER_BLOCK);
                            return (
                                <Section key={b.id} tone="neutral" title={b.title}>
                                    <p className="-mt-1.5 mb-2 text-[12.5px] text-kx-ink2">{summary(b.items)}</p>
                                    {shown.map((e) => (
                                        <div key={e.key} className={e.kind === 'ai'
                                            ? 'my-1.5 rounded-xl border-l-[3px] border-kx-amber bg-[rgba(245,158,11,.06)] px-3 py-2.5'
                                            : 'border-t border-[var(--kx-line-soft)] py-2.5 first-of-type:border-t-0'}>
                                            <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpenEntry(openEntry === e.key ? null : e.key)} aria-expanded={openEntry === e.key}>
                                                <span className={`mt-[6px] h-2.5 w-2.5 flex-none rounded-full ${DOT[e.kind]}`} aria-hidden="true" />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-[14.5px] font-semibold leading-snug text-kx-ink">{e.text}</span>
                                                    <span className="mt-0.5 block text-[12.5px] text-kx-ink2">{e.group ? burstLine(e) : e.sub}</span>
                                                </span>
                                                <span className={`mt-0.5 flex-none rounded-full px-2 py-[3px] text-[10px] font-bold tracking-[.06em] ${CHIP[e.status][1]}`}>{CHIP[e.status][0]}</span>
                                            </button>
                                            {openEntry === e.key && (
                                                <dl className="kx-tech ml-6 mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-kx-raised p-3 text-[11.5px]">
                                                    {e.audit.map(([k, v]) => <Fragment key={k}><dt className="text-kx-ink3">{k}</dt><dd className="text-kx-ink">{v}</dd></Fragment>)}
                                                    {e.group && (
                                                        <>
                                                            <dt className="text-kx-ink3">{es ? 'Veces' : 'Times'}</dt>
                                                            <dd className="text-kx-ink">
                                                                {e.group.map((g) => <span key={g.key} className="block">{timeOf(g)}</span>)}
                                                            </dd>
                                                        </>
                                                    )}
                                                </dl>
                                            )}
                                        </div>
                                    ))}
                                    {b.items.length > PER_BLOCK && (
                                        <button onClick={() => setExpanded((x) => ({ ...x, [b.id]: !all }))} className="mt-2 text-[13px] font-semibold text-kx-amber">
                                            {all ? (es ? 'Ver menos' : 'Show less') : (es ? `Ver ${b.items.length - PER_BLOCK} más` : `Show ${b.items.length - PER_BLOCK} more`)}
                                        </button>
                                    )}
                                </Section>
                            );
                        })}

                        <div className="rounded-2xl border border-kx-line bg-kx-surface p-4 text-[12.5px] leading-relaxed text-kx-ink2">
                            <b className="text-kx-ink">{es ? 'Nada se mueve sin quedar escrito.' : 'Nothing moves without being written down.'}</b>{' '}
                            {es ? 'Cada pago, movimiento de tu plan y acción de tu IA aparece aquí: es tu registro y tu auditoría. Toca uno para ver su detalle.' : 'Every payment, plan move and AI action shows up here: your record and your audit. Tap one to see its detail.'}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
