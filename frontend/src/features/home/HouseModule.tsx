/**
 * Inicio → Modo compra de casa: only when the user has a house goal.
 * Amber GoalBar (a savings goal never paints green), "$X de $Y · te faltan $Z", estimated
 * date when there is a saving pace, and the DTI line when income exists.
 * Every figure comes from /api/house-goal and is labelled as an estimate.
 */
import { useQuery } from '@tanstack/react-query';
import { GoalBar, Section } from '@/components/kx';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { apiFetch } from '@/lib/api';

export interface HouseGoal {
    active: boolean; saved?: number; target?: number; pct?: number; missing?: number;
    eta_date?: string | null; dti?: { valor: number | null };
}

export function HouseModule({ es }: { es: boolean }) {
    const { formatMoney } = useFormatMoney();
    const { data } = useQuery({ queryKey: ['house-goal'], queryFn: () => apiFetch<HouseGoal>('/api/house-goal'), staleTime: 60_000 });
    if (!data?.active) return null;
    const pct = (data.pct ?? 0) / 100;
    return (
        <Section tone="neutral" title={es ? 'Modo compra de casa' : 'Home buying mode'}>
            <div data-testid="house-module">
                <p className="text-[14px] text-kx-ink2">
                    <b className="kx-num text-kx-ink">{formatMoney(data.saved ?? 0)}</b> {es ? 'de' : 'of'} <span className="kx-num">{formatMoney(data.target ?? 0)}</span>
                    {(data.missing ?? 0) > 0
                        ? <> · {es ? 'te faltan' : 'missing'} <b className="kx-num text-kx-ink">{formatMoney(data.missing ?? 0)}</b></>
                        : <> · {es ? 'meta alcanzada' : 'goal reached'}</>}
                </p>
                <GoalBar pct={pct * 100} label={es ? 'Progreso de la meta de casa' : 'Home goal progress'} />
                <div className="mt-2 space-y-0.5 text-xs text-kx-ink2">
                    {data.eta_date && (data.missing ?? 0) > 0 && (
                        <p>{es ? 'Fecha estimada: ' : 'Estimated date: '}<span className="kx-num text-kx-ink">{new Date(`${data.eta_date}T12:00:00`).toLocaleDateString(es ? 'es' : 'en', { month: 'long', year: 'numeric' })}</span></p>
                    )}
                    {data.dti?.valor != null && (
                        <p>{es ? 'DTI estimado con la casa: ' : 'Estimated DTI with the home: '}<span className="kx-num text-kx-ink">{data.dti.valor}%</span></p>
                    )}
                    <p>{es ? 'Cifras estimadas; no son una precalificación.' : 'Estimates; not a pre-qualification.'}</p>
                </div>
            </div>
        </Section>
    );
}
