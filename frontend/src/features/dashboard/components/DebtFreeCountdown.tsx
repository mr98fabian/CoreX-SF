import { useLanguage } from '@/contexts/LanguageContext';
import { TrendingDown, CalendarClock } from 'lucide-react';

/**
 * DebtFreeCountdown — Shows estimated months until debt-free
 * based on velocity projections. Creates urgency + hope.
 */

interface DebtFreeCountdownProps {
    /** The projected debt-free date string (ISO format) */
    debtFreeDate?: string | null;
    /** Total remaining debt */
    totalDebt?: number;
}

export function DebtFreeCountdown({ debtFreeDate, totalDebt }: DebtFreeCountdownProps) {
    const { language } = useLanguage();

    if (!debtFreeDate || !totalDebt || totalDebt <= 0) return null;

    const target = new Date(debtFreeDate);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();

    // Already debt-free or date is in the past
    if (diffMs <= 0) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                <TrendingDown size={14} />
                {language === 'es' ? '🎉 ¡YA ERES LIBRE DE DEUDAS!' : '🎉 YOU ARE DEBT-FREE!'}
            </div>
        );
    }

    const totalDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(totalDays / 30);
    const remainingDays = totalDays % 30;

    const isEs = language === 'es';
    const timeLabel = months > 0
        ? `${months} ${isEs ? 'meses' : 'months'}${remainingDays > 0 ? ` ${remainingDays} ${isEs ? 'días' : 'days'}` : ''}`
        : `${remainingDays} ${isEs ? 'días' : 'days'}`;

    return (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-secondary/50 border border-border text-xs">
            <CalendarClock size={14} className="text-emerald-400 shrink-0" />
            <span className="text-gray-400">
                {isEs ? 'A este ritmo, serás libre en' : 'At this pace, free in'}{' '}
                <span className="font-extrabold text-emerald-400">{timeLabel}</span>
            </span>
        </div>
    );
}
