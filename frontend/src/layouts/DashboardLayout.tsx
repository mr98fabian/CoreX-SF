import { useState, useEffect } from 'react';
import { LogOut, PanelLeft, Sun, Moon, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Outlet, useLocation } from 'react-router-dom';
import { AppLock } from '@/components/AppLock';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import FeedbackWidget from '@/components/FeedbackWidget';
import { syncPlanFromBackend } from '@/lib/planLimits';
import { apiFetch } from '@/lib/api';
import { SideNav, TabBar } from '@/components/kx';
import UpgradeNudge from '@/components/UpgradeNudge';
import InstallPrompt from '@/components/InstallPrompt';
import OfflineIndicator from '@/components/OfflineIndicator';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { useCelebration } from '@/hooks/useCelebration';
import { CommanderBadge } from '@/components/CommanderBadge';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchSections, whenIdle } from '@/lib/prefetchRoutes';

export default function DashboardLayout() {
    const isMobile = useIsMobile();
    const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
    const location = useLocation();
    const { user, signOut } = useAuth();
    const { t, language } = useLanguage();
    const { isDark, toggleTheme } = useTheme();
    const onboarding = useOnboarding();
    const { celebrate } = useCelebration();

    // Sync subscription plan from backend on every layout mount
    // Ensures all pages (Dashboard, Settings, etc.) always have fresh plan data
    useEffect(() => {
        syncPlanFromBackend();
        // Daily check-in (habit points). Idempotent server-side; the local key only saves a request.
        const today = new Date().toLocaleDateString('en-CA');
        let seen: string | null = null;
        try { seen = localStorage.getItem('kx-checkin'); } catch { /* storage blocked */ }
        if (seen !== today) {
            apiFetch('/api/engagement/checkin', { method: 'POST' })
                .then(() => { try { localStorage.setItem('kx-checkin', today); } catch { /* ignore */ } })
                .catch(() => { /* offline: retried on next open */ });
        }
    }, []);

    // Shell owns the viewport while mounted (see .kx-app-shell in kx.css)
    useEffect(() => {
        document.documentElement.classList.add('kx-app-shell');
        return () => document.documentElement.classList.remove('kx-app-shell');
    }, []);

    // Warm the bottom-bar sections (chunks + cached data) once the app is idle
    const queryClient = useQueryClient();
    const userId = user?.id;
    useEffect(() => {
        if (!userId) return;
        return whenIdle(() => prefetchSections(queryClient, userId));
    }, [queryClient, userId]);

    // Listen for onboarding restart requests (Ajustes → "Ver el tutorial")
    // so the wizard state stays in this hook instance
    useEffect(() => {
        const handler = () => { void onboarding.restart(); };
        window.addEventListener('korex:restart-onboarding', handler);
        return () => window.removeEventListener('korex:restart-onboarding', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onboarding.restart]);

    // Sidebar sync without effects (avoids cascading renders):
    // viewport class change → open on desktop, close on mobile;
    // route change on mobile → auto-close.
    const [prevNav, setPrevNav] = useState({ path: location.pathname, mobile: isMobile });
    if (prevNav.mobile !== isMobile) {
        setPrevNav({ path: location.pathname, mobile: isMobile });
        setIsSidebarOpen(!isMobile);
    } else if (prevNav.path !== location.pathname) {
        setPrevNav({ path: location.pathname, mobile: isMobile });
        if (isMobile) setIsSidebarOpen(false);
    }

    const sidebarContent = (
        <>
            <div className="flex h-16 items-center justify-between px-6 border-b border-kx-line ">
                <div className="flex items-center gap-2 group cursor-default">
                    <img
                        src="/korex-logotipo.svg"
                        alt="KoreX"
                        className="h-12 transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                    />
                </div>
                {/* Close button — mobile only */}
                {isMobile && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-kx-ink2 hover:text-kx-ink"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <X size={20} />
                    </Button>
                )}
            </div>

            <SideNav onNavigate={() => isMobile && setIsSidebarOpen(false)} />

            <div className="border-t border-kx-line p-4 space-y-3">
                {user && (
                    <div className="flex items-center gap-3 px-2">
                        {user.user_metadata?.avatar_url ? (
                            <img
                                src={user.user_metadata.avatar_url}
                                alt="Avatar"
                                className="h-8 w-8 rounded-full ring-2 ring-kx-line "
                            />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kx-raised text-xs font-bold text-[#111418] ring-2 ring-kx-line ">
                                {(user.email?.[0] || 'U').toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-[#111418] ">
                                {user.user_metadata?.full_name || 'User'}
                            </p>
                            <p className="truncate text-[10px] text-kx-ink2 ">
                                {user.email}
                            </p>
                        </div>
                    </div>
                )}
                {/* Commander Rank compact badge in sidebar */}
                <div className="px-2">
                    <CommanderBadge isPaid={(localStorage.getItem('korex-plan') || 'starter') !== 'starter'} compact />
                </div>
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-kx-debt hover:text-kx-debt hover:bg-kx-debt "
                    onClick={() => signOut()}
                >
                    <LogOut size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">{t("nav.signOut")}</span>
                </Button>
            </div>
        </>
    );

    return (
        <div className="kx-scope flex h-[100dvh] w-full overflow-x-clip">

            {/* ═══ MOBILE: Backdrop overlay (covers entire screen) ═══ */}
            {isMobile && isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40"
                    style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* ═══ MOBILE: Drawer sidebar (fixed, full-height, slides in/out) ═══ */}
            {isMobile && (
                <aside
                    className="fixed inset-y-0 left-0 z-50 flex flex-col border-r border-kx-line transition-transform duration-300 ease-in-out"
                    style={{
                        paddingTop: 'var(--kx-safe-top)',
                        paddingBottom: 'var(--kx-safe-bottom)',
                        width: '85vw',
                        maxWidth: '320px',
                        backgroundColor: isDark ? 'rgb(2 6 23 / 0.98)' : 'rgb(255 255 255 / 0.98)',
                        transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
                    }}
                >
                    {sidebarContent}
                </aside>
            )}

            {/* ═══ DESKTOP: Normal sidebar (pushes content) ═══ */}
            {!isMobile && (
                <aside
                    className={cn(
                        "flex flex-col border-r transition-all duration-300 ease-in-out relative overflow-hidden z-20",
                        "bg-kx-surface border-kx-line dark:bg-[#020617] ",
                        isSidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full opacity-0 border-none"
                    )}
                >
                    {sidebarContent}
                </aside>
            )}

            {/* MAIN AREA */}
            <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-transparent relative">
                {/* TOP BAR / HEADER */}
                <header data-testid="app-header" className="flex items-center gap-4 border-b px-4 sticky top-0 z-10 bg-kx-surface border-kx-line dark:bg-[#020617] "
                    style={{ paddingTop: 'var(--kx-safe-top)', height: 'calc(3.5rem + var(--kx-safe-top))' }}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="text-kx-ink3 hover:text-[#111418] hover:bg-kx-raised "
                    >
                        {isMobile ? (
                            <Menu size={20} strokeWidth={1.5} />
                        ) : (
                            <PanelLeft size={20} strokeWidth={1.5} className={cn("transition-transform", !isSidebarOpen && "rotate-180")} />
                        )}
                    </Button>
                    <div className="flex-1" />
                    {/* Theme Toggle Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleTheme}
                        className="text-kx-ink3 hover:text-[#111418] hover:bg-kx-raised "
                        title={isDark
                            ? (language === 'es' ? 'Cambiar a Modo Claro' : 'Switch to Light Mode')
                            : (language === 'es' ? 'Cambiar a Modo Oscuro' : 'Switch to Dark Mode')}
                    >
                        {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
                    </Button>
                </header>

                {/* SCROLLABLE CONTENT */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 scroll-smooth relative z-0" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', touchAction: 'pan-y pinch-zoom' }}>
                    <div key={location.pathname} className="kx-page mx-auto max-w-7xl">
                        <Outlet />
                    </div>
                    <AppLock />
                </div>
                {/* In the flow, last child of the column: always on the shell's bottom edge */}
                <TabBar />
            </main>
            <FeedbackWidget />
            <UpgradeNudge suppressed={onboarding.isLoading || !onboarding.hasCompleted} />
            <InstallPrompt />
            <OfflineIndicator />
            <SessionTimeoutWarning />

            {/* ═══ ONBOARDING WIZARD (fullscreen modal) ═══ */}
            {!onboarding.isLoading && !onboarding.hasCompleted && (
                <OnboardingWizard
                    onComplete={async () => {
                        await onboarding.complete();
                        celebrate('epic'); // Dopamine reward — Skill: neuroventa §7
                    }}
                    onSkip={async () => {
                        // Skipping closes it; Ajustes → "Ver el tutorial" reopens it
                        await onboarding.complete();
                    }}
                />
            )}
        </div>
    );
}
