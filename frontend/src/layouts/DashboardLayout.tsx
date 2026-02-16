import { useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, Settings, LogOut, PanelLeft, ListChecks, Sun, Moon, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/useMediaQuery';
import FeedbackWidget from '@/components/FeedbackWidget';
import UpgradeNudge from '@/components/UpgradeNudge';

export default function DashboardLayout() {
    const isMobile = useIsMobile();
    const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);
    const location = useLocation();
    const { user, signOut } = useAuth();
    const { t } = useLanguage();
    const { isDark, toggleTheme } = useTheme();

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
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    const navLinks = [
        { path: '/', icon: LayoutDashboard, label: t("nav.dashboard") },
        { path: '/action-plan', icon: ListChecks, label: t("nav.actionPlan") },
        { path: '/accounts', icon: Wallet, label: t("nav.accounts") },
        { path: '/settings', icon: Settings, label: t("nav.settings") },
    ];

    const sidebarContent = (
        <>
            <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2 group cursor-default">
                    <img
                        src="/korex-logotipo.png"
                        alt="KoreX"
                        className="h-8 transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                    />
                </div>
                {/* Close button — mobile only */}
                {isMobile && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-white"
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
                                    ? "shadow-lg shadow-amber-900/20"
                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                            )}
                        >
                            <Icon size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">{label}</span>
                        </Button>
                    </Link>
                ))}
            </nav>

            <div className="border-t border-slate-200 dark:border-white/5 p-4 space-y-3">
                {user && (
                    <div className="flex items-center gap-3 px-2">
                        {user.user_metadata?.avatar_url ? (
                            <img
                                src={user.user_metadata.avatar_url}
                                alt="Avatar"
                                className="h-8 w-8 rounded-full ring-2 ring-gold-400/30"
                            />
                        ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-xs font-bold text-gold-400 ring-2 ring-gold-400/30">
                                {(user.email?.[0] || 'U').toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-slate-800 dark:text-white">
                                {user.user_metadata?.full_name || 'User'}
                            </p>
                            <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">
                                {user.email}
                            </p>
                        </div>
                    </div>
                )}
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
        <div className="flex h-screen w-full overflow-hidden bg-transparent">

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
                    className="fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 dark:border-white/5 transition-transform duration-300 ease-in-out"
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
                        "bg-white/80 border-slate-200 dark:bg-slate-950/50 dark:border-white/5",
                        isSidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full opacity-0 border-none"
                    )}
                >
                    {sidebarContent}
                </aside>
            )}

            {/* MAIN AREA */}
            <main className="flex-1 flex flex-col min-w-0 bg-transparent relative">
                {/* Ambient glow */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5 pointer-events-none dark:opacity-100 opacity-30" />

                {/* TOP BAR / HEADER */}
                <header className="flex h-14 items-center gap-4 border-b px-4 backdrop-blur-md sticky top-0 z-10 bg-white/60 border-slate-200 dark:bg-slate-950/30 dark:border-white/5">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
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
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                        {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
                    </Button>
                </header>

                {/* SCROLLABLE CONTENT */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth relative z-0">
                    <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Outlet />
                    </div>
                </div>
            </main>
            <FeedbackWidget />
            <UpgradeNudge />
        </div>
    );
}
