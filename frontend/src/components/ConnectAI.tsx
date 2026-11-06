import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Bot, Copy, Check, KeyRound, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/features/auth/AuthContext';
import { useToast } from '@/components/ui/use-toast';

/**
 * "Conecta tu IA" — personal API tokens for an AI assistant (MCP server in mcp/).
 * The plain token comes back exactly once from POST /api/tokens and lives only
 * in this component's state until the user leaves the screen.
 */

const SCOPES: { scope: string; es: string; en: string }[] = [
    { scope: 'read:accounts', es: 'Ver mis cuentas', en: 'See my accounts' },
    { scope: 'read:dashboard', es: 'Ver mi panel y ajustes', en: 'See my dashboard and settings' },
    { scope: 'read:plan', es: 'Ver mi plan de acción', en: 'See my action plan' },
    { scope: 'run:simulations', es: 'Simular compras', en: 'Simulate purchases' },
    { scope: 'write:payments', es: 'Registrar pagos', en: 'Record payments' },
    { scope: 'write:accounts', es: 'Agregar cuentas', en: 'Add accounts' },
];
const READ_ONLY = ['read:accounts', 'read:dashboard', 'read:plan', 'run:simulations'];

interface ApiTokenRow {
    id: number;
    name: string;
    scopes: string[];
    created_at: string;
    last_used_at: string | null;
    active: boolean;
}

function mcpConfig(token: string) {
    return JSON.stringify({
        mcpServers: {
            korex: {
                command: '/RUTA/A/KoreX/mcp/.venv/bin/python',
                args: ['/RUTA/A/KoreX/mcp/korex_mcp.py'],
                env: { KOREX_API_TOKEN: token },
            },
        },
    }, null, 2);
}

export function ConnectAI() {
    const { language } = useLanguage();
    const es = language === 'es';
    const { isDemo } = useAuth();
    const { toast } = useToast();
    const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
    const [name, setName] = useState('');
    const [scopes, setScopes] = useState<string[]>(READ_ONLY);
    const [creating, setCreating] = useState(false);
    const [newToken, setNewToken] = useState<string | null>(null);
    const [copied, setCopied] = useState<'token' | 'config' | null>(null);

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

    const create = async () => {
        setCreating(true);
        try {
            const res = await apiFetch<{ token: string }>('/api/tokens', {
                method: 'POST',
                body: JSON.stringify({ name: name.trim() || 'Mi asistente', scopes }),
            });
            setNewToken(res.token);
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

    const copy = async (text: string, what: 'token' | 'config') => {
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
            <Card className="border-gray-200 dark:border-white/5 bg-white dark:bg-black/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Bot className="h-5 w-5 text-amber-500" />
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
                        <div className="h-16 animate-pulse rounded-xl bg-white/5" aria-busy="true" />
                    ) : locked ? (
                        <div className="space-y-3 border-t border-[var(--kx-line-soft)] pt-4">
                            <p className="flex items-center gap-2 text-sm font-semibold">
                                <Lock className="h-4 w-4 text-amber-500" />
                                {access.reason === 'demo'
                                    ? (es ? 'El demo es compartido: crea tu cuenta para conectar tu IA.' : 'The demo is shared: create your account to connect your AI.')
                                    : access.reason === 'error'
                                        ? (es ? 'No pudimos comprobar tu plan. Recarga la página.' : "We couldn't check your plan. Reload the page.")
                                        : (es ? 'Conectar tu IA viene con los planes de pago.' : 'Connecting your AI comes with paid plans.')}
                            </p>
                            {access.reason === 'free_plan' && (
                                <Link to="/dashboard/settings/plans" className="inline-block rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#111418]">
                                    {es ? 'Ver planes' : 'See plans'}
                                </Link>
                            )}
                        </div>
                    ) : newToken ? (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                                <p className="text-sm font-semibold text-amber-500">
                                    {es ? 'Guárdalo ahora: no se vuelve a mostrar.' : "Save it now: it won't be shown again."}
                                </p>
                                <div className="flex gap-2">
                                    <code className="flex-1 break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs text-slate-100 select-all">{newToken}</code>
                                    <Button size="sm" variant="outline" onClick={() => copy(newToken, 'token')}>
                                        {copied === 'token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">
                                        {es ? 'Configuración para Claude Desktop (cambia /RUTA/A/ por tu carpeta)' : 'Claude Desktop config (replace /RUTA/A/ with your folder)'}
                                    </p>
                                    <Button size="sm" variant="ghost" onClick={() => copy(mcpConfig(newToken), 'config')}>
                                        {copied === 'config' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <pre className="overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-slate-100">{mcpConfig(newToken)}</pre>
                            </div>
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
                                        <label key={s.scope} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/10 px-3 py-2 text-sm cursor-pointer">
                                            <input type="checkbox" className="accent-amber-500" checked={scopes.includes(s.scope)} onChange={() => toggle(s.scope)} />
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
                        </div>
                    )}
                </CardContent>
            </Card>

            {!locked && (
                <Card className="border-gray-200 dark:border-white/5 bg-white dark:bg-black/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <ShieldCheck className="h-5 w-5 text-emerald-500" />
                            {es ? 'Tokens activos' : 'Active tokens'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {active.length === 0 && (
                            <p className="text-sm text-muted-foreground">{es ? 'Ninguna IA tiene acceso ahora mismo.' : 'No AI has access right now.'}</p>
                        )}
                        {active.map((t) => (
                            <div key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 dark:border-white/10 p-3">
                                <div className="space-y-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{t.name}</p>
                                    <p className="text-xs text-muted-foreground">{t.scopes.map(label).join(' · ')}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {es ? 'Último uso: ' : 'Last used: '}
                                        {t.last_used_at ? new Date(`${t.last_used_at}Z`).toLocaleString(es ? 'es-ES' : 'en-US') : (es ? 'nunca' : 'never')}
                                    </p>
                                </div>
                                <Button size="sm" variant="outline" className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 shrink-0" onClick={() => revoke(t.id)}>
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
