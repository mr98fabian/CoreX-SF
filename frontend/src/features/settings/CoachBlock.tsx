/**
 * Ajustes → Tu coach IA: how the user's own AI (connected by MCP) speaks to
 * them. Tone + the name they gave it, stored in /api/coach-profile and read by
 * the AI through korex_coach_profile. Ledger rows, continuous language.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Section } from '@/components/kx';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/lib/api';

export type Tone = 'calido' | 'directo' | 'pesado';
export interface CoachProfile { tone: Tone; tone_label: string; ai_name: string | null; payday_weekday: number | null }

const TONES: { v: Tone; es: string; en: string }[] = [
    { v: 'calido', es: 'Cálido', en: 'Warm' },
    { v: 'directo', es: 'Directo', en: 'Direct' },
    { v: 'pesado', es: 'Modo pesado', en: 'Tough mode' },
];
const KEY = ['coach-profile'];

export function CoachBlock({ es }: { es: boolean }) {
    const qc = useQueryClient();
    const { toast } = useToast();
    const { data } = useQuery({ queryKey: KEY, queryFn: () => apiFetch<CoachProfile>('/api/coach-profile'), staleTime: 45_000 });
    // Draft only while typing; otherwise the field shows the saved name
    const [draft, setDraft] = useState<string | null>(null);
    const name = draft ?? data?.ai_name ?? '';

    const save = useMutation({
        mutationFn: (body: Partial<Pick<CoachProfile, 'tone' | 'ai_name'>>) =>
            apiFetch<CoachProfile>('/api/coach-profile', { method: 'PATCH', body: JSON.stringify(body) }),
        onSuccess: (p) => qc.setQueryData(KEY, p),
        onError: () => toast({ title: es ? 'No se pudo guardar' : 'Could not save', variant: 'destructive' }),
    });
    const saveName = () => {
        const v = name.trim();
        setDraft(null);
        if (v !== (data?.ai_name ?? '')) save.mutate({ ai_name: v || null });
    };

    return (
        <Section tone="neutral" title={es ? 'Tu coach IA' : 'Your AI coach'}>
            <div data-testid="coach-block">
                <div className="flex items-start gap-3 pb-3">
                    <span className="flex w-6 flex-none items-center justify-center pt-0.5"><MessageCircle className="h-[18px] w-[18px] text-kx-ink2" strokeWidth={1.75} /></span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold text-kx-ink">{es ? 'Tono' : 'Tone'}</span>
                        <span className="block text-xs text-kx-ink2">{es ? 'Cómo te habla tu IA. Las cifras siempre salen de KoreX.' : 'How your AI talks to you. Figures always come from KoreX.'}</span>
                        <span className="mt-2.5 flex flex-wrap gap-2" role="radiogroup" aria-label={es ? 'Tono de tu coach' : 'Coach tone'}>
                            {TONES.map((t) => (
                                <button key={t.v} role="radio" aria-checked={data?.tone === t.v} disabled={!data || save.isPending}
                                    onClick={() => save.mutate({ tone: t.v })}
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${data?.tone === t.v ? 'border-kx-amber text-kx-amber' : 'border-kx-line text-kx-ink2'}`}>
                                    {es ? t.es : t.en}
                                </button>
                            ))}
                        </span>
                    </span>
                </div>
                <label className="flex items-center gap-3 border-t border-[var(--kx-line-soft)] pt-3">
                    <span className="flex w-6 flex-none items-center justify-center"><Sparkles className="h-[18px] w-[18px] text-kx-ink2" strokeWidth={1.75} /></span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-semibold text-kx-ink">{es ? 'Nombre de tu IA' : "Your AI's name"}</span>
                        <span className="block text-xs text-kx-ink2">{es ? 'Se presentará con este nombre.' : 'It will introduce itself with this name.'}</span>
                    </span>
                    <input value={name} maxLength={40} disabled={!data} placeholder={es ? 'Sin nombre' : 'No name'}
                        onChange={(e) => setDraft(e.target.value)} onBlur={saveName}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        aria-label={es ? 'Nombre de tu IA' : "Your AI's name"}
                        className="w-32 rounded-lg border border-kx-line bg-kx-bg px-3 py-1.5 text-right text-[14px] text-kx-ink outline-none focus:border-kx-amber" />
                </label>
            </div>
        </Section>
    );
}
