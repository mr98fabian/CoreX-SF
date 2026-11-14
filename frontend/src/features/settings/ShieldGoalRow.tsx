/**
 * Ajustes → Escudo de paz: the cash KoreX never attacks with. Shows the current goal
 * (GET /api/peace-shield) and saves a new one with PUT /api/user/me/shield {target}.
 * Until now this value was only set in step 5 of the welcome wizard.
 * Saving refreshes the screens that read it (Inicio, mission, chart, calendar).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { Section } from '@/components/kx';
import { MoneyAmount } from '@/components/MoneyAmount';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';
import { KX_SUMMARY_KEY } from '@/hooks/useKxSummary';
import { COMPARE_KEY } from '@/hooks/useVelocityCompare';
import { CALENDAR_KEY } from '@/lib/calendarEvents';

interface ShieldStatus { shield_target: number; current_fill: number; fill_percentage: number }
const SHIELD_KEY = ['peace-shield'];

export function ShieldGoalRow({ es }: { es: boolean }) {
    const qc = useQueryClient();
    const { toast } = useToast();
    const { data } = useQuery({ queryKey: SHIELD_KEY, queryFn: () => apiFetch<ShieldStatus>('/api/peace-shield'), staleTime: 60_000 });
    const [draft, setDraft] = useState<string | null>(null);
    const value = draft ?? (data ? String(data.shield_target) : '');
    const parsed = value.trim() === '' ? NaN : Number(value);
    const valid = Number.isFinite(parsed) && parsed >= 0;
    const changed = data != null && valid && parsed !== data.shield_target;

    const save = useMutation({
        mutationFn: (target: number) => apiFetch<{ ok: boolean }>('/api/user/me/shield', { method: 'PUT', body: JSON.stringify({ target }) }),
        onSuccess: async () => {
            setDraft(null);
            await Promise.all([SHIELD_KEY, [KX_SUMMARY_KEY], [COMPARE_KEY], [CALENDAR_KEY]].map((queryKey) => qc.invalidateQueries({ queryKey })));
            toast({ title: es ? 'Escudo de paz guardado' : 'Peace shield saved' });
        },
        onError: () => toast({ title: es ? 'No se pudo guardar el escudo' : "Couldn't save the shield", variant: 'destructive' }),
    });

    return (
        <Section tone="neutral" title={es ? 'Escudo de paz' : 'Peace shield'}>
            <div data-testid="shield-goal-row" id="escudo">
                <label className="flex items-center gap-3">
                    <span className="flex w-6 flex-none items-center justify-center"><Shield className="h-[18px] w-[18px] text-kx-ink2" strokeWidth={1.75} /></span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold text-kx-ink">{es ? 'Meta del escudo' : 'Shield goal'}</span>
                        <span className="block text-xs text-kx-ink2">{es ? 'El efectivo que KoreX nunca usa para atacar deudas' : 'The cash KoreX never uses to attack debt'}</span>
                    </span>
                    <input inputMode="decimal" type="number" min={0} step="1" value={value} aria-label={es ? 'Meta del escudo' : 'Shield goal'}
                        disabled={!data || save.isPending} placeholder="$" data-testid="shield-goal-input"
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && changed) save.mutate(parsed); }}
                        className="kx-num w-32 rounded-lg border border-kx-line bg-kx-bg px-3 py-1.5 text-right text-[14px] text-kx-ink outline-none focus:border-kx-amber" />
                </label>
                {data && (
                    <p className="mt-2 pl-9 text-xs text-kx-ink2" data-testid="shield-goal-fill">
                        {es ? 'Hoy tienes ' : 'Today you have '}<MoneyAmount value={data.current_fill} />{es ? ' de ' : ' of '}<MoneyAmount value={data.shield_target} />
                        {` · ${Math.round(data.fill_percentage)}%`}
                    </p>
                )}
                {draft !== null && !valid && (
                    <p className="mt-2 pl-9 text-xs text-kx-debt" data-testid="shield-goal-error">{es ? 'Escribe un monto de $0 o más' : 'Enter an amount of $0 or more'}</p>
                )}
                <div className="mt-3 flex justify-end">
                    <button type="button" data-testid="shield-goal-save" disabled={!changed || save.isPending} onClick={() => save.mutate(parsed)}
                        className="kx-press rounded-xl bg-kx-amber px-4 py-2 text-[13px] font-bold text-kx-on-amber disabled:opacity-50">
                        {save.isPending ? (es ? 'Guardando…' : 'Saving…') : (es ? 'Guardar' : 'Save')}
                    </button>
                </div>
            </div>
        </Section>
    );
}
