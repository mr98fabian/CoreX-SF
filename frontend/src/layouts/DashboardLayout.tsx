import { useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, Settings, LogOut, PanelLeft, ListChecks, Sun, Moon, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useIsMobile } from '@/hooks/useMediaQuery';

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

    const sidebarContent = (
        <>
            <div className="flex h-16 items-center justify-center px-6 min-w-max border-b border-slate-200 dark:border-white/5">
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
                        className="absolute right-2 top-3 text-slate-400 hover:text-white"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <X size={20} />
                    </Button>
                )}
            </div>

            <nav className="flex-1 space-y-1.5 px-3 py-4 min-w-max">
                <Link to="/">
                    <Button variant={isActive('/') ? "premium" : "ghost"} className={cn("w-full justify-start gap-2 h-10 transition-all", isActive('/') ? "shadow-lg shadow-amber-900/20" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5")}>
                        <LayoutDashboard size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">{t("nav.dashboard")}</span>
                    </Button>
                </Link>
                <Link to="/action-plan">
                    <Button variant={isActive('/action-plan') ? "premium" : "ghost"} className={cn("w-full justify-start gap-2 h-10 transition-all", isActive('/action-plan') ? "shadow-lg shadow-amber-900/20" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5")}>
                        <ListChecks size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">{t("nav.actionPlan")}</span>
                    </Button>
                </Link>
                <Link to="/accounts">
                    <Button variant={isActive('/accounts') ? "premium" : "ghost"} className={cn("w-full justify-start gap-2 h-10 transition-all", isActive('/accounts') ? "shadow-lg shadow-amber-900/20" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5")}>
                        <Wallet size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">{t("nav.accounts")}</span>
                    </Button>
                </Link>

                <Link to="/settings">
                    <Button variant={isActive('/settings') ? "premium" : "ghost"} className={cn("w-full justify-start gap-2 h-10 transition-all", isActive('/settings') ? "shadow-lg shadow-amber-900/20" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5")}>
                        <Settings size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">{t("nav.settings")}</span>
                    </Button>
                </Link>
            </nav>

            <div className="border-t border-slate-200 dark:border-white/5 p-4 min-w-max space-y-3">
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
            {/* ═══ MOBILE: Overlay sidebar + backdrop ═══ */}
            {isMobile && (
                <>
                    {/* Backdrop */}
                    {isSidebarOpen && (
                        <div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                            onClick={() => setIsSidebarOpen(false)}
                        />
                    )}
                    {/* Drawer */}
                    <aside
                        className={cn(
                            "fixed inset-y-0 left-0 z-50 w-64 flex flex-col backdrop-blur-xl transition-transform duration-300 ease-in-out",
                            "bg-white/95 dark:bg-slate-950/95 border-r border-slate-200 dark:border-white/5",
                            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                        )}
                    >
                        {sidebarContent}
                    </aside>
                </>
            )}

            {/* ═══ DESKTOP: Normal sidebar (unchanged behavior) ═══ */}
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
        </div>
    );
}
