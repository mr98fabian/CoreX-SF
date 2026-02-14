import { useState } from 'react';
import { LayoutDashboard, Wallet, Zap, Settings, LogOut, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';

export default function DashboardLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();
    const { user, signOut } = useAuth();

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-transparent">
            {/* SIDEBAR ANIMADO - Glassmorphism */}
            <aside
                className={cn(
                    "flex flex-col border-r border-white/5 bg-slate-950/50 backdrop-blur-xl transition-all duration-300 ease-in-out relative overflow-hidden z-20",
                    isSidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full opacity-0 border-none"
                )}
            >
                <div className="flex h-16 items-center px-6 min-w-max border-b border-white/5">
                    <div className="flex items-center gap-2 group cursor-default">
                        <img
                            src="/korex-logotipo.png"
                            alt="KoreX"
                            className="h-7 invert brightness-200 transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                        />
                    </div>
                </div>

                <nav className="flex-1 space-y-1.5 px-3 py-4 min-w-max">
                    <Link to="/">
                        <Button variant={isActive('/') ? "premium" : "ghost"} className={cn("w-full justify-start gap-2 h-10 transition-all", isActive('/') ? "shadow-lg shadow-amber-900/20" : "text-slate-400 hover:text-white hover:bg-white/5")}>
                            <LayoutDashboard size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">Dashboard</span>
                        </Button>
                    </Link>
                    <Link to="/accounts">
                        <Button variant={isActive('/accounts') ? "premium" : "ghost"} className={cn("w-full justify-start gap-2 h-10 transition-all", isActive('/accounts') ? "shadow-lg shadow-amber-900/20" : "text-slate-400 hover:text-white hover:bg-white/5")}>
                            <Wallet size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">My Accounts</span>
                        </Button>
                    </Link>
                    <Link to="/strategy">
                        <Button variant={isActive('/strategy') ? "premium" : "ghost"} className={cn("w-full justify-start gap-2 h-10 transition-all", isActive('/strategy') ? "shadow-lg shadow-amber-900/20" : "text-slate-400 hover:text-white hover:bg-white/5")}>
                            <Zap size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">Strategy</span>
                        </Button>
                    </Link>
                    <Link to="/settings">
                        <Button variant={isActive('/settings') ? "premium" : "ghost"} className={cn("w-full justify-start gap-2 h-10 transition-all", isActive('/settings') ? "shadow-lg shadow-amber-900/20" : "text-slate-400 hover:text-white hover:bg-white/5")}>
                            <Settings size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">Settings</span>
                        </Button>
                    </Link>
                </nav>

                <div className="border-t border-white/5 p-4 min-w-max space-y-3">
                    {user && (
                        <div className="flex items-center gap-3 px-2">
                            {user.user_metadata?.avatar_url ? (
                                <img
                                    src={user.user_metadata.avatar_url}
                                    alt="Avatar"
                                    className="h-8 w-8 rounded-full ring-2 ring-gold-400/30"
                                />
                            ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-gold-400 ring-2 ring-gold-400/30">
                                    {(user.email?.[0] || 'U').toUpperCase()}
                                </div>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-white">
                                    {user.user_metadata?.full_name || 'User'}
                                </p>
                                <p className="truncate text-[10px] text-slate-500">
                                    {user.email}
                                </p>
                            </div>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        className="w-full justify-start gap-2 text-rose-500 hover:text-rose-400 hover:bg-rose-950/20"
                        onClick={() => signOut()}
                    >
                        <LogOut size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">Sign Out</span>
                    </Button>
                </div>
            </aside>

            {/* ÁREA PRINCIPAL - Transparent to show body gradient */}
            <main className="flex-1 flex flex-col min-w-0 bg-transparent relative">
                {/* GLOBAL GLOBAL GLOW (Ambient Light) */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5 pointer-events-none" />

                {/* TOP BAR / HEADER */}
                <header className="flex h-14 items-center gap-4 border-b border-white/5 bg-slate-950/30 px-4 backdrop-blur-md sticky top-0 z-10">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="text-slate-400 hover:text-white hover:bg-white/5"
                    >
                        <PanelLeft size={20} strokeWidth={1.5} className={cn("transition-transform", !isSidebarOpen && "rotate-180")} />
                    </Button>
                    <div className="flex-1">
                        {/* Breadcrumbs placeholder */}
                    </div>
                </header>

                {/* CONTENIDO SCROLLABLE */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth relative z-0">
                    <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}
