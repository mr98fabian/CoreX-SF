/**
 * Ajustes (Fase 6, approved v8): sober sections — Mi cuenta · Mi plan ·
 * Notificaciones · Seguridad — plus Conecta tu IA with the server's real lock
 * (GET /api/tokens/access). Plan and limits come from the server
 * (/api/subscriptions/status, /api/public/plans). Each row opens the detailed
 * screen one tap away (/dashboard/settings/advanced?section=…).
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ChevronRight, User, Bell, ShieldCheck, CreditCard, LogOut } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/features/auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiFetch } from '@/lib/api';
import { usePlans } from '@/lib/plans';
import { AmberRule, BankHeader, Section } from '@/components/kx';
import { ConnectAI } from '@/components/ConnectAI';

interface Status { plan: string; status: string; current_period_end: string | null }

function Row({ to, icon: Icon, title, sub, value }: { to: string; icon: typeof User; title: string; sub?: string; value?: string }) {
    return (
        <Link to={to} className="flex items-center gap-3 border-t border-[var(--kx-line-soft)] py-3 first:border-t-0 first:pt-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] bg-kx-raised"><Icon className="h-[18px] w-[18px] text-kx-ink2" strokeWidth={1.75} /></span>
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
    const { plans } = usePlans();
    const location = useLocation();

    useEffect(() => { apiFetch<Status>('/api/subscriptions/status').then(setStatus).catch(() => setStatus(null)); }, []);

    // Lemon Squeezy returns to /dashboard/settings?tab=subscription&checkout=success (backend
    // redirect_url); the plan-sync + "payment received" logic lives in the advanced screen.
    const returning = new URLSearchParams(location.search).get('checkout') === 'success';

    const plan = plans?.find((p) => p.id === (status?.plan === 'freedom-dev' ? 'freedom' : status?.plan));
    const limitText = plan ? (plan.debtLimit == null ? (es ? 'deudas ilimitadas' : 'unlimited debts') : (es ? `hasta ${plan.debtLimit} deudas` : `up to ${plan.debtLimit} debts`)) : '';
    const advanced = (section: string) => `/dashboard/settings/advanced?section=${section}`;

    if (returning) return <Navigate to={`/dashboard/settings/advanced${location.search}`} replace />;

    return (
        <div className="kx-scope -m-4 min-h-full pb-28 md:-m-8 lg:pb-10">
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
                            <p className="text-base font-semibold text-kx-ink">{plan?.name ?? (status ? status.plan : '…')}</p>
                            <p className="text-[12.5px] text-kx-ink2">
                                {plan ? `${limitText} · ${plan.ai ? (es ? 'con IA conectada' : 'AI connected') : (es ? 'sin IA' : 'no AI')}` : (es ? 'Cargando tu plan…' : 'Loading your plan…')}
                            </p>
                        </div>
                        <Link to="/dashboard/settings/plans" className="flex-none rounded-xl bg-kx-amber px-3.5 py-2 text-xs font-bold text-[#111418]">
                            {plan?.id === 'starter' ? (es ? 'Ver planes' : 'See plans') : (es ? 'Cambiar' : 'Change')}
                        </Link>
                    </div>
                    {plan && plan.id !== 'starter' && (
                        <Link to={advanced('subscription')} className="mt-3 block text-[13px] font-semibold text-kx-amber">
                            {es ? 'Facturación y cancelación ›' : 'Billing and cancellation ›'}
                        </Link>
                    )}
                </Section>

                <Section tone="neutral" title={es ? 'Notificaciones' : 'Notifications'}>
                    <Row to={advanced('notifications')} icon={Bell} title={es ? 'Avisos de cortes y pagos' : 'Cut and payment alerts'} sub={es ? 'Elige qué te avisamos' : 'Choose what we tell you'} />
                </Section>

                <Section tone="neutral" title={es ? 'Seguridad' : 'Security'}>
                    <div className="flex items-center gap-3 pb-3">
                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] bg-kx-raised"><ShieldCheck className="h-[18px] w-[18px] text-kx-paid" strokeWidth={1.75} /></span>
                        <span>
                            <span className="block text-[14.5px] font-semibold text-kx-ink">{es ? 'Conexión segura · Sesión protegida' : 'Secure connection · Protected session'}</span>
                            <span className="block text-xs text-kx-ink2">{es ? 'Tus datos solo los ves tú (y tu IA, si la conectas).' : 'Only you see your data (and your AI, if you connect it).'}</span>
                        </span>
                    </div>
                    <Row to={advanced('data')} icon={CreditCard} title={es ? 'Mis datos' : 'My data'} sub={es ? 'Exportar o reiniciar' : 'Export or reset'} />
                    <button onClick={() => signOut()} className="mt-1 flex w-full items-center gap-3 border-t border-[var(--kx-line-soft)] pt-3 text-left text-[14.5px] font-semibold text-kx-debt">
                        <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />{es ? 'Cerrar sesión' : 'Sign out'}
                    </button>
                </Section>

                {/* Conecta tu IA — locked or open per the server (GET /api/tokens/access) */}
                <div id="ia"><ConnectAI /></div>
                {isDemo && <p className="text-center text-xs text-kx-ink3">{es ? 'Estás en el demo: los cambios se reinician al salir.' : "You're in the demo: changes reset when you leave."}</p>}
            </div>
        </div>
    );
}
