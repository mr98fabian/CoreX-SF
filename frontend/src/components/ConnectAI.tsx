import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Bot, Copy, Check, KeyRound, Link2, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { MCP_REMOTE_URL } from '@/lib/backendUrl';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { AIKit } from '@/components/AIKit';
import { createKitToken, KIT_TOKEN_SCOPES } from '@/lib/aiKit';

/**
 * "Conecta tu IA". Main path: connect by link (the remote MCP + OAuth, from the phone, nothing
 * to copy but the URL). Advanced path, collapsed: personal API tokens for the local MCP
 * (mcp/), unchanged — the plain token comes back exactly once from POST /api/tokens and
 * lives only in this component's state until the user leaves the screen.
 */

const SCOPES: { scope: string; es: string; en: string }[] = [
    { scope: 'read:accounts', es: 'Ver mis cuentas', en: 'See my accounts' },
    { scope: 'read:dashboard', es: 'Ver mi panel y ajustes', en: 'See my dashboard and settings' },
    { scope: 'read:plan', es: 'Ver mi plan de acción', en: 'See my action plan' },
    { scope: 'run:simulations', es: 'Simular compras', en: 'Simulate purchases' },
    { scope: 'write:payments', es: 'Registrar pagos', en: 'Record payments' },
    { scope: 'write:accounts', es: 'Cuentas y metas', en: 'Accounts and goals' },
];
// Defaults = the Kit IA one-tap token (lib/aiKit KIT_TOKEN_SCOPES): read everything + load accounts,
// so PASO 1 (load every account) works. write:payments is NEVER ticked by default.
const DEFAULT_SCOPES = KIT_TOKEN_SCOPES;

interface ApiTokenRow {
    id: number;
    name: string;
    scopes: string[];
    created_at: string;
    last_used_at: string | null;
    active: boolean;
    source?: 'manual' | 'oauth';
}

export function ConnectAI() {
    const { language, t: tr } = useLanguage();
    const es = language === 'es';
    const { isDemo } = useAuth();
    const { toast } = useToast();
    const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
    const [name, setName] = useState('');
    const [scopes, setScopes] = useState<string[]>(DEFAULT_SCOPES);
    const [creating, setCreating] = useState(false);
    const [newToken, setNewToken] = useState<string | null>(null);
    const [copied, setCopied] = useState<'token' | 'url' | null>(null);
    const [showKit, setShowKit] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false); // the token path starts collapsed

    // The lock is the server's answer (GET /api/tokens/access), never decided here
    const [access, setAccess] = useState<{ allowed: boolean; reason: string | null } | null>(null);
    const locked = !access?.allowed;

    const load = () => {
        apiFetch<{ allowed: boolean; reason: string | null }>('/api/tokens/access')
            .then((a) => {
                setAccess(a);
                if (a.allowed) apiFetch<ApiTokenRow[]>('/api/tokens').then(setTokens).catch(() => setTokens([]));
            })
            .catch(() => setAccess({ allowed: false, reason: 'error' }));
    };
    useEffect(load, [isDemo]);

    const toggle = (scope: string) =>
        setScopes((s) => (s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope]));

    // One tap from the kit: new token with the kit's permissions, then the full kit with it
    const createFromKit = async () => {
        setCreating(true);
        try {
            setNewToken(await createKitToken());
            setAdvancedOpen(true);
            load();
        } catch {
            toast({ title: es ? 'No se pudo crear el token' : "Couldn't create the token", variant: 'destructive' });
        } finally {
            setCreating(false);
        }
    };

    const create = async () => {
        setCreating(true);
        try {
            const res = await apiFetch<{ token: string }>('/api/tokens', {
                method: 'POST',
                body: JSON.stringify({ name: name.trim() || 'Mi asistente', scopes }),
            });
            setNewToken(res.token);
            setAdvancedOpen(true);
            setName('');
            load();
        } catch {
            toast({ title: es ? 'No se pudo crear el token' : "Couldn't create the token", variant: 'destructive' });
        } finally {
            setCreating(false);
        }
    };

    const revoke = async (id: number) => {
        if (!window.confirm(es ? '¿Revocar este token? La IA que lo use perderá el acceso al instante.' : 'Revoke this token? Any AI using it loses access immediately.')) return;
        await apiFetch(`/api/tokens/${id}`, { method: 'DELETE' }).catch(() => undefined);
        load();
    };

    const copy = async (text: string, what: 'token' | 'url') => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(what);
            setTimeout(() => setCopied(null), 2000);
        } catch { /* clipboard blocked: the text stays selectable */ }
    };

    const label = (scope: string) => {
        const s = SCOPES.find((x) => x.scope === scope);
        return s ? (es ? s.es : s.en) : scope;
    };
    const active = tokens.filter((t) => t.active);

    return (
        <div className="space-y-6">
            <Card className="border-kx-line bg-kx-surface dark:bg-black/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Bot className="h-5 w-5 text-kx-amber" />
                        {es ? 'Conecta tu IA' : 'Connect your AI'}
                    </CardTitle>
                    <CardDescription>
                        {es
                            ? 'Dale a tu asistente de IA acceso a TU KoreX, solo a tus datos, y quítaselo cuando quieras.'
                            : 'Give your AI assistant access to YOUR KoreX, only your data, and take it back whenever you want.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    {access === null ? (
                        <div className="h-16 animate-pulse rounded-xl bg-kx-surface" aria-busy="true" />
                    ) : locked ? (
                        <div className="space-y-3 border-t border-[var(--kx-line-soft)] pt-4">
                            <p className="flex items-center gap-2 text-sm font-semibold">
                                <Lock className="h-4 w-4 text-kx-amber" />
                                {access.reason === 'demo'
                                    ? (es ? 'El demo es compartido: crea tu cuenta para conectar tu IA.' : 'The demo is shared: create your account to connect your AI.')
                                    : access.reason === 'error'
                                        ? (es ? 'No pudimos comprobar tu plan. Recarga la página.' : "We couldn't check your plan. Reload the page.")
                                        : (es ? 'Conectar tu IA viene con los planes de pago.' : 'Connecting your AI comes with paid plans.')}
                            </p>
                            {access.reason === 'free_plan' && (
                                <Link to="/dashboard/settings/plans" className="inline-block rounded-xl bg-kx-amber px-4 py-2.5 text-sm font-bold text-kx-on-amber">
                                    {es ? 'Ver planes' : 'See plans'}
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Main path: connect by link, from the phone (same 3 steps as /conecta) */}
                            <section data-testid="link-path" className="space-y-4 rounded-xl border border-[color-mix(in_srgb,var(--kx-amber)_30%,transparent)] bg-[color-mix(in_srgb,var(--kx-amber)_5%,transparent)] p-4">
                                <div className="flex items-center gap-2">
                                    <Link2 className="h-4 w-4 text-kx-amber" />
                                    <p className="text-sm font-semibold text-kx-ink">{tr('connect.link.title')}</p>
                                    <Badge variant="outline" className="ml-auto text-[10px]">{tr('connect.link.recommended')}</Badge>
                                </div>
                                <p className="text-sm text-kx-ink2">{tr('connect.link.what')}</p>
                                <ol data-testid="link-steps" className="space-y-2">
                                    {[tr('conecta.step1'), tr('conecta.step2'), tr('conecta.step3')].map((step, i) => (
                                        <li key={i} className="flex items-start gap-2.5 text-sm text-kx-ink">
                                            <span className="kx-num flex h-6 w-6 flex-none items-center justify-center rounded-full bg-kx-amber text-xs font-bold text-kx-on-amber">{i + 1}</span>
                                            <span className="pt-0.5">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                                <div className="flex items-center gap-2">
                                    <code data-testid="link-url" className="min-w-0 flex-1 break-all rounded-lg bg-black/40 px-3 py-2.5 font-mono text-xs text-kx-ink select-all">{MCP_REMOTE_URL}</code>
                                    <Button data-testid="link-copy" variant="premium" className="h-11 flex-none" onClick={() => copy(MCP_REMOTE_URL, 'url')}>
                                        {copied === 'url' ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                                        {copied === 'url' ? tr('conecta.copied') : tr('conecta.copy')}
                                    </Button>
                                </div>
                                <Link to="/conecta" data-testid="link-full" className="inline-block text-sm font-semibold text-kx-amber underline-offset-2 hover:underline">
                                    {tr('connect.link.full')}
                                </Link>
                            </section>

                            {/* Advanced path, collapsed: the token kit for the local MCP, exactly as before */}
                            <details data-testid="advanced-token" open={advancedOpen}
                                onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
                                className="rounded-xl border border-kx-line">
                                <summary className="cursor-pointer select-none px-4 py-3.5 text-sm font-semibold text-kx-ink2">
                                    {tr('connect.advanced.title')}
                                </summary>
                                <div className="border-t border-[var(--kx-line-soft)] p-4">
                    {newToken ? (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-[color-mix(in_srgb,var(--kx-amber)_30%,transparent)] bg-[color-mix(in_srgb,var(--kx-amber)_5%,transparent)] p-4 space-y-3">
                                <p className="text-sm font-semibold text-kx-amber">
                                    {es ? 'Guárdalo ahora: no se vuelve a mostrar.' : "Save it now: it won't be shown again."}
                                </p>
                                <div className="flex gap-2">
                                    <code className="flex-1 break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-kx-ink select-all">{newToken}</code>
                                    <Button size="sm" variant="outline" onClick={() => copy(newToken, 'token')}>
                                        {copied === 'token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            {/* Kit con el token real: solo ahora. El kit con <TU_TOKEN> se ve siempre abajo. */}
                            <AIKit token={newToken} es={es} onceNotice />
                            <Button variant="outline" onClick={() => setNewToken(null)}>
                                {es ? 'Listo, ya lo guardé' : "Done, I've saved it"}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="ai-token-name">{es ? 'Nombre' : 'Name'}</Label>
                                <Input id="ai-token-name" maxLength={60} placeholder={es ? 'Ej. Claude en mi laptop' : 'e.g. Claude on my laptop'}
                                    value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>{es ? 'Qué puede hacer' : 'What it can do'}</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {SCOPES.map((s) => (
                                        <label key={s.scope} className="flex items-center gap-2 rounded-lg border border-kx-line px-3 py-2 text-sm cursor-pointer">
                                            <input type="checkbox" className="accent-kx-amber" checked={scopes.includes(s.scope)} onChange={() => toggle(s.scope)} />
                                            {es ? s.es : s.en}
                                            {s.scope.startsWith('write:') && (
                                                <Badge variant="outline" className="ml-auto text-[10px]">{es ? 'cambia datos' : 'changes data'}</Badge>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <Button variant="premium" onClick={create} disabled={creating || scopes.length === 0}>
                                <KeyRound className="h-4 w-4 mr-1.5" />
                                {es ? 'Crear token' : 'Create token'}
                            </Button>
                            <div className="border-t border-[var(--kx-line-soft)] pt-4">
                                <Button variant="outline" data-testid="kit-toggle" onClick={() => setShowKit((v) => !v)}>
                                    {showKit ? (es ? 'Ocultar el kit para tu IA' : 'Hide the kit for your AI') : (es ? 'Ver el kit para tu IA' : 'See the kit for your AI')}
                                </Button>
                                {showKit && <div className="mt-4"><AIKit es={es} onNewToken={createFromKit} creating={creating} /></div>}
                            </div>
                        </div>
                    )}
                                </div>
                            </details>
                        </div>
                    )}
                </CardContent>
            </Card>

            {!locked && (
                <Card className="border-kx-line bg-kx-surface dark:bg-black/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <ShieldCheck className="h-5 w-5 text-kx-paid" />
                            {es ? 'Tokens activos' : 'Active tokens'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {active.length === 0 && (
                            <p className="text-sm text-muted-foreground">{es ? 'Ninguna IA tiene acceso ahora mismo.' : 'No AI has access right now.'}</p>
                        )}
                        {active.map((t) => (
                            <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-kx-line p-3">
                                <div className="space-y-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {t.name}
                                        {t.source === 'oauth' && <Badge variant="outline" className="ml-2 text-[10px]" data-testid="token-via-link">{tr('oauth.viaLink')}</Badge>}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{t.scopes.map(label).join(' · ')}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {es ? 'Último uso: ' : 'Last used: '}
                                        {t.last_used_at ? new Date(`${t.last_used_at}Z`).toLocaleString(es ? 'es-ES' : 'en-US') : (es ? 'nunca' : 'never')}
                                    </p>
                                </div>
                                <Button size="sm" variant="outline" className="border-[color-mix(in_srgb,var(--kx-debt)_30%,transparent)] text-kx-debt hover:bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] shrink-0" onClick={() => revoke(t.id)}>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    {es ? 'Revocar' : 'Revoke'}
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
