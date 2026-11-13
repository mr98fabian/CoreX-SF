/**
 * Juez de compras: "¿cuánto me retrasa esta compra?". Calls POST /api/simulator/time-cost
 * (the engine decides; no money math here) and builds the verdict ONLY from the response
 * fields — the `message` string is English and is ignored. The judge shows the number and
 * never lectures: every verdict closes with "Tú decides."
 */
import { useState, type FormEvent } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { MoneyAmount } from '@/components/MoneyAmount';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiFetch } from '@/lib/api';
import { AmberRule, BankHeader, PrimaryPill, Section, StatePhrase } from '@/components/kx';
import { verdictOf, type TimeCost, type Verdict } from './verdict';

function monthYear(iso: string, es: boolean) {
    // Anchor at noon so negative time zones don't fall into the previous month
    return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(es ? 'es' : 'en', { month: 'long', year: 'numeric' });
}

export default function JudgePage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Juez de compras' : 'Purchase judge');
    const { formatMoney } = useFormatMoney();
    const [amount, setAmount] = useState('');
    const [label, setLabel] = useState('');
    const [busy, setBusy] = useState(false);
    const [verdict, setVerdict] = useState<Verdict | null>(null);
    const [judged, setJudged] = useState<{ amount: number; label: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const judge = async (e?: FormEvent) => {
        e?.preventDefault();
        const n = Number(amount);
        setError(null);
        if (!Number.isFinite(n) || n <= 0) {
            setVerdict(null);
            setError(es ? 'Escribe un monto mayor que $0 para poder juzgarlo.' : 'Enter an amount above $0 to judge it.');
            return;
        }
        setBusy(true);
        try {
            const r = await apiFetch<TimeCost>('/api/simulator/time-cost', { method: 'POST', body: JSON.stringify({ amount: n }) });
            setVerdict(verdictOf(r));
            setJudged({ amount: n, label: label.trim() });
        } catch (err) {
            setVerdict(null);
            const status = (err as { status?: number })?.status;
            setError(status === 400
                ? (es ? 'Ese monto no se puede juzgar: tiene que ser mayor que $0.' : "That amount can't be judged: it must be above $0.")
                : (es ? 'No pudimos juzgar la compra ahora. Revisa tu conexión e inténtalo otra vez.' : "We couldn't judge the purchase right now. Check your connection and try again."));
        } finally {
            setBusy(false);
        }
    };

    const what = judged ? (judged.label ? `${judged.label} · ${formatMoney(judged.amount)}` : formatMoney(judged.amount)) : '';

    return (
        <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Juez de compras' : 'Purchase judge'} greeting={es ? '¿cuánto te retrasa esta compra?' : 'how much does this purchase delay you?'} />
                <AmberRule />

                <form onSubmit={judge} className="space-y-3 rounded-[20px] border border-kx-line bg-kx-surface p-4 shadow-[var(--kx-elev-1)]">
                    <label className="block">
                        <span className="kx-label">{es ? 'Monto' : 'Amount'}</span>
                        <span className="mt-1.5 flex items-center gap-1 rounded-xl border border-kx-line bg-kx-bg px-3">
                            <span className="text-kx-ink3">$</span>
                            <input data-testid="judge-amount" inputMode="decimal" type="number" min="0" step="0.01" value={amount}
                                onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                                className="kx-num h-12 w-full min-w-0 bg-transparent text-lg text-kx-ink outline-none" />
                        </span>
                    </label>
                    <label className="block">
                        <span className="kx-label">{es ? '¿Qué es? (opcional)' : 'What is it? (optional)'}</span>
                        <input data-testid="judge-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60}
                            placeholder={es ? 'Ej. audífonos' : 'e.g. headphones'}
                            className="mt-1.5 h-11 w-full rounded-xl border border-kx-line bg-kx-bg px-3 text-[15px] text-kx-ink outline-none placeholder:text-kx-ink3" />
                    </label>
                    <PrimaryPill type="submit" disabled={busy}>{busy ? (es ? 'Juzgando…' : 'Judging…') : (es ? 'Juzgar' : 'Judge')}</PrimaryPill>
                </form>

                {error && (
                    <p role="alert" data-testid="judge-error" className="rounded-[14px] border border-kx-line bg-kx-raised px-4 py-3 text-[14px] text-kx-ink">{error}</p>
                )}

                {verdict && (
                    <div data-testid={`verdict-${verdict.kind}`} className="space-y-4">
                        {what && <p className="kx-label">{what}</p>}

                        {verdict.kind === 'delay' && (
                            <div>
                                <p className="kx-hero-number text-[56px] leading-[0.95] text-kx-debt sm:text-[72px]">
                                    +{verdict.months} {verdict.months === 1 ? (es ? 'mes' : 'month') : (es ? 'meses' : 'months')}
                                </p>
                                <p className="mt-1 text-[15px] text-kx-ink2">
                                    {es ? 'de deuda' : 'of debt'}
                                    {verdict.interest > 0 && <span data-testid="verdict-interest">{es ? ' y ' : ' and '}<b className="font-semibold text-kx-debt"><MoneyAmount value={verdict.interest} /></b>{es ? ' más de interés' : ' more in interest'}</span>}
                                </p>
                                <p className="mt-3 text-[14px] text-kx-ink">
                                    ≈ +<span className="kx-num">{verdict.days}</span> {es ? 'días' : 'days'}
                                </p>
                                <p className="mt-1 text-[14px] text-kx-ink2">
                                    {es ? 'Tu libertad: ' : 'Your freedom: '}<b className="font-semibold text-kx-ink">{monthYear(verdict.from, es)}</b> → <b className="font-semibold text-kx-debt">{monthYear(verdict.to, es)}</b>
                                </p>
                            </div>
                        )}

                        {verdict.kind === 'absorbed' && (
                            <StatePhrase>
                                {es ? 'Tu plan lo absorbe: $0 días extra.' : 'Your plan absorbs it: $0 extra days.'}
                                {verdict.interest > 0 && <span data-testid="verdict-interest">{es ? ' Pagas ' : ' You pay '}<MoneyAmount value={verdict.interest} />{es ? ' más de interés.' : ' more in interest.'}</span>}
                            </StatePhrase>
                        )}

                        {verdict.kind === 'free' && (
                            <StatePhrase tone="paid">{es ? 'Compra libre: no tienes deudas que retrasar.' : 'Free to buy: you have no debts to delay.'}</StatePhrase>
                        )}

                        {verdict.kind === 'broken' && (
                            <Section tone="debt" title={es ? 'Esta compra rompe tu plan' : 'This purchase breaks your plan'}>
                                <p className="text-[14px] leading-relaxed text-kx-ink">
                                    {es ? 'Con este gasto, tu plan ya no llega a una fecha de libertad medible. Antes de decidir, mira tu ingreso y tus pagos mínimos.'
                                        : 'With this spend, your plan no longer reaches a measurable freedom date. Before deciding, look at your income and minimum payments.'}
                                </p>
                            </Section>
                        )}

                        <p className="text-[15px] font-semibold text-kx-ink" data-testid="verdict-close">{es ? 'Tú decides.' : 'You decide.'}</p>
                        <p className="text-[12px] text-kx-ink3">{es ? 'Cifras estimadas con tus datos actuales.' : 'Figures estimated from your current data.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
