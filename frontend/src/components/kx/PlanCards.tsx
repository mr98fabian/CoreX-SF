/**
 * Two plan cards: Gratis and KoreX Anual (the hero). Limits from the server (lib/plans),
 * names and prices from lib/pricing.ts. Used on the landing, Ajustes › Planes and the
 * legacy settings subscription tab.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { usePlans, type PlanId, type PlanView } from '@/lib/plans';
import { PAID_KEYS } from '@/lib/pricing';

interface Props {
    currentPlan?: string;
    onChoose: (plan: PlanId) => void;
    busy?: string | null;
    ctaLabel?: (p: PlanView) => string;
    /** Android build (Google Play): Play's localized price and trial instead of the USD figures */
    store?: { price: string; trialLine: string | null; footer: string };
}

export function PlanCards({ currentPlan, onChoose, busy, ctaLabel, store }: Props) {
    const { language } = useLanguage();
    const es = language === 'es';
    const { formatMoney } = useFormatMoney();
    const { plans, error } = usePlans(es);

    if (error) return <p className="text-sm text-kx-ink2">{es ? 'No pudimos cargar los planes. Recarga la página.' : "We couldn't load the plans. Reload the page."}</p>;
    if (!plans) return <div className="h-64 kx-shimmer rounded-[20px]" aria-busy="true" />;

    const paying = !!currentPlan && PAID_KEYS.has(currentPlan);
    const tick = <span className="font-bold text-kx-paid">✓</span>;
    const cross = <span className="font-bold text-kx-ink3">✕</span>;

    return (
        <div className="space-y-4">
            {plans.map((p) => {
                const hero = p.annual > 0;
                const isCurrent = hero ? paying : !paying;
                return (
                    <div key={p.id} data-testid={`plan-${p.id}`}
                        className={`relative rounded-[20px] border bg-kx-surface p-[18px] ${hero ? 'kx-elev-1 border-[rgba(245,158,11,.55)]' : 'border-kx-line'}`}>
                        <p className={`text-xs font-bold uppercase tracking-[.16em] ${hero ? 'text-kx-amber-soft' : 'text-kx-ink2'}`}>{p.name}</p>
                        <p className={`kx-num mt-1 font-light text-kx-ink ${hero ? 'text-[34px]' : 'text-[26px]'}`}>
                            {hero && store ? store.price : formatMoney(p.annual)}
                            {hero && <small className="ml-1 text-xs font-normal text-kx-ink2">{es ? '/año' : '/yr'}</small>}
                        </p>
                        {hero && store && store.trialLine && <p className="text-[13px] text-kx-ink">{store.trialLine}</p>}
                        {hero && !store && p.trialDays > 0 && (
                            <p className="text-[13px] text-kx-ink">{es ? `1 mes gratis, luego ${formatMoney(p.annual)}/año` : `1 month free, then ${formatMoney(p.annual)}/yr`}</p>
                        )}
                        <ul className="mt-3 space-y-1.5 text-[13.5px] text-kx-ink2">
                            <li className="flex gap-2">{tick}{p.debtLimit == null ? (es ? 'Deudas ilimitadas' : 'Unlimited debts') : (es ? `Hasta ${p.debtLimit} deudas` : `Up to ${p.debtLimit} debts`)}</li>
                            <li className="flex gap-2">{tick}{es ? 'Calendario de deuda mes a mes' : 'Month-by-month debt calendar'}</li>
                            <li className="flex gap-2">{p.ai ? tick : cross}{p.ai ? (es ? 'Tu IA conectada' : 'Your AI connected') : (es ? 'Sin IA conectada' : 'No AI connection')}</li>
                            {hero && <li className="flex gap-2">{tick}{es ? 'Todo ilimitado' : 'Everything unlimited'}</li>}
                        </ul>
                        {hero && (
                            <button onClick={() => onChoose(p.id)} disabled={isCurrent || busy === p.id}
                                className="kx-press mt-3.5 block w-full rounded-xl bg-kx-amber py-3 text-center text-sm font-bold text-kx-on-amber disabled:opacity-50">
                                {isCurrent ? (es ? 'Tu plan actual' : 'Your current plan') : ctaLabel ? ctaLabel(p) : (es ? 'Empezar mes gratis' : 'Start free month')}
                            </button>
                        )}
                        {!hero && isCurrent && <p className="mt-3 text-center text-xs text-kx-ink3">{es ? 'Tu plan actual' : 'Your current plan'}</p>}
                    </div>
                );
            })}
            <p className="text-center text-xs text-kx-ink3">{store ? store.footer : (es ? 'Cancela durante el mes gratis y no se cobra nada. Precios en USD.' : 'Cancel during the free month and nothing is charged. Prices in USD.')}</p>
        </div>
    );
}
