/**
 * Cuentas → "Tu crédito": available credit, total limit, used and global
 * utilization of the user's credit cards. Every figure comes from
 * /api/accounts/credit-panel (math in velocity_engine.credit_panel); this
 * file only paints. The usage bar is thin and labelled "Uso" so it never
 * reads as a stage bar (scale: ≤10 low · ≤30 mid · >30 high).
 */
import { Section } from '@/components/kx';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import type { CreditPanelData, UsageBand } from '@/hooks/useCreditPanel';

const BAND_BAR: Record<UsageBand, string> = {
    low: 'bg-[var(--kx-paid-bar)]', mid: 'bg-[var(--kx-almost-bar)]', high: 'bg-[var(--kx-debt-bar)]',
};

export function UsageBar({ pct, band, es }: { pct: number; band: UsageBand; es: boolean }) {
    const width = Math.max(0, Math.min(pct, 100)); // over 100% fills, never overflows
    return (
        <span data-testid="usage-bar" data-band={band} className="mt-1.5 flex items-center gap-2">
            <span className="text-[11px] text-kx-ink2">{es ? 'Uso' : 'Usage'}</span>
            <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-kx-raised">
                <span className={`block h-full rounded-full ${BAND_BAR[band]}`} style={{ width: `${width}%` }} />
            </span>
            <span className="kx-num shrink-0 text-[11px] text-kx-ink">{pct}%</span>
        </span>
    );
}

export function CreditPanel({ es, data }: { es: boolean; data: CreditPanelData | undefined }) {
    const { formatMoney } = useFormatMoney();
    if (!data?.active) return null;
    return (
        <Section tone="neutral" title={es ? 'Tu crédito' : 'Your credit'}>
            <div data-testid="credit-panel">
                <p className="text-xs text-kx-ink2">{es ? 'Crédito disponible (estimado)' : 'Available credit (estimate)'}</p>
                <p className="kx-num text-[28px] font-semibold leading-tight text-kx-ink">{formatMoney(data.disponible)}</p>
                <p className="mt-1 text-xs text-kx-ink2">
                    {es ? 'Límite total' : 'Total limit'} <span className="kx-num text-kx-ink">{formatMoney(data.limite_total)}</span>
                    {' · '}{es ? 'usado' : 'used'} <span className="kx-num text-kx-ink">{formatMoney(data.usado)}</span>
                    {' · '}{es ? 'utilización' : 'utilization'} <span className="kx-num text-kx-ink">{data.utilizacion_global}%</span>
                </p>
                {data.utilizacion_global != null && data.banda_global && <UsageBar pct={data.utilizacion_global} band={data.banda_global} es={es} />}
                <p className="mt-2 text-[11px] text-kx-ink3">{es ? data.nota : 'Estimated current utilization; the bureau sees the balance your card reports, usually the statement one.'}</p>
            </div>
        </Section>
    );
}
