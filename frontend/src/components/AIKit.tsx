/**
 * Kit para tu IA: two copy blocks (configuration · instructions for your AI).
 * With a real token (Conecta tu IA, right after creating it) or with <TU_TOKEN> (tutorial).
 */
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { AI_INSTRUCTIONS, kitConfig } from '@/lib/aiKit';

export function AIKit({ token, es, onceNotice = false }: { token?: string; es: boolean; onceNotice?: boolean }) {
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
                    {es ? 'Este kit solo se muestra ahora, igual que tu token. Guárdalo.' : 'This kit is shown only now, like your token. Save it.'}
                </p>
            )}
            {block('config', es ? '1 · Configuración' : '1 · Configuration',
                token ? (es ? 'Ya lleva tu token. Cambia <RUTA_DEL_MCP> por la carpeta mcp de KoreX en tu equipo.' : 'Your token is already in it. Replace <RUTA_DEL_MCP> with the KoreX mcp folder on your computer.')
                    : (es ? 'Cambia <TU_TOKEN> por tu token kx_ y <RUTA_DEL_MCP> por la carpeta mcp de KoreX.' : 'Replace <TU_TOKEN> with your kx_ token and <RUTA_DEL_MCP> with the KoreX mcp folder.'),
                config)}
            {block('instructions', es ? '2 · Instrucciones para tu IA' : '2 · Instructions for your AI',
                es ? 'Pégalas como instrucciones del proyecto o primer mensaje a tu asistente.' : 'Paste them as project instructions or as the first message to your assistant.',
                AI_INSTRUCTIONS)}
        </div>
    );
}
