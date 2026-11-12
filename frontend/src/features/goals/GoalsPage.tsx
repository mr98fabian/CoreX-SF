/**
 * Metas: the house goal first (read-only, from /api/house-goal; edited in Ajustes #casa),
 * then the user's own savings goals (/api/goals). Progress and ETA come from the engine
 * (velocity_engine.goal_progress) and the ETA is labelled as an estimate.
 * Colors: GoalBar amber, celebration in amber. kx-paid (green) is not used on this screen.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiFetch } from '@/lib/api';
import { AmberRule, BankHeader, GoalBar, PrimaryPill, Section } from '@/components/kx';
import type { HouseGoal } from '@/features/home/HouseModule';

export interface Goal {
    id: number; name: string; target_amount: number; saved_amount: number; monthly_saving: number | null;
    deadline: string | null; pct: number; remaining: number; completed: boolean;
    eta_months: number | null; eta_date: string | null;
}

const monthYear = (iso: string, es: boolean) =>
    new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(es ? 'es' : 'en', { month: 'long', year: 'numeric' });

type Draft = { name: string; target_amount: string; monthly_saving: string; deadline: string };
const EMPTY: Draft = { name: '', target_amount: '', monthly_saving: '', deadline: '' };

export default function GoalsPage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Metas' : 'Goals');
    const { formatMoney } = useFormatMoney();
    const qc = useQueryClient();
    const house = useQuery({ queryKey: ['house-goal'], queryFn: () => apiFetch<HouseGoal>('/api/house-goal'), staleTime: 60_000 });
    const goals = useQuery({ queryKey: ['goals'], queryFn: () => apiFetch<{ goals: Goal[] }>('/api/goals') });

    const [editing, setEditing] = useState<number | 'new' | null>(null);
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [saving, setSaving] = useState<{ id: number; amount: string } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Goal | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = () => qc.invalidateQueries({ queryKey: ['goals'] });
    const run = async (fn: () => Promise<unknown>) => {
        setBusy(true); setError(null);
        try { await fn(); await refresh(); return true; }
        catch { setError(es ? 'No pudimos guardar el cambio. Revisa los datos e inténtalo otra vez.' : "We couldn't save the change. Check the data and try again."); return false; }
        finally { setBusy(false); }
    };

    const openNew = () => { setDraft(EMPTY); setEditing('new'); };
    const openEdit = (g: Goal) => {
        setDraft({ name: g.name, target_amount: String(g.target_amount), monthly_saving: g.monthly_saving != null ? String(g.monthly_saving) : '', deadline: g.deadline ?? '' });
        setEditing(g.id);
    };
    const submitGoal = async (e: FormEvent) => {
        e.preventDefault();
        const target = Number(draft.target_amount);
        if (!draft.name.trim() || !(target > 0)) { setError(es ? 'Ponle nombre y un monto meta mayor que $0.' : 'Give it a name and a target above $0.'); return; }
        const body = {
            name: draft.name.trim(), target_amount: target,
            monthly_saving: draft.monthly_saving ? Number(draft.monthly_saving) : null,
            deadline: draft.deadline || null,
        };
        const ok = await run(() => editing === 'new'
            ? apiFetch('/api/goals', { method: 'POST', body: JSON.stringify(body) })
            : apiFetch(`/api/goals/${editing}`, { method: 'PATCH', body: JSON.stringify(body) }));
        if (ok) setEditing(null);
    };
    const submitSavings = async (e: FormEvent) => {
        e.preventDefault();
        if (!saving) return;
        const amount = Number(saving.amount);
        if (!(amount > 0)) { setError(es ? 'El ahorro tiene que ser mayor que $0.' : 'The saving must be above $0.'); return; }
        const ok = await run(() => apiFetch(`/api/goals/${saving.id}/add-savings`, { method: 'POST', body: JSON.stringify({ amount }) }));
        if (ok) setSaving(null);
    };
    const doDelete = async () => {
        if (!confirmDelete) return;
        const ok = await run(() => apiFetch(`/api/goals/${confirmDelete.id}`, { method: 'DELETE' }));
        if (ok) setConfirmDelete(null);
    };

    const list = goals.data?.goals ?? [];
    const h = house.data;
    const input = 'h-11 w-full rounded-xl border border-kx-line bg-kx-bg px-3 text-[15px] text-kx-ink outline-none placeholder:text-kx-ink3';

    const form = (
        <form onSubmit={submitGoal} data-testid="goal-form" className="space-y-3 rounded-[20px] border border-kx-line bg-kx-surface p-4 shadow-[var(--kx-elev-1)]">
            <label className="block"><span className="kx-label">{es ? 'Nombre' : 'Name'}</span>
                <input data-testid="goal-name" className={`${input} mt-1.5`} maxLength={80} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={es ? 'Ej. fondo de emergencia' : 'e.g. emergency fund'} /></label>
            <label className="block"><span className="kx-label">{es ? 'Monto meta' : 'Target'}</span>
                <input data-testid="goal-target" className={`${input} kx-num mt-1.5`} type="number" inputMode="decimal" min="0" step="0.01" value={draft.target_amount} onChange={(e) => setDraft({ ...draft, target_amount: e.target.value })} /></label>
            <label className="block"><span className="kx-label">{es ? 'Ahorro mensual (opcional)' : 'Monthly saving (optional)'}</span>
                <input className={`${input} kx-num mt-1.5`} type="number" inputMode="decimal" min="0" step="0.01" value={draft.monthly_saving} onChange={(e) => setDraft({ ...draft, monthly_saving: e.target.value })} /></label>
            <label className="block"><span className="kx-label">{es ? 'Fecha límite (opcional)' : 'Deadline (optional)'}</span>
                <input className={`${input} mt-1.5`} type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} /></label>
            <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="kx-press flex-1 rounded-xl border border-kx-line py-3 text-sm font-semibold text-kx-ink2">{es ? 'Cancelar' : 'Cancel'}</button>
                <div className="flex-1"><PrimaryPill type="submit" disabled={busy}>{editing === 'new' ? (es ? 'Crear meta' : 'Create goal') : (es ? 'Guardar' : 'Save')}</PrimaryPill></div>
            </div>
        </form>
    );

    return (
        <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Metas' : 'Goals'} greeting={es ? 'lo que estás juntando' : "what you're saving for"} />
                <AmberRule />

                {error && <p role="alert" data-testid="goals-error" className="rounded-[14px] border border-kx-line bg-kx-raised px-4 py-3 text-[14px] text-kx-ink">{error}</p>}

                {/* The house goal: lives in house_goals, edited in Ajustes → Compra de casa */}
                <Section tone="neutral" title={es ? 'La casa' : 'The home'}>
                    <Link to="/dashboard/settings#casa" data-testid="house-card" className="kx-press block">
                        {h?.active ? (
                            <>
                                <p className="flex items-center gap-2 text-[14px] text-kx-ink2">
                                    <Home className="h-4 w-4 text-kx-ink2" strokeWidth={1.75} />
                                    <b className="kx-num text-kx-ink">{formatMoney(h.saved ?? 0)}</b> {es ? 'de' : 'of'} <span className="kx-num">{formatMoney(h.target ?? 0)}</span>
                                    <span className="ml-auto kx-num text-kx-ink">{Math.round(h.pct ?? 0)}%</span>
                                </p>
                                <GoalBar pct={h.pct ?? 0} label={es ? 'Progreso de la casa' : 'Home progress'} />
                            </>
                        ) : (
                            <p className="flex items-center gap-2 text-[14px] text-kx-ink2">
                                <Home className="h-4 w-4" strokeWidth={1.75} />
                                {es ? '¿Ahorras para una casa? Crea tu meta de casa en Ajustes ›' : 'Saving for a home? Create your home goal in Settings ›'}
                            </p>
                        )}
                    </Link>
                </Section>

                {editing !== null && form}

                {!goals.isLoading && list.length === 0 && editing === null && (
                    <Section tone="neutral" title={es ? 'Tus metas' : 'Your goals'}>
                        <div data-testid="goals-empty">
                            <p className="text-[14px] leading-relaxed text-kx-ink2">{es ? 'Un viaje, un fondo de emergencia, un regalo: ponle nombre y monto, y KoreX te dice cuándo llegas a tu ritmo.' : 'A trip, an emergency fund, a gift: name it, set the amount, and KoreX tells you when you get there at your pace.'}</p>
                            <div className="mt-4"><PrimaryPill onClick={openNew}>{es ? 'Crear mi primera meta' : 'Create my first goal'}</PrimaryPill></div>
                        </div>
                    </Section>
                )}

                {list.length > 0 && (
                    <Section tone="neutral" title={es ? 'Tus metas' : 'Your goals'} action={editing === null ? (
                        <button onClick={openNew} className="kx-press flex items-center gap-1 text-xs font-semibold text-kx-amber"><Plus className="h-3.5 w-3.5" />{es ? 'Nueva' : 'New'}</button>) : undefined} bare>
                        <div className="space-y-3">
                            {list.map((g) => (
                                <div key={g.id} data-testid={`goal-${g.id}`} className={`rounded-[18px] border bg-kx-surface p-4 shadow-[var(--kx-elev-1)] ${g.completed ? 'border-kx-amber' : 'border-kx-line'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="min-w-0 truncate text-[15px] font-semibold text-kx-ink">{g.name}</p>
                                        <div className="flex flex-none gap-1">
                                            <button aria-label={es ? 'Editar meta' : 'Edit goal'} onClick={() => openEdit(g)} className="kx-press rounded-lg p-1.5 text-kx-ink3 hover:text-kx-ink"><Pencil className="h-4 w-4" /></button>
                                            <button aria-label={es ? 'Borrar meta' : 'Delete goal'} onClick={() => setConfirmDelete(g)} className="kx-press rounded-lg p-1.5 text-kx-ink3 hover:text-kx-debt"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                    <p className="mt-1 text-[14px] text-kx-ink2">
                                        <b className="kx-num text-kx-ink">{formatMoney(g.saved_amount)}</b> {es ? 'de' : 'of'} <span className="kx-num">{formatMoney(g.target_amount)}</span>
                                    </p>
                                    <GoalBar pct={g.pct} label={g.name} />
                                    {g.completed ? (
                                        <p data-testid="goal-done" className="mt-2 text-[15px] font-semibold text-kx-amber">{es ? '¡Meta cumplida!' : 'Goal reached!'}</p>
                                    ) : (
                                        <p className="mt-2 text-[12.5px] text-kx-ink2">
                                            {g.eta_date ? <>{es ? 'A este ritmo: ' : 'At this pace: '}<b className="font-semibold text-kx-ink">{monthYear(g.eta_date, es)}</b> {es ? '(estimado)' : '(estimate)'}</> : (es ? 'Sin ritmo definido' : 'No pace set')}
                                        </p>
                                    )}
                                    {!g.completed && (saving?.id === g.id ? (
                                        <form onSubmit={submitSavings} className="mt-3 flex gap-2">
                                            <input autoFocus data-testid="savings-amount" type="number" inputMode="decimal" min="0" step="0.01" value={saving.amount} onChange={(e) => setSaving({ id: g.id, amount: e.target.value })}
                                                placeholder="$0.00" className={`${input} kx-num`} />
                                            <button type="submit" disabled={busy} className="kx-press flex-none rounded-xl bg-kx-amber px-4 text-sm font-bold text-[#111418]">{es ? 'Sumar' : 'Add'}</button>
                                        </form>
                                    ) : (
                                        <button data-testid="add-savings" onClick={() => setSaving({ id: g.id, amount: '' })} className="kx-press mt-3 text-[13px] font-semibold text-kx-amber">+ {es ? 'Registrar ahorro' : 'Record saving'}</button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {confirmDelete && (
                    <div role="alertdialog" data-testid="confirm-delete" className="rounded-[18px] border border-kx-debt bg-kx-surface p-4">
                        <p className="text-[14px] text-kx-ink">{es ? `¿Borrar la meta "${confirmDelete.name}"? No se puede deshacer.` : `Delete the goal "${confirmDelete.name}"? This can't be undone.`}</p>
                        <div className="mt-3 flex gap-2">
                            <button onClick={() => setConfirmDelete(null)} className="kx-press flex-1 rounded-xl border border-kx-line py-2.5 text-sm font-semibold text-kx-ink2">{es ? 'Cancelar' : 'Cancel'}</button>
                            <button data-testid="confirm-delete-yes" onClick={doDelete} disabled={busy} className="kx-press flex-1 rounded-xl bg-kx-debt py-2.5 text-sm font-bold text-[#111418]">{es ? 'Borrar' : 'Delete'}</button>
                        </div>
                    </div>
                )}

                <p className="text-[12px] text-kx-ink3">{es ? 'Las fechas son estimaciones con el ahorro mensual que declaraste.' : 'Dates are estimates from the monthly saving you declared.'}</p>
            </div>
        </div>
    );
}
