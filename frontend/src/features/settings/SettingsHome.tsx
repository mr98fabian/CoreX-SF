/**
 * Ajustes (Fase 6, approved v8): sober sections — Mi cuenta · Mi plan ·
 * Notificaciones · Seguridad — plus Conecta tu IA with the server's real lock
 * (GET /api/tokens/access). Plan and limits come from the server
 * (/api/subscriptions/status, /api/public/plans). Each row opens the detailed
 * screen one tap away (/dashboard/settings/advanced?section=…).
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ChevronRight, User, Bell, ShieldCheck, CreditCard, LogOut, RefreshCw, Ticket, GraduationCap, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/features/auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiFetch } from '@/lib/api';
import { usePlans } from '@/lib/plans';
import { PAID_KEYS } from '@/lib/pricing';
import { AmberRule, BankHeader, Section } from '@/components/kx';
import { ConnectAI } from '@/components/ConnectAI';
import { FingerprintLockRow } from './FingerprintLockRow';
import { SoundRow } from './SoundRow';
import { CoachBlock } from './CoachBlock';
import { HouseGoalRow } from './HouseGoalRow';
import { ShieldGoalRow } from './ShieldGoalRow';
import { OwnerCodesPanel } from './OwnerCodesPanel';
import { longDate, planLabel, type SubStatus } from '@/lib/planLimits';

type Status = SubStatus;
interface SyncStatus { cadence: { min: number; max: number }; windows: { label: string; time: string }[]; last_sync_at: string | null }

/** Sincronización: cadence + last sync, straight from GET /api/sync/status (never guessed here). */
function SyncRow({ es }: { es: boolean }) {
    const { data, isError } = useQuery({
        queryKey: ['sync-status'],
        queryFn: () => apiFetch<SyncStatus>('/api/sync/status'),
        staleTime: 45_000,
    });
    const times = data?.windows.map((w) => w.time).join(es ? ' y ' : ' and ');
    const cadence = data ? (es ? `De ${data.cadence.min} a ${data.cadence.max} veces al día · ${times}` : `${data.cadence.min} to ${data.cadence.max} times a day · ${times}`) : '';
    const last = data?.last_sync_at
        ? new Date(data.last_sync_at).toLocaleString(es ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : null;
    return (
        <div className="flex items-center gap-3 border-t border-[var(--kx-line-soft)] py-3">
            <span className="flex w-6 flex-none items-center justify-center"><RefreshCw className="h-[18px] w-[18px] text-kx-ink2" strokeWidth={1.75} /></span>
            <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-kx-ink">{es ? 'Sincronización' : 'Sync'}</span>
                <span className="block truncate text-xs text-kx-ink2">
                    {isError ? (es ? 'No se pudo consultar' : 'Could not load') : data ? cadence : (es ? 'Cargando…' : 'Loading…')}
                </span>
            </span>
            {data && <span className="kx-num flex-none text-[13px] text-kx-ink2">{last ?? (es ? 'Aún sin sync' : 'Not yet')}</span>}
        </div>
    );
}

function Row({ to, icon: Icon, title, sub, value }: { to: string; icon: typeof User; title: string; sub?: string; value?: string }) {
    return (
        <Link to={to} className="kx-press flex items-center gap-3 border-t border-[var(--kx-line-soft)] py-3 first:border-t-0 first:pt-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber">
            <span className="flex w-6 flex-none items-center justify-center"><Icon className="h-[18px] w-[18px] text-kx-ink2" strokeWidth={1.75} /></span>
            <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-kx-ink">{title}</span>
                {sub && <span className="block truncate text-xs text-kx-ink2">{sub}</span>}
            </span>
            {value && <span className="kx-num text-[13px] text-kx-ink2">{value}</span>}
            <ChevronRight className="h-[18px] w-[18px] flex-none text-[#475569]" />
        </Link>
    );
}

export default function SettingsHome() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Ajustes' : 'Settings');
    const { user, isDemo, signOut } = useAuth();
    const [status, setStatus] = useState<Status | null>(null);
    const { plans } = usePlans(es);
    const location = useLocation();

    useEffect(() => { apiFetch<Status>('/api/subscriptions/status').then(setStatus).catch(() => setStatus(null)); }, []);
    // Deep links (#casa from Metas, #ia from KoreX con tu IA): SPA navigation doesn't scroll to a hash by itself
    useEffect(() => {
        const id = location.hash.slice(1);
        if (!id) return;
        const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150);
        return () => window.clearTimeout(t);
    }, [location.hash]);

    // Lemon Squeezy returns to /dashboard/settings?tab=subscription&checkout=success (backend
    // redirect_url); the plan-sync + "payment received" logic lives in the advanced screen.
    const returning = new URLSearchParams(location.search).get('checkout') === 'success';

    const plan = plans?.find((p) => p.id === (status?.plan === 'freedom-dev' ? 'freedom' : status?.plan));
    const founder = status?.plan === 'founder';
    const grantText = status?.source === 'demo'
        ? (es ? 'demo: todo abierto para probar · sin IA' : 'demo: everything open to try · no AI')
        : founder
        ? (es ? 'acceso total y permanente · con IA conectada' : 'full, permanent access · AI connected')
        : status?.source === 'grant' && status.grant_ends_at
            ? (es ? `regalado · activo hasta el ${longDate(status.grant_ends_at, true)}` : `gift · active until ${longDate(status.grant_ends_at, false)}`)
            : null;
    // A plan that isn't sold any more (velocity/accelerator) isn't in the public list: say what it
    // is ("Plan pago activo") instead of waiting forever for a card that will never come.
    const fallbackText = status && !plan
        ? (PAID_KEYS.has(status.plan) ? (es ? 'Plan pago activo' : 'Paid plan active') : (es ? `hasta ${status.accounts_limit} deudas · sin IA` : `up to ${status.accounts_limit} debts · no AI`))
        : null;
    const limitText = plan ? (plan.debtLimit == null ? (es ? 'deudas ilimitadas' : 'unlimited debts') : (es ? `hasta ${plan.debtLimit} deudas` : `up to ${plan.debtLimit} debts`)) : '';
    const advanced = (section: string) => `/dashboard/settings/advanced?section=${section}`;

    if (returning) return <Navigate to={`/dashboard/settings/advanced${location.search}`} replace />;

    return (
        <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'Ajustes' : 'Settings'} greeting={user?.user_metadata?.full_name || user?.email || ''} />
                <AmberRule />

                <Section tone="neutral" title={es ? 'Mi cuenta' : 'My account'}>
                    <Row to={advanced('profile')} icon={User} title={es ? 'Perfil' : 'Profile'} sub={user?.email ?? ''} />
                    <Row to={advanced('appearance')} icon={User} title={es ? 'Idioma y apariencia' : 'Language and appearance'} value={es ? 'Español' : 'English'} />
                </Section>

                <Section tone="amber" title={es ? 'Mi plan' : 'My plan'}>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-base font-semibold text-kx-ink">{founder ? planLabel('founder', es) : plan?.name ?? (status ? planLabel(status.plan, es) : '…')}</p>
                            <p className="text-[12.5px] text-kx-ink2">
                                {grantText ?? (plan ? `${limitText} · ${plan.ai ? (es ? 'con IA conectada' : 'AI connected') : (es ? 'sin IA' : 'no AI')}` : (fallbackText ?? (es ? 'Cargando tu plan…' : 'Loading your plan…')))}
                            </p>
                        </div>
                        {!status?.checkout_hidden && <Link to="/dashboard/settings/plans" className="flex-none rounded-xl bg-kx-amber px-3.5 py-2 text-xs font-bold text-kx-on-amber">
                            {plan?.id === 'starter' ? (es ? 'Ver planes' : 'See plans') : (es ? 'Cambiar' : 'Change')}
                        </Link>}
                    </div>
                    {!isDemo && (
                        <Link to={advanced('subscription')} data-testid="redeem-link" className="kx-press mt-3 flex items-center gap-2 text-[13px] font-semibold text-kx-ink2">
                            <Ticket className="h-4 w-4" strokeWidth={1.75} />{es ? '¿Tienes un código? Canjéalo' : 'Have a code? Redeem it'}
                        </Link>
                    )}
                    {plan && plan.id !== 'starter' && status?.source === 'subscription' && (
                        <Link to={advanced('subscription')} className="mt-3 block text-[13px] font-semibold text-kx-amber">
                            {es ? 'Facturación y cancelación ›' : 'Billing and cancellation ›'}
                        </Link>
                    )}
                </Section>

                <Section tone="neutral" title={es ? 'Aprende' : 'Learn'}>
                    {/* Reopens the onboarding wizard (DashboardLayout listens: useOnboarding.restart) */}
                    <button type="button" data-testid="replay-tutorial" onClick={() => window.dispatchEvent(new Event('korex:restart-onboarding'))}
                        className="kx-press flex w-full items-center gap-3 pb-3 text-left">
                        <span className="flex w-6 flex-none items-center justify-center"><GraduationCap className="h-[18px] w-[18px] text-kx-ink2" strokeWidth={1.75} /></span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-[14.5px] font-semibold text-kx-ink">{es ? 'Ver el tutorial' : 'Watch the tutorial'}</span>
                            <span className="block truncate text-xs text-kx-ink2">{es ? 'El corte, el $0 y dónde está cada cosa' : 'The cut, the $0 and where everything lives'}</span>
                        </span>
                        <ChevronRight className="h-[18px] w-[18px] flex-none text-kx-ink3" />
                    </button>
                    <Row to="/dashboard/settings/ia" icon={Sparkles} title={es ? 'KoreX con tu IA' : 'KoreX with your AI'} sub={es ? 'El tutorial del Pack IA' : 'The AI Pack tutorial'} />
                </Section>

                <Section tone="neutral" title={es ? 'Notificaciones' : 'Notifications'}>
                    <Row to={advanced('notifications')} icon={Bell} title={es ? 'Avisos de cortes y pagos' : 'Cut and payment alerts'} sub={es ? 'Elige qué te avisamos' : 'Choose what we tell you'} />
                </Section>

                <Section tone="neutral" title={es ? 'Seguridad' : 'Security'}>
                    <div className="flex items-center gap-3 pb-3">
                        <span className="flex w-6 flex-none items-center justify-center"><ShieldCheck className="h-[18px] w-[18px] text-kx-paid" strokeWidth={1.75} /></span>
                        <span>
                            <span className="block text-[14.5px] font-semibold text-kx-ink">{es ? 'Conexión segura · Sesión protegida' : 'Secure connection · Protected session'}</span>
                            <span className="block text-xs text-kx-ink2">{es ? 'Tus datos solo los ves tú (y tu IA, si la conectas).' : 'Only you see your data (and your AI, if you connect it).'}</span>
                        </span>
                    </div>
                    <FingerprintLockRow es={es} />
                    <SoundRow es={es} />
                    <SyncRow es={es} />
                    <Row to={advanced('data')} icon={CreditCard} title={es ? 'Mis datos' : 'My data'} sub={es ? 'Exportar o reiniciar' : 'Export or reset'} />
                    <button onClick={() => signOut()} className="kx-press mt-1 flex w-full items-center gap-3 border-t border-[var(--kx-line-soft)] pt-3 text-left text-[14.5px] font-semibold text-kx-debt">
                        <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />{es ? 'Cerrar sesión' : 'Sign out'}
                    </button>
                </Section>

                <CoachBlock es={es} />
                <ShieldGoalRow es={es} />
                <HouseGoalRow es={es} />

                {/* Conecta tu IA — locked or open per the server (GET /api/tokens/access) */}
                <div id="ia"><ConnectAI /></div>
                <OwnerCodesPanel es={es} />
                {isDemo && <p className="text-center text-xs text-kx-ink3">{es ? 'Estás en el demo: los cambios se reinician al salir.' : "You're in the demo: changes reset when you leave."}</p>}
            </div>
        </div>
    );
}
