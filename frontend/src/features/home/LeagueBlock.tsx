/**
 * Inicio → TU LIGA: compact, only when the user opted into ranking. Daily
 * streak, week points and position in the cohort. Points come from habits
 * (check-in, payments recorded, $0 cuts) — never from amounts.
 */
import { useQuery } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { Section } from '@/components/kx';
import { apiFetch } from '@/lib/api';

export interface Ranking {
    opt_in: boolean; week_points: number; streak_days: number;
    tier_label?: string; position?: number; cohort_size?: number;
}

export function LeagueBlock({ es }: { es: boolean }) {
    const { data } = useQuery({ queryKey: ['ranking'], queryFn: () => apiFetch<Ranking>('/api/ranking'), staleTime: 60_000 });
    if (!data?.opt_in) return null;
    return (
        <Section tone="neutral" title={es ? `Tu liga · ${data.tier_label}` : `Your league · ${data.tier_label}`}>
            <div data-testid="league-block" className="flex items-center justify-between gap-3 text-[13px] text-kx-ink2">
                <span className="flex items-center gap-1.5"><Flame className="h-4 w-4 text-kx-amber" strokeWidth={1.75} />
                    <b className="kx-num text-kx-ink">{data.streak_days}</b> {es ? (data.streak_days === 1 ? 'día' : 'días') : (data.streak_days === 1 ? 'day' : 'days')}</span>
                <span><b className="kx-num text-kx-ink">{data.week_points}</b> {es ? 'pts esta semana' : 'pts this week'}</span>
                <span>#<b className="kx-num text-kx-ink">{data.position}</b> {es ? `de ${data.cohort_size}` : `of ${data.cohort_size}`}</span>
            </div>
        </Section>
    );
}
