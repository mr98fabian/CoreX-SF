import { useFormatMoney } from '@/hooks/useFormatMoney';
import { cn } from '@/lib/utils';

interface MoneyAmountProps {
    /** Numeric value in the account currency */
    value: number;
    /** Additional CSS classes (color, size, weight) */
    className?: string;
    /** Prefix an explicit +/− sign derived from the value */
    signed?: boolean;
}

/**
 * MoneyAmount — universal, locale-aware currency display.
 * Every monetary figure should render through this (or AnimatedCurrency)
 * so all amounts share font-mono + tabular-nums digit alignment.
 * (Fase 2 · MD-3 — Tipografía numérica consistente)
 */
export function MoneyAmount({ value, className, signed = false }: MoneyAmountProps) {
    const { formatMoney } = useFormatMoney();

    if (signed) {
        const sign = value > 0 ? '+' : value < 0 ? '−' : '';
        return (
            <span className={cn('font-mono tabular-nums tracking-tight', className)}>
                {sign}{formatMoney(Math.abs(value))}
            </span>
        );
    }

    return (
        <span className={cn('font-mono tabular-nums tracking-tight', className)}>
            {formatMoney(value)}
        </span>
    );
}
