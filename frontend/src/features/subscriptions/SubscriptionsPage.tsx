/**
 * Suscripciones — recurring charges in the continuous language: hero with the
 * monthly total (Fraunces) + "al año", one ledger of active charges ordered by
 * next charge (logo · name · "en 3 días · 9 nov" · amount · paying card in
 * faint ···4884), then "Ya no pagas" with the saving in green. Totals come
 * from the backend (active only, normalised to a month). + adds, tap edits.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAccounts } from '@/hooks/useAccounts';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { AmberRule, BankHeader, HeroNumber, LedgerRow, PrimaryPill, Section } from '@/components/kx';
import { AccountLogo } from '@/components/AccountLogo';
import { cardHint, whenInWords, type Freq, type RecurringSub, type SubsResponse } from './subscriptionText';

const FREQ_LABEL = { es: { monthly: 'al mes', annual: 'al año', weekly: 'a la semana' }, en: { monthly: 'monthly', annual: 'yearly', weekly: 'weekly' } };

interface Draft { id?: number; name: string; amount: string; frequency: Freq; next_charge_date: string; account_id: string; status?: 'active' | 'cancelled' }
const EMPTY: Draft = { name: '', amount: '', frequency: 'monthly', next_charge_date: '', account_id: '' };

export function SubscriptionsView({ data, es, onAdd, onEdit }: { data: SubsResponse; es: boolean; onAdd: () => void; onEdit: (s: RecurringSub) => void }) {
    const { formatMoney } = useFormatMoney();
    const active = data.items.filter((s) => s.status === 'active');
    const gone = data.items.filter((s) => s.status === 'cancelled');
    const addBtn = (
        <button onClick={onAdd} aria-label={es ? 'Agregar suscripción' : 'Add subscription'}
            className="kx-press flex h-9 w-9 items-center justify-center rounded-full border border-kx-line text-kx-ink2 hover:text-kx-ink">
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
    );
    return (
        <>
            <HeroNumber label={es ? 'Pagas al mes · estimado' : 'You pay monthly · estimate'} amount={Number(data.monthly_total)}
                phrase={<>{es ? 'Al año: ' : 'Per year: '}<b className="kx-num font-semibold text-kx-ink">{formatMoney(Number(data.annual_total))}</b>
                    <span className="text-kx-ink3">{es ? ` · ${active.length} activas` : ` · ${active.length} active`}</span></>} />

            <Section tone="neutral" title={es ? 'Próximos cobros' : 'Upcoming charges'} action={addBtn}>
                {active.length === 0 && <p className="py-1 text-[13.5px] text-kx-ink2">{es ? 'Aún no registras suscripciones. Toca + para agregar la primera.' : 'No subscriptions yet. Tap + to add the first.'}</p>}
                {active.map((s) => (
                    <LedgerRow key={s.id} onClick={() => onEdit(s)} title={s.name} logo={<AccountLogo name={s.name} src={s.logo_url} />}
                        amount={formatMoney(Number(s.amount))}>
                        <span className="mt-0.5 flex justify-between gap-2 pl-[42px] text-[12.5px]">
                            <span className="text-kx-ink2">{whenInWords(s.next_charge_date, es)}{s.frequency !== 'monthly' && ` · ${FREQ_LABEL[es ? 'es' : 'en'][s.frequency]}`}</span>
                            {cardHint(s.account_name) && <span className="kx-tech text-kx-ink3">{cardHint(s.account_name)}</span>}
                        </span>
                    </LedgerRow>
                ))}
            </Section>

            {gone.length > 0 && (
                <Section tone="neutral" title={es ? 'Ya no pagas' : 'No longer paying'}>
                    {gone.map((s) => (
                        <LedgerRow key={s.id} onClick={() => onEdit(s)} title={<span className="text-kx-ink2 line-through decoration-kx-ink3">{s.name}</span>}
                            logo={<AccountLogo name={s.name} src={s.logo_url} />}
                            amount={<span className="text-kx-paid">+{formatMoney(Number(s.monthly_equivalent))}</span>}>
                            <span className="mt-0.5 block pl-[42px] text-[12.5px] text-kx-paid">{es ? 'ahorras al mes (estimado)' : 'saved per month (estimate)'}</span>
                        </LedgerRow>
                    ))}
                </Section>
            )}
        </>
    );
}

export default function SubscriptionsPage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Suscripciones' : 'Subscriptions');
    const { toast } = useToast();
    const qc = useQueryClient();
    const { data: accounts } = useAccounts();
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['recurring-subscriptions'],
        queryFn: () => apiFetch<SubsResponse>('/api/subscriptions'),
        staleTime: 45_000,
    });
    const [draft, setDraft] = useState<Draft | null>(null);
    const done = () => { qc.invalidateQueries({ queryKey: ['recurring-subscriptions'] }); setDraft(null); };
    const failed = () => toast({ title: es ? 'No se pudo guardar' : 'Could not save', variant: 'destructive' });

    const save = useMutation({
        mutationFn: (d: Draft) => {
            const body = JSON.stringify({
                name: d.name.trim(), amount: d.amount, frequency: d.frequency,
                next_charge_date: d.next_charge_date || null, account_id: d.account_id ? Number(d.account_id) : null,
                ...(d.status ? { status: d.status } : {}),
            });
            return d.id
                ? apiFetch(`/api/subscriptions/${d.id}`, { method: 'PATCH', body })
                : apiFetch('/api/subscriptions', { method: 'POST', body });
        },
        onSuccess: done,
        onError: failed,
    });
    const cancel = useMutation({
        mutationFn: (id: number) => apiFetch(`/api/subscriptions/${id}`, { method: 'DELETE' }),
        onSuccess: done,
        onError: failed,
    });

    const edit = (s: RecurringSub) => setDraft({ id: s.id, name: s.name, amount: s.amount, frequency: s.frequency,
        next_charge_date: s.next_charge_date ?? '', account_id: s.account_id ? String(s.account_id) : '', status: s.status });
    const field = 'w-full rounded-xl border border-kx-line bg-kx-bg px-4 py-3 text-[15px] text-kx-ink outline-none focus:border-kx-amber';
    const valid = !!draft && draft.name.trim().length > 0 && parseFloat(draft.amount) > 0;

    return (
        <div className="kx-scope -m-4 min-h-full pb-28 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Suscripciones' : 'Subscriptions'} greeting={es ? 'lo que te cobran cada mes, en un solo lugar' : 'what you are charged every month, in one place'} />
                <AmberRule />
                {isLoading && <div className="h-40 animate-pulse rounded-[var(--kx-radius-card)] bg-kx-surface" aria-busy="true" />}
                {isError && (
                    <Section tone="debt" title={es ? 'No pudimos cargar tus suscripciones' : "We couldn't load your subscriptions"}>
                        <button onClick={() => refetch()} className="text-sm font-semibold text-kx-amber">{es ? 'Reintentar' : 'Retry'}</button>
                    </Section>
                )}
                {data && <SubscriptionsView data={data} es={es} onAdd={() => setDraft({ ...EMPTY })} onEdit={edit} />}
            </div>

            <Sheet open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
                <SheetContent side="bottom" className="kx-scope max-h-[88dvh] overflow-y-auto rounded-t-3xl border-kx-line bg-kx-surface">
                    {draft && (
                        <form className="mx-auto max-w-xl space-y-3.5 pb-4" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(draft); }}>
                            <SheetHeader className="text-left">
                                <SheetTitle className="font-editorial text-[22px] font-[460] text-kx-ink">
                                    {draft.id ? draft.name : (es ? 'Nueva suscripción' : 'New subscription')}
                                </SheetTitle>
                                <SheetDescription className="text-kx-ink2">{es ? 'Nombre, monto, cada cuánto y qué tarjeta la paga.' : 'Name, amount, how often and which card pays it.'}</SheetDescription>
                            </SheetHeader>
                            <label className="block space-y-1.5"><span className="kx-label">{es ? 'Nombre' : 'Name'}</span>
                                <input className={field} value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Netflix" /></label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="block space-y-1.5"><span className="kx-label">{es ? 'Monto' : 'Amount'}</span>
                                    <input className={`${field} kx-num`} type="number" inputMode="decimal" min="0" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></label>
                                <label className="block space-y-1.5"><span className="kx-label">{es ? 'Cada' : 'Every'}</span>
                                    <select className={field} value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Freq })}>
                                        <option value="monthly">{es ? 'Mes' : 'Month'}</option>
                                        <option value="annual">{es ? 'Año' : 'Year'}</option>
                                        <option value="weekly">{es ? 'Semana' : 'Week'}</option>
                                    </select></label>
                            </div>
                            <label className="block space-y-1.5"><span className="kx-label">{es ? 'Próximo cobro' : 'Next charge'}</span>
                                <input className={field} type="date" value={draft.next_charge_date} onChange={(e) => setDraft({ ...draft, next_charge_date: e.target.value })} /></label>
                            <label className="block space-y-1.5"><span className="kx-label">{es ? 'La paga' : 'Paid with'}</span>
                                <select className={field} value={draft.account_id} onChange={(e) => setDraft({ ...draft, account_id: e.target.value })}>
                                    <option value="">{es ? 'Sin asignar' : 'Not set'}</option>
                                    {(accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select></label>
                            <PrimaryPill type="submit" disabled={!valid || save.isPending}>{es ? 'Guardar' : 'Save'}</PrimaryPill>
                            {draft.id && draft.status === 'active' && (
                                <button type="button" onClick={() => cancel.mutate(draft.id!)} disabled={cancel.isPending}
                                    className="kx-press block w-full py-2 text-center text-[13.5px] font-semibold text-kx-debt">{es ? 'Ya no la pago' : 'I no longer pay it'}</button>
                            )}
                            {draft.id && draft.status === 'cancelled' && (
                                <button type="button" onClick={() => save.mutate({ ...draft, status: 'active' })}
                                    className="kx-press block w-full py-2 text-center text-[13.5px] font-semibold text-kx-ink2">{es ? 'La volví a contratar' : 'I subscribed again'}</button>
                            )}
                        </form>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
