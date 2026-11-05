/**
 * Plan cards (approved v8 "Planes"): annual highlighted by default, Velocity
 * recommended, limits from the server (lib/plans), prices from the billing
 * config. Used in Ajustes "Mi plan" and on the landing.
 */
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { usePlans, type PlanId, type PlanView } from '@/lib/plans';

interface Props {
    currentPlan?: string;
    onChoose: (plan: PlanId, cycle: 'monthly' | 'annual') => void;
    busy?: string | null;
    ctaLabel?: (p: PlanView) => string;
}

export function PlanCards({ currentPlan, onChoose, busy, ctaLabel }: Props) {
    const { language } = useLanguage();
    const es = language === 'es';
    const { formatMoney } = useFormatMoney();
    const { plans, error } = usePlans();
    const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');

    if (error) return <p className="text-sm text-kx-ink2">{es ? 'No pudimos cargar los planes. Recarga la página.' : "We couldn't load the plans. Reload the page."}</p>;
    if (!plans) return <div className="h-64 animate-pulse rounded-[20px] bg-kx-surface" aria-busy="true" />;

    const debts = (p: PlanView) => p.debtLimit == null
        ? (es ? 'Deudas ilimitadas' : 'Unlimited debts')
        : (es ? `Hasta ${p.debtLimit} deudas` : `Up to ${p.debtLimit} debts`);

    return (
        <div className="space-y-4">
            <div className="mx-auto flex w-fit rounded-full border border-kx-line bg-kx-surface p-1" role="tablist">
                {(['annual', 'monthly'] as const).map((c) => (
                    <button key={c} role="tab" aria-selected={cycle === c} onClick={() => setCycle(c)}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold ${cycle === c ? 'bg-kx-amber text-[#111418]' : 'text-kx-ink2'}`}>
                        {c === 'annual' ? (es ? 'Anual · 2 meses gratis' : 'Annual · 2 months free') : (es ? 'Mensual' : 'Monthly')}
                    </button>
                ))}
            </div>

            {plans.map((p) => {
                const hot = p.id === 'velocity';
                const isCurrent = currentPlan === p.id || (p.id === 'starter' && (!currentPlan || currentPlan === 'starter'));
                const price = p.monthly === 0 ? formatMoney(0) : cycle === 'annual' ? formatMoney(p.annual) : formatMoney(p.monthly);
                return (
                    <div key={p.id} className={`relative overflow-hidden rounded-[20px] border p-[18px] ${hot ? 'border-[rgba(245,158,11,.55)] bg-[rgba(245,158,11,.06)]' : 'border-kx-line bg-kx-surface'}`}>
                        {hot && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[5px]" style={{ background: 'linear-gradient(90deg,#B45309,#F59E0B,#FBBF24)' }} />}
                        {hot && <span className="absolute right-4 top-3.5 rounded-full bg-kx-amber px-2.5 py-1 text-[10px] font-bold tracking-[.08em] text-[#111418]">{es ? 'RECOMENDADO' : 'RECOMMENDED'}</span>}
                        <div className="flex items-baseline justify-between gap-3 pr-24">
                            <p className={`text-xs font-bold uppercase tracking-[.16em] ${hot ? 'text-kx-amber-soft' : 'text-kx-ink2'}`}>{p.name}</p>
                        </div>
                        <p className="kx-num mt-1 text-[26px] font-light text-kx-ink">
                            {price}
                            {p.monthly > 0 && <small className="ml-1 text-xs font-normal text-kx-ink2">{cycle === 'annual' ? (es ? '/año' : '/yr') : (es ? '/mes' : '/mo')}</small>}
                        </p>
                        {p.monthly > 0 && cycle === 'annual' && (
                            <p className="text-xs text-kx-ink2">{es ? `o ${formatMoney(p.monthly)}/mes` : `or ${formatMoney(p.monthly)}/mo`}</p>
                        )}
                        <ul className="mt-3 space-y-1.5 text-[13.5px] text-kx-ink2">
                            <li className="flex gap-2"><span className="font-bold text-kx-paid">✓</span>{debts(p)}</li>
                            <li className="flex gap-2"><span className="font-bold text-kx-paid">✓</span>{es ? 'Calendario de deuda mes a mes' : 'Month-by-month debt calendar'}</li>
                            <li className="flex gap-2">{p.ai ? <span className="font-bold text-kx-paid">✓</span> : <span className="font-bold text-[#475569]">✕</span>}
                                {p.ai ? (es ? 'Tu IA conectada' : 'Your AI connected') : (es ? 'Sin IA conectada' : 'No AI connection')}</li>
                            {p.prioritySupport && <li className="flex gap-2"><span className="font-bold text-kx-paid">✓</span>{es ? 'Soporte prioritario' : 'Priority support'}</li>}
                        </ul>
                        {p.monthly > 0 && (
                            <button onClick={() => onChoose(p.id, cycle)} disabled={isCurrent || busy === p.id}
                                className={`mt-3.5 block w-full rounded-xl py-3 text-center text-sm font-bold disabled:opacity-50 ${hot ? 'bg-kx-amber text-[#111418]' : 'border border-kx-line text-kx-ink'}`}>
                                {isCurrent ? (es ? 'Tu plan actual' : 'Your current plan') : ctaLabel ? ctaLabel(p) : (es ? `Elegir ${p.name}` : `Choose ${p.name}`)}
                            </button>
                        )}
                    </div>
                );
            })}
            <p className="text-center text-xs text-kx-ink3">{es ? 'Cancela cuando quieras. Precios en USD.' : 'Cancel anytime. Prices in USD.'}</p>
        </div>
    );
}
