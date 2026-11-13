/**
 * Owner-only access-code panel. Rendered ONLY when GET /api/admin/codes answers 200
 * (the server decides via OWNER_USER_ID); on 403 or any error nothing is painted.
 * A new code's plain text is shown once, here, and never fetched again.
 */
import { useCallback, useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Section } from '@/components/kx';

export interface AdminCode {
    id: number; prefix: string; kind: 'founder' | 'months'; months: number | null; plan: string;
    max_uses: number; uses_count: number; status: 'active' | 'revoked' | 'expired' | 'used';
}

const STATUS_ES: Record<AdminCode['status'], string> = { active: 'activo', revoked: 'revocado', expired: 'caducado', used: 'agotado' };

export function OwnerCodesPanel({ es }: { es: boolean }) {
    const [codes, setCodes] = useState<AdminCode[] | null>(null);
    const [kind, setKind] = useState<'founder' | 'months'>('founder');
    const [months, setMonths] = useState(3);
    const [uses, setUses] = useState(1);
    const [custom, setCustom] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [fresh, setFresh] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        apiFetch<AdminCode[]>('/api/admin/codes').then(setCodes).catch(() => setCodes(null));
    }, []);
    useEffect(load, [load]);

    if (!codes) return null;

    const create = async () => {
        setBusy(true);
        setError(null);
        try {
            const out = await apiFetch<AdminCode & { code: string }>('/api/admin/codes', {
                method: 'POST',
                body: JSON.stringify({ kind, months: kind === 'months' ? months : null, max_uses: uses, custom_code: custom.trim() || null }),
            });
            setFresh(out.code);
            setCopied(false);
            setCustom('');
            load();
        } catch (e) {
            const status = (e as { status?: number }).status;
            if (status === 409) setError(es ? 'Ese código ya existe.' : 'That code already exists.');
            else if (status === 422) setError(es ? 'Personalizado: 8 a 40 letras o números.' : 'Custom: 8 to 40 letters or digits.');
            else if (status === 503) setError(es ? 'Códigos desactivados: falta ACCESS_CODE_HMAC_KEY en el servidor.' : 'Codes disabled: ACCESS_CODE_HMAC_KEY is missing on the server.');
            else setError(es ? 'No se pudo crear el código. Inténtalo de nuevo.' : "Couldn't create the code. Try again.");
        }
        setBusy(false);
    };

    const revoke = async (id: number) => {
        try { await apiFetch(`/api/admin/codes/${id}/revoke`, { method: 'POST' }); load(); } catch { /* quiet */ }
    };

    const copy = async () => {
        if (!fresh) return;
        try { await navigator.clipboard.writeText(fresh); setCopied(true); } catch { /* select by hand */ }
    };

    const field = 'rounded-lg border border-[var(--kx-line-soft)] bg-transparent px-2 py-1.5 text-[13px] text-kx-ink';

    return (
        <div data-testid="owner-codes">
            <Section tone="neutral" title={es ? 'Códigos de acceso (solo tú)' : 'Access codes (owner only)'}>
                <div className="flex flex-wrap items-center gap-2">
                    <select aria-label={es ? 'Tipo' : 'Kind'} value={kind} onChange={(e) => setKind(e.target.value as 'founder' | 'months')} className={field}>
                        <option value="founder">{es ? 'Fundador' : 'Founder'}</option>
                        <option value="months">{es ? 'Meses gratis' : 'Free months'}</option>
                    </select>
                    {kind === 'months' && (
                        <select aria-label={es ? 'Meses' : 'Months'} value={months} onChange={(e) => setMonths(Number(e.target.value))} className={field}>
                            {[3, 6, 12].map((m) => <option key={m} value={m}>{m} {es ? 'meses' : 'months'}</option>)}
                        </select>
                    )}
                    <label className="flex items-center gap-1 text-[12.5px] text-kx-ink2">
                        {es ? 'Usos' : 'Uses'}
                        <input type="number" min={1} max={100} value={uses} onChange={(e) => setUses(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className={`${field} w-16`} />
                    </label>
                    <input aria-label={es ? 'Código personalizado' : 'Custom code'} value={custom} onChange={(e) => setCustom(e.target.value)}
                        placeholder={es ? 'Personalizado (opcional)' : 'Custom (optional)'} maxLength={60} className={`${field} w-48`} />
                    <button type="button" onClick={create} disabled={busy} className="kx-press rounded-lg bg-kx-amber px-3 py-1.5 text-xs font-bold text-kx-on-amber disabled:opacity-60">
                        {es ? 'Crear código' : 'Create code'}
                    </button>
                </div>

                {error && <p data-testid="code-error" className="mt-2 text-[12px] text-kx-debt">{error}</p>}

                {fresh && (
                    <div data-testid="fresh-code" className="mt-3 rounded-xl border border-kx-amber/40 p-3">
                        <p className="text-[12px] text-kx-ink2">{es ? 'Cópialo ahora: no se vuelve a mostrar.' : "Copy it now: it won't be shown again."}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                            <code className="kx-num flex-1 select-all text-[15px] text-kx-ink">{fresh}</code>
                            <button type="button" onClick={copy} aria-label={es ? 'Copiar' : 'Copy'} className="kx-press p-1 text-kx-ink2">
                                {copied ? <Check className="h-4 w-4 text-kx-paid" strokeWidth={1.75} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
                            </button>
                        </div>
                        <button type="button" onClick={() => setFresh(null)} className="mt-2 text-[12px] font-semibold text-kx-ink2">{es ? 'Ya lo guardé' : 'Saved it'}</button>
                    </div>
                )}

                <ul className="mt-3 space-y-0">
                    {codes.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 border-t border-[var(--kx-line-soft)] py-2 text-[13px]">
                            <span className="kx-num text-kx-ink">{c.prefix}…</span>
                            <span className="flex-1 text-kx-ink2">
                                {c.kind === 'founder' ? (es ? 'Fundador' : 'Founder') : `${c.months} ${es ? 'meses' : 'months'}`} · {c.uses_count}/{c.max_uses} · {es ? STATUS_ES[c.status] : c.status}
                            </span>
                            {c.status === 'active' && (
                                <button type="button" onClick={() => revoke(c.id)} className="kx-press text-[12px] font-semibold text-kx-debt">{es ? 'Revocar' : 'Revoke'}</button>
                            )}
                        </li>
                    ))}
                </ul>
            </Section>
        </div>
    );
}
