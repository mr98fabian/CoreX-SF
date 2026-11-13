/**
 * Kit para tu IA: PASO 1 (first actions of the assistant) + two copy blocks (configuration ·
 * instructions). With a real token (right after creating it) or with <TU_TOKEN> — the kit itself
 * is always viewable; only the raw token is shown once (it is stored hashed).
 */
import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { AI_INSTRUCTIONS, FIRST_ACTIONS, kitConfig } from '@/lib/aiKit';

interface Props {
    token?: string;
    es: boolean;
    /** Right after creating a token: the token is shown only now, the kit stays available. */
    onceNotice?: boolean;
    /** Placeholder mode: one tap creates a new token and shows the full kit with it. */
    onNewToken?: () => void;
    creating?: boolean;
}

export function AIKit({ token, es, onceNotice = false, onNewToken, creating = false }: Props) {
    const [copied, setCopied] = useState<'config' | 'instructions' | null>(null);
    const config = kitConfig(token);
    const copy = async (text: string, what: 'config' | 'instructions') => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(what);
            setTimeout(() => setCopied(null), 2000);
        } catch { /* clipboard blocked: the text stays selectable */ }
    };
    const block = (what: 'config' | 'instructions', title: string, hint: string, text: string) => (
        <div className="space-y-2" data-testid={`kit-${what}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-kx-ink">{title}</p>
                    <p className="text-xs text-kx-ink2">{hint}</p>
                </div>
                <button type="button" data-testid={`copy-${what}`} onClick={() => copy(text, what)}
                    className="kx-press flex flex-none items-center gap-1.5 rounded-lg border border-kx-line px-3 py-1.5 text-xs font-semibold text-kx-ink">
                    {copied === what ? <><Check className="h-3.5 w-3.5 text-kx-amber" />{es ? 'Copiado' : 'Copied'}</> : <><Copy className="h-3.5 w-3.5" />{es ? 'Copiar' : 'Copy'}</>}
                </button>
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-kx-line bg-kx-bg p-3 font-mono text-[11.5px] leading-relaxed text-kx-ink">{text}</pre>
        </div>
    );
    return (
        <div data-testid="ai-kit" className="space-y-4 rounded-xl border border-kx-line bg-kx-surface p-4">
            <p className="kx-label text-kx-amber">{es ? 'Kit para tu IA' : 'Kit for your AI'}</p>
            {onceNotice && (
                <p data-testid="kit-once" className="text-sm font-semibold text-kx-ink">
                    {es ? 'Tu token solo se muestra ahora: guárdalo. El kit lo vuelves a ver cuando quieras en Ajustes → Conecta tu IA o en la Guía IA; si pierdes el token, crea uno nuevo ahí.'
                        : 'Your token is shown only now: save it. You can see the kit again anytime in Settings → Connect your AI or the AI Guide; if you lose the token, create a new one there.'}
                </p>
            )}

            <div data-testid="kit-first-actions" className="space-y-2">
                <div>
                    <p className="text-sm font-semibold text-kx-ink">{es ? '1 · Primeras acciones de tu asistente' : '1 · Your assistant’s first actions'}</p>
                    <p className="text-xs text-kx-ink2">{es ? 'Lo primero que hará tu IA si tu KoreX aún no tiene cuentas. Ya va dentro de las instrucciones.' : 'The first thing your AI does if your KoreX has no accounts yet. It is already inside the instructions.'}</p>
                </div>
                <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-kx-ink2">
                    {FIRST_ACTIONS.map((a) => <li key={a.slice(0, 24)}>{a.replace(/ \(`add_account`[^)]*\)/, '')}</li>)}
                </ol>
            </div>

            {block('config', es ? '2 · Configuración' : '2 · Configuration',
                token ? (es ? 'Ya lleva tu token. Cambia <RUTA_DEL_MCP> por la carpeta mcp de KoreX en tu equipo.' : 'Your token is already in it. Replace <RUTA_DEL_MCP> with the KoreX mcp folder on your computer.')
                    : (es ? 'Cambia <TU_TOKEN> por tu token kx_ y <RUTA_DEL_MCP> por la carpeta mcp de KoreX.' : 'Replace <TU_TOKEN> with your kx_ token and <RUTA_DEL_MCP> with the KoreX mcp folder.'),
                config)}
            {!token && onNewToken && (
                <div data-testid="kit-new-token" className="space-y-1.5 rounded-lg border border-dashed border-kx-line p-3">
                    <p className="text-xs text-kx-ink2">
                        {es ? 'Tu token no se vuelve a mostrar: KoreX no guarda una copia legible. ¿No lo tienes? Crea uno nuevo y el kit sale completo, con el token ya puesto. Permisos: ver todo y cargar cuentas; no registra pagos.'
                            : 'Your token is never shown again: KoreX keeps no readable copy. Lost it? Create a new one and the kit comes complete, token included. Permissions: see everything and load accounts; it does not record payments.'}
                    </p>
                    <button type="button" data-testid="kit-new-token-btn" onClick={onNewToken} disabled={creating}
                        className="kx-press inline-flex items-center gap-1.5 rounded-lg bg-kx-amber px-3 py-2 text-xs font-bold text-kx-on-amber disabled:opacity-60">
                        <KeyRound className="h-3.5 w-3.5" />
                        {es ? 'Crear un token nuevo y ver el kit completo' : 'Create a new token and see the full kit'}
                    </button>
                </div>
            )}
            {block('instructions', es ? '3 · Instrucciones para tu IA' : '3 · Instructions for your AI',
                es ? 'Pégalas como instrucciones del proyecto o primer mensaje a tu asistente.' : 'Paste them as project instructions or as the first message to your assistant.',
                AI_INSTRUCTIONS)}
        </div>
    );
}
