/**
 * Cuentas (Fase 6, approved v8): the same total debt as Inicio as hero + a
 * small "available", then accounts GROUPED BY STAGE (EN DEUDA → CASI →
 * PAGADAS, then support accounts). Each row: stage band, name, tabular
 * balance, progress bar, labeled chip. Detail (APR, limit, minimum, cut and
 * due days, history, "Registrar pago") is one tap away in a sheet; the full
 * manager with amortization is the third layer (/dashboard/accounts/manage).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { useKxSummary, type StagedAccount } from '@/hooks/useKxSummary';
import { STAGE_ORDER, localDay, type Stage } from '@/lib/stage';
import { AmberRule, BankHeader, HeroNumber, LedgerRow, PaidStamp, PrimaryPill, Section, StageBar, StageChip, StatePhrase } from '@/components/kx';
import { MoneyCount, StampDrop } from '@/components/kx/motion';
import { moment, primeAudio } from '@/lib/feedback';
import { useJustPaid } from '@/hooks/useJustPaid';
import { findFundingAccount } from '@/lib/funding';
import { AccountLogo } from '@/components/AccountLogo';

const MAX_PER_SECTION = 4; // rule 4: sections of 3–4 items; longer groups split into named parts

interface Tx { id: number; date: string; amount: number | string; description: string; category: string }

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

export default function AccountsStagePage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Cuentas' : 'Accounts');
    const { formatMoney, formatDateShort } = useFormatMoney();
    const { toast } = useToast();
    const s = useKxSummary();
    const [params, setParams] = useSearchParams();
    const filter = params.get('stage') as Stage | null;
    const [open, setOpen] = useState<StagedAccount | null>(null);
    const [history, setHistory] = useState<Tx[] | null>(null);
    const [amount, setAmount] = useState('');
    const [saving, setSaving] = useState(false);
    const justPaid = useJustPaid(s.staged);
    // A debt that just reached $0 (the PAGADA stamp drops) is the big moment
    const paidCount = useRef(justPaid.size);
    useEffect(() => { if (justPaid.size > paidCount.current) moment('zero-cut'); paidCount.current = justPaid.size; }, [justPaid.size]);

    const groups = useMemo(() => {
        const byStage: Record<Stage, StagedAccount[]> = { debt: [], almost: [], paid: [], support: [] };
        for (const a of s.staged) byStage[a.stage].push(a);
        byStage.debt.sort((a, b) => Number(b.interest_rate) - Number(a.interest_rate)); // attack order
        byStage.almost.sort((a, b) => a.bal - b.bal);
        return byStage;
    }, [s.staged]);

    const openDetail = (a: StagedAccount) => {
        setOpen(a); setHistory(null); setAmount('');
        apiFetch<Tx[]>(`/api/accounts/${a.id}/transactions`).then((t) => setHistory(t.slice(0, 4))).catch(() => setHistory([]));
    };

    const registerPayment = async () => {
        if (!open) return;
        const value = parseFloat(amount);
        if (!value || value <= 0) return;
        primeAudio(); // inside the tap: lets iOS play the moment sound afterwards
        setSaving(true);
        try {
            await apiFetch('/api/transactions/manual', {
                method: 'POST',
                body: JSON.stringify({ account_id: open.id, amount: value, description: es ? 'Pago registrado' : 'Payment recorded',
                    category: 'payment', date: localDay() }),
            });
            moment('payment');
            toast({ title: es ? `Pago de ${formatMoney(value)} registrado` : `Payment of ${formatMoney(value)} recorded` });
            setOpen(null);
            s.reload();
        } catch {
            toast({ title: es ? 'No se pudo registrar el pago' : "Couldn't record the payment", variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const titles: Record<Stage, string> = {
        debt: es ? 'En deuda · ataca primero' : 'In debt · attack first',
        almost: es ? 'Casi · a un paso del verde' : 'Almost · one step from green',
        paid: es ? 'Pagadas · en verde' : 'Paid · in green',
        support: es ? 'Cuentas de apoyo' : 'Support accounts',
    };
    const note = (a: StagedAccount) => {
        const parts: string[] = [];
        if (a.paid != null && a.stage !== 'paid') parts.push(es ? `${Math.round(a.paid * 100)}% pagado` : `${Math.round(a.paid * 100)}% paid`);
        if (a.stage === 'paid') parts.push(es ? 'en $0' : 'at $0');
        else if (a.closing_day) parts.push(es ? `corte el ${a.closing_day}` : `cuts on the ${a.closing_day}`);
        return parts.join(' · ');
    };

    if (s.loading) {
        return <div className="kx-scope -m-4 min-h-full space-y-4 p-5 md:-m-8 md:p-8" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-32 kx-shimmer rounded-[20px]" />)}
        </div>;
    }
    if (s.error) {
        return <div className="kx-scope -m-4 min-h-full p-5 md:-m-8 md:p-8">
            <Section tone="debt" title={es ? 'No pudimos cargar tus cuentas' : "We couldn't load your accounts"}>
                <button onClick={s.reload} className="text-sm font-semibold text-kx-amber">{es ? 'Reintentar' : 'Retry'}</button>
            </Section>
        </div>;
    }

    const support = groups.support;
    const mainChecking = findFundingAccount(support);
    const phrase = s.debts.length === 0
        ? (es ? 'Aún no tienes deudas registradas.' : 'No debts on record yet.')
        : (es ? `${s.staged.length} cuentas: ${s.counts.debt} en deuda, ${s.counts.almost} casi, ${s.counts.paid} pagadas.`
            : `${s.staged.length} accounts: ${s.counts.debt} in debt, ${s.counts.almost} almost, ${s.counts.paid} paid.`);
    const visible: Stage[] = filter && STAGE_ORDER.includes(filter) ? [filter] : [...STAGE_ORDER, 'support'];

    return (
        <div className="kx-scope -m-4 min-h-full pb-28 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Cuentas' : 'Accounts'} greeting={es ? 'agrupadas por etapa, no en lista plana' : 'grouped by stage, not a flat list'} />
                <AmberRule />
                <StatePhrase>{phrase}</StatePhrase>
                <HeroNumber label={es ? 'Deuda total' : 'Total debt'} amount={s.totalDebt}
                    phrase={<>{es ? 'Disponible ' : 'Available '}<b className="kx-num font-semibold text-kx-ink">{formatMoney(s.liquid)}</b>
                        {mainChecking && <span className="text-kx-ink3"> · {mainChecking.name}</span>}</>} />

                {filter && (
                    <button onClick={() => setParams({})} className="text-[13px] font-semibold text-kx-amber">
                        {es ? '← Ver todas las etapas' : '← Show all stages'}
                    </button>
                )}

                {visible.map((stage) => {
                    const list = groups[stage];
                    if (list.length === 0) return null;
                    const parts = chunk(list, MAX_PER_SECTION);
                    return parts.map((part, pi) => (
                        <Section key={`${stage}-${pi}`} tone={stage}
                            title={parts.length > 1 ? `${titles[stage]} · ${pi + 1}/${parts.length}` : titles[stage]}>
                            {part.map((a) => (
                                <LedgerRow key={a.id} title={a.name} logo={<AccountLogo name={a.name} src={a.logo_url} />} amount={<MoneyCount value={a.bal} />} stage={stage} onClick={() => openDetail(a)}>
                                    {stage !== 'support' && (
                                        <>
                                            <span className="mt-1.5 flex items-center gap-2">
                                                <StageChip stage={stage} suffix={stage === 'paid' ? ' ✓' : ''} />
                                                <span className="text-xs text-kx-ink2">{note(a)}</span>
                                                {stage === 'paid' && <span className="ml-auto"><StampDrop drop={justPaid.has(a.id)}><PaidStamp /></StampDrop></span>}
                                            </span>
                                            <StageBar stage={stage} pct={a.paid} />
                                        </>
                                    )}
                                </LedgerRow>
                            ))}
                        </Section>
                    ));
                })}

                {filter && groups[filter]?.length === 0 && (
                    <Section tone={filter} title={titles[filter]}>
                        <p className="text-sm text-kx-ink2">{es ? 'Todavía no hay cuentas en esta etapa.' : 'No accounts in this stage yet.'}</p>
                    </Section>
                )}

                {s.staged.length === 0 && (
                    <Section tone="neutral" title={es ? 'Empieza aquí' : 'Start here'}>
                        <p className="text-sm text-kx-ink2">{es ? 'Agrega tus tarjetas, préstamos y tu cuenta de cheques para ver tu camino al verde.' : 'Add your cards, loans and checking account to see your path to green.'}</p>
                    </Section>
                )}

                <Link to="/dashboard/accounts/manage" className="block rounded-full border border-dashed border-[#263449] py-3 text-center text-[13px] text-kx-ink3">
                    {es ? 'Agregar o editar cuentas · ' : 'Add or edit accounts · '}<b className="font-semibold text-kx-ink2">{es ? 'abrir gestor' : 'open manager'}</b>
                </Link>
            </div>

            <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
                <SheetContent side="bottom" className="kx-scope max-h-[88dvh] overflow-y-auto rounded-t-3xl border-kx-line bg-kx-surface">
                    {open && (
                        <div className="mx-auto max-w-xl space-y-5 pb-4">
                            <SheetHeader className="text-left">
                                <SheetTitle className="flex items-center gap-3 text-kx-ink">
                                    {open.name}
                                    {open.stage === 'paid' && <PaidStamp />}
                                </SheetTitle>
                                <SheetDescription className="text-kx-ink2">
                                    {open.stage === 'support'
                                        ? (es ? 'Cuenta de apoyo: de aquí sale tu plan.' : 'Support account: your plan draws from here.')
                                        : (es ? `Debes ${formatMoney(open.bal)}.` : `You owe ${formatMoney(open.bal)}.`)}
                                </SheetDescription>
                            </SheetHeader>

                            <dl className="grid grid-cols-2 gap-3 text-sm">
                                {([
                                    [es ? 'Tasa (APR)' : 'Rate (APR)', `${Number(open.interest_rate).toFixed(2)}%`],
                                    open.type === 'debt' && [es ? 'Pago mínimo' : 'Minimum', formatMoney(Number(open.min_payment) || 0)],
                                    open.credit_limit && [es ? 'Límite' : 'Limit', formatMoney(Number(open.credit_limit))],
                                    open.closing_day && [es ? 'Día de corte' : 'Cut day', String(open.closing_day)],
                                    open.due_day && [es ? 'Día de pago' : 'Due day', String(open.due_day)],
                                ].filter(Boolean) as [string, string][]).map(([k, v]) => (
                                    <div key={k} className="rounded-xl bg-kx-raised p-3">
                                        <dt className="kx-label">{k}</dt>
                                        <dd className="kx-tech mt-1 text-[15px] text-kx-ink">{v}</dd>
                                    </div>
                                ))}
                            </dl>

                            {open.type === 'debt' && open.bal > 0 && (
                                <div className="space-y-2.5">
                                    <label htmlFor="kx-pay" className="kx-label">{es ? 'Registrar pago' : 'Record a payment'}</label>
                                    <input id="kx-pay" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                                        placeholder={formatMoney(Number(open.min_payment) || 0)}
                                        className="kx-num w-full rounded-xl border border-kx-line bg-kx-bg px-4 py-3 text-lg text-kx-ink outline-none focus:border-kx-amber" />
                                    <PrimaryPill onClick={registerPayment} disabled={saving || !(parseFloat(amount) > 0)}>
                                        {es ? 'Registrar pago' : 'Record payment'}
                                    </PrimaryPill>
                                </div>
                            )}

                            <div>
                                <p className="kx-label mb-2">{es ? 'Últimos movimientos' : 'Recent activity'}</p>
                                {history === null && <div className="h-12 kx-shimmer rounded-xl" />}
                                {history?.length === 0 && <p className="text-sm text-kx-ink3">{es ? 'Sin movimientos todavía.' : 'No activity yet.'}</p>}
                                {history?.map((t) => (
                                    <p key={t.id} className="flex justify-between border-t border-[var(--kx-line-soft)] py-2 text-sm first:border-t-0">
                                        <span className="text-kx-ink2">{t.description} · <span className="kx-tech text-xs">{formatDateShort(t.date)}</span></span>
                                        <span className="kx-num text-kx-ink">{formatMoney(Number(t.amount))}</span>
                                    </p>
                                ))}
                            </div>

                            <Link to="/dashboard/accounts/manage" className="block text-center text-[13px] font-semibold text-kx-amber">
                                {es ? 'Ver detalle completo y amortización ›' : 'Full detail and amortization ›'}
                            </Link>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
