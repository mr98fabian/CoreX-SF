/**
 * Ajustes → Compra de casa: goal, home price, saved so far and monthly pace.
 * Ledger rows; saves the whole goal with PUT /api/house-goal.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Home } from 'lucide-react';
import { Section } from '@/components/kx';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';

interface Goal { active: boolean; target?: number; home_price?: number; saved?: number; monthly_saving?: number | null; down_pct?: number; closing_pct?: number }
type Field = 'target_total' | 'home_price' | 'saved_amount' | 'monthly_saving';
const KEY = ['house-goal'];

export function HouseGoalRow({ es }: { es: boolean }) {
    const qc = useQueryClient();
    const { toast } = useToast();
    const { data } = useQuery({ queryKey: KEY, queryFn: () => apiFetch<Goal>('/api/house-goal'), staleTime: 60_000 });
    const [draft, setDraft] = useState<Partial<Record<Field, string>>>({});
    const saved: Record<Field, number | null | undefined> = {
        target_total: data?.target, home_price: data?.home_price, saved_amount: data?.saved, monthly_saving: data?.monthly_saving,
    };
    const value = (f: Field) => draft[f] ?? (saved[f] != null ? String(saved[f]) : '');

    const save = useMutation({
        mutationFn: (body: Record<string, number | null>) => apiFetch<Goal>('/api/house-goal', { method: 'PUT', body: JSON.stringify(body) }),
        onSuccess: (g) => { qc.setQueryData(KEY, g); setDraft({}); },
        onError: () => toast({ title: es ? 'Revisa los montos: no pueden ser negativos' : 'Check the amounts: they cannot be negative', variant: 'destructive' }),
    });
    const commit = () => {
        const num = (f: Field) => { const v = value(f).trim(); return v === '' ? null : Number(v); };
        const target = num('target_total'), price = num('home_price');
        if (!target || !price) return; // goal and price are required; wait until both exist
        const changed = (Object.keys(draft) as Field[]).some((f) => num(f) !== (saved[f] ?? null));
        if (!changed) return;
        save.mutate({ target_total: target, home_price: price, saved_amount: num('saved_amount') ?? 0,
            monthly_saving: num('monthly_saving'), down_pct: data?.down_pct ?? 3.5, closing_pct: data?.closing_pct ?? 3 });
    };
    const rows: [Field, string, string][] = [
        ['target_total', es ? 'Meta total' : 'Total goal', es ? 'Inicial + cierre + reserva' : 'Down + closing + reserve'],
        ['home_price', es ? 'Precio de la casa' : 'Home price', es ? 'Aproximado' : 'Approximate'],
        ['saved_amount', es ? 'Ahorrado' : 'Saved', es ? 'Lo que ya tienes para la casa' : 'What you already have'],
        ['monthly_saving', es ? 'Ritmo mensual' : 'Monthly pace', es ? 'Opcional: da la fecha estimada' : 'Optional: gives the estimated date'],
    ];

    return (
        <Section tone="neutral" title={es ? 'Compra de casa' : 'Home buying'}>
            <div data-testid="house-goal-row">
                {rows.map(([f, label, hint], i) => (
                    <label key={f} className={`flex items-center gap-3 ${i ? 'border-t border-[var(--kx-line-soft)] pt-3 mt-3' : ''}`}>
                        <span className="flex w-6 flex-none items-center justify-center">{i === 0 && <Home className="h-[18px] w-[18px] text-kx-ink2" strokeWidth={1.75} />}</span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-[14.5px] font-semibold text-kx-ink">{label}</span>
                            <span className="block text-xs text-kx-ink2">{hint}</span>
                        </span>
                        <input inputMode="decimal" type="number" min={0} step="0.01" value={value(f)} aria-label={label}
                            disabled={!data || save.isPending} placeholder="$"
                            onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))} onBlur={commit}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            className="kx-num w-32 rounded-lg border border-kx-line bg-kx-bg px-3 py-1.5 text-right text-[14px] text-kx-ink outline-none focus:border-kx-amber" />
                    </label>
                ))}
            </div>
        </Section>
    );
}
