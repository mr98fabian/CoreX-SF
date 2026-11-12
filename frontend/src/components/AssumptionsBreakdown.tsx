import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MoneyAmount } from '@/components/MoneyAmount';
import { useLanguage } from '@/contexts/LanguageContext';

/** Mirrors the "assumptions" block returned by backend get_projections(). */
export interface ProjectionAssumptions {
    /** Omitted for the public landing calculator, which takes a direct $ surplus instead of a % of liquid cash. */
    attack_percentage?: number;
    liquid_cash_used?: number;
    extra_monthly_payment: number;
    /** Active subscriptions per month, already subtracted from the surplus (server figure). */
    subscriptions_monthly?: number;
    /** true when subscriptions take the whole surplus */
    subscriptions_eat_surplus?: boolean;
    note?: string;
}

interface ExtraRow {
    label: string;
    value: number;
}

interface AssumptionsBreakdownProps {
    assumptions: ProjectionAssumptions;
    /** Additional labeled dollar figures downstream of the same assumptions (e.g. interest saved). */
    extraRows?: ExtraRow[];
    className?: string;
}

/**
 * AssumptionsBreakdown — collapsed-by-default "where does this number come
 * from" panel. Every projection in KoreX (debt-free date, interest saved)
 * is downstream of a single user-editable assumption (% of liquid cash
 * attacked monthly, see PUT /api/user/me/attack-percentage). This makes
 * that assumption visible instead of a hidden constant — see
 * .claude/skills/brand-design-system for the progressive-disclosure rule
 * this follows (simple by default, detail on demand).
 */
export function AssumptionsBreakdown({ assumptions, extraRows, className }: AssumptionsBreakdownProps) {
    const [open, setOpen] = useState(false);
    const { language } = useLanguage();
    const isEs = language === 'es';

    return (
        <div className={cn('text-left', className)}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
                <Info size={12} />
                {isEs ? '¿De dónde sale este número?' : 'Where does this number come from?'}
                <ChevronDown size={12} className={cn('transition-transform duration-200', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-secondary/40 p-3 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                    {assumptions.attack_percentage !== undefined && (
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{isEs ? '% de tu efectivo líquido atacado / mes' : '% of your liquid cash attacked / mo'}</span>
                            <span className="font-mono font-semibold tabular-nums">{assumptions.attack_percentage}%</span>
                        </div>
                    )}
                    {assumptions.liquid_cash_used !== undefined && (
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{isEs ? 'Efectivo líquido usado' : 'Liquid cash used'}</span>
                            <MoneyAmount value={assumptions.liquid_cash_used} className="font-semibold" />
                        </div>
                    )}
                    {(assumptions.subscriptions_monthly ?? 0) > 0 && (
                        <div className="flex items-center justify-between gap-3" data-testid="assumption-subs">
                            <span className="text-muted-foreground">{isEs ? 'Suscripciones / mes (ya restadas)' : 'Subscriptions / mo (already subtracted)'}</span>
                            <MoneyAmount value={assumptions.subscriptions_monthly!} className="font-semibold" />
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">{isEs ? 'Pago extra mensual resultante' : 'Resulting extra monthly payment'}</span>
                        <MoneyAmount value={assumptions.extra_monthly_payment} className="font-semibold text-emerald-500" />
                    </div>
                    {extraRows?.map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">{row.label}</span>
                            <MoneyAmount value={row.value} className="font-semibold text-emerald-500" />
                        </div>
                    ))}
                    {assumptions.note && (
                        <p className="pt-1.5 mt-1.5 border-t border-border text-[10px] text-muted-foreground italic leading-relaxed">
                            {assumptions.note}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
