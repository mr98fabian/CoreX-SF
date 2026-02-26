import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { ArrowDown, ArrowUp, TrendingDown } from 'lucide-react';

/**
 * BeforeAfterCard — Shows the user's financial state when they started
 * vs now, creating a powerful emotional contrast for retention.
 */

interface BeforeAfterCardProps {
    /** Total debt when user first joined (stored in localStorage on first visit) */
    originalDebt?: number;
    /** Current total debt */
    currentDebt: number;
}

const STORAGE_KEY = 'korex_starting_debt';

/** Call this on first dashboard load to snapshot starting debt */
export function recordStartingDebt(totalDebt: number): void {
    if (!localStorage.getItem(STORAGE_KEY) && totalDebt > 0) {
        localStorage.setItem(STORAGE_KEY, totalDebt.toString());
    }
}

export function getStartingDebt(): number | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseFloat(raw) : null;
}

export function BeforeAfterCard({ originalDebt, currentDebt }: BeforeAfterCardProps) {
    const { language } = useLanguage();
    const { formatMoney } = useFormatMoney();
    const isEs = language === 'es';

    const startDebt = originalDebt ?? getStartingDebt();

    // Don't show if no baseline or no progress
    if (!startDebt || startDebt <= 0) return null;

    const reduced = startDebt - currentDebt;
    const percentReduced = Math.round((reduced / startDebt) * 100);

    // Don't show if user hasn't made any progress
    if (reduced <= 0) return null;

    return (
        <div className="rounded-xl border border-gray-200 dark:border-neutral-800/50 bg-white/50 dark:bg-zinc-950/30 p-3 overflow-hidden relative">
            {/* Decorative gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-transparent to-emerald-500/5 pointer-events-none" />

            <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                    <TrendingDown size={14} className="text-emerald-400" />
                    <h4 className="text-xs font-bold text-slate-700 dark:text-gray-200">
                        {isEs ? 'Tu Progreso' : 'Your Progress'}
                    </h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {/* BEFORE */}
                    <div className="text-center p-2 rounded-lg bg-rose-500/5 border border-rose-500/10">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-rose-400 mb-1">
                            {isEs ? 'ANTES' : 'BEFORE'}
                        </div>
                        <div className="text-sm font-black text-rose-400 tabular-nums">
                            {formatMoney(startDebt)}
                        </div>
                        <ArrowDown size={10} className="text-rose-400 mx-auto mt-0.5" />
                    </div>

                    {/* AFTER (NOW) */}
                    <div className="text-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                            {isEs ? 'AHORA' : 'NOW'}
                        </div>
                        <div className="text-sm font-black text-emerald-400 tabular-nums">
                            {formatMoney(currentDebt)}
                        </div>
                        <ArrowUp size={10} className="text-emerald-400 mx-auto mt-0.5" />
                    </div>
                </div>

                {/* Bottom Stats */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-neutral-800/30">
                    <span className="text-[10px] text-gray-500">
                        {isEs ? 'Reducido' : 'Reduced'}: <strong className="text-emerald-400">{formatMoney(reduced)}</strong>
                    </span>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: percentReduced > 50 ? '#10b981' : '#f59e0b' }}>
                        -{percentReduced}%
                    </span>
                </div>
            </div>
        </div>
    );
}
