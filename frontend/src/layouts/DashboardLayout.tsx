import { useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, Settings, LogOut, PanelLeft, ListChecks, Sun, Moon, Menu, X, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import FeedbackWidget from '@/components/FeedbackWidget';
import { syncPlanFromBackend } from '@/lib/planLimits';
import UpgradeNudge from '@/components/UpgradeNudge';
import { InterestBleedBanner } from '@/components/InterestBleedBanner';
import InstallPrompt from '@/components/InstallPrompt';
import OfflineIndicator from '@/components/OfflineIndicator';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingWizard } from '@/components/OnboardingWizard';
import { OnboardingResumePopup } from '@/components/OnboardingResumePopup';
import DemoWelcomeModal from '@/components/DemoWelcomeModal';
import { useCelebration } from '@/hooks/useCelebration';
import { CommanderBadge } from '@/components/CommanderBadge';

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
    }, []);

    // Auto-close sidebar on mobile when route changes
    useEffect(() => {
        if (isMobile) setIsSidebarOpen(false);
    }, [location.pathname, isMobile]);

    // Close sidebar when switching to mobile viewport
    useEffect(() => {
        if (isMobile) setIsSidebarOpen(false);
        else setIsSidebarOpen(true);
    }, [isMobile]);

    const isActive = (path: string) => {
        if (path === '/dashboard') return location.pathname === '/dashboard';
        return location.pathname.startsWith(path);
    };

    const navLinks = [
        { path: '/dashboard', icon: LayoutDashboard, label: t("nav.dashboard") },
        { path: '/dashboard/action-plan', icon: ListChecks, label: t("nav.actionPlan") },
        { path: '/dashboard/accounts', icon: Wallet, label: t("nav.accounts") },
        { path: '/dashboard/rankings', icon: Trophy, label: t("nav.rankings") },
        { path: '/dashboard/settings', icon: Settings, label: t("nav.settings") },
    ];

    const sidebarContent = (
        <>
            <div className="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-white/5">
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
                        className="text-gray-400 hover:text-white"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <X size={20} />
                    </Button>
                )}
            </div>

            <nav className="flex-1 space-y-1.5 px-3 py-4">
                {navLinks.map(({ path, icon: Icon, label }) => (
                    <Link key={path} to={path} onClick={() => isMobile && setIsSidebarOpen(false)}>
                        <Button
                            variant={isActive(path) ? "premium" : "ghost"}
                            className={cn(
                                "w-full justify-start gap-2 h-10 transition-all",
                                isActive(path)
                                    ? "shadow-lg shadow-black/20 dark:shadow-white/10"
                                    : "text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                            )}
                        >
                            <Icon size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">{label}</span>
                        </Button>
                    </Link>
                ))}
            </nav>

            <div className="border-t border-gray-200 dark:border-white/5 p-4 space-y-3">
                {user && (
                    <div className="flex items-center gap-3 px-2">
                        {user.user_metadata?.avatar_url ? (
                            <img
                                src={user.user_metadata.avatar_url}
                                alt="Avatar"
                                className="h-8 w-8 rounded-full ring-2 ring-white/30 dark:ring-white/20"
                            />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-neutral-800 text-xs font-bold text-black dark:text-white ring-2 ring-black/10 dark:ring-white/20">
                                {(user.email?.[0] || 'U').toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-black dark:text-white">
                                {user.user_metadata?.full_name || 'User'}
                            </p>
                            <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">
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
                    className="w-full justify-start gap-2 text-rose-500 hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    onClick={() => signOut()}
                >
                    <LogOut size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">{t("nav.signOut")}</span>
                </Button>
            </div>
        </>
    );

    return (
        <div className="flex h-[100dvh] w-full overflow-x-clip bg-transparent">

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
                    className="fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200 dark:border-white/5 transition-transform duration-300 ease-in-out"
                    style={{
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
                        "flex flex-col border-r transition-all duration-300 ease-in-out relative overflow-hidden z-20 backdrop-blur-xl",
                        "bg-white/80 border-gray-200 dark:bg-black/50 dark:border-white/5",
                        isSidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full opacity-0 border-none"
                    )}
                >
                    {sidebarContent}
                </aside>
            )}

            {/* MAIN AREA */}
            <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-transparent relative">
                {/* Ambient glow */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 via-transparent to-white/3 pointer-events-none dark:from-white/[0.02] dark:to-white/[0.01] opacity-30 dark:opacity-100" />

                {/* TOP BAR / HEADER */}
                <header className="flex h-14 items-center gap-4 border-b px-4 backdrop-blur-md sticky top-0 z-10 bg-white/60 border-gray-200 dark:bg-black/30 dark:border-white/5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
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
                        className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5"
                        title={isDark
                            ? (language === 'es' ? 'Cambiar a Modo Claro' : 'Switch to Light Mode')
                            : (language === 'es' ? 'Cambiar a Modo Oscuro' : 'Switch to Dark Mode')}
                    >
                        {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
                    </Button>
                </header>

                {/* SCROLLABLE CONTENT */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 scroll-smooth relative z-0" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain', touchAction: 'pan-y pinch-zoom' }}>
                    <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Outlet />
                    </div>
                </div>
            </main>
            <FeedbackWidget />
            <UpgradeNudge />
            <InterestBleedBanner />
            <InstallPrompt />
            <OfflineIndicator />
            <SessionTimeoutWarning />
            <DemoWelcomeModal />

            {/* ═══ ONBOARDING WIZARD (fullscreen modal) ═══ */}
            {!onboarding.isLoading && !onboarding.hasCompleted && (
                <OnboardingWizard
                    onComplete={async () => {
                        await onboarding.complete();
                        celebrate('epic'); // Dopamine reward — Skill: neuroventa §7
                    }}
                    onSkip={async () => {
                        // Mark complete so wizard closes, but flag as skipped
                        await onboarding.complete();
                        localStorage.setItem('korex_onboarding_skipped', 'true');
                    }}
                />
            )}

            {/* Resume popup — only shown if user skipped the tutorial */}
            {onboarding.hasCompleted && (
                <OnboardingResumePopup
                    onResume={async () => {
                        localStorage.removeItem('korex_onboarding_skipped');
                        await onboarding.restart();
                    }}
                />
            )}
        </div>
    );
}
