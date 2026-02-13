import { useState } from 'react';
import { LayoutDashboard, Wallet, Settings, LogOut, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function DashboardLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-950">
            {/* SIDEBAR ANIMADO */}
            <aside
                className={cn(
                    "flex flex-col border-r border-slate-800 bg-slate-950 transition-all duration-300 ease-in-out relative overflow-hidden",
                    isSidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full opacity-0 border-none"
                )}
            >
                <div className="flex h-16 items-center px-6 min-w-max">
                    <span className="text-xl font-bold tracking-tight text-slate-50 whitespace-nowrap">
                        CoreX <span className="text-blue-500">System</span>
                    </span>
                </div>

                <nav className="flex-1 space-y-1.5 px-3 py-4 min-w-max">
                    <Link to="/">
                        <Button variant={isActive('/') ? "secondary" : "ghost"} className={cn("w-full justify-start gap-2 h-10 transition-colors", isActive('/') ? "bg-blue-600 text-white hover:bg-blue-700" : "text-slate-400 hover:text-white hover:bg-slate-800")}>
                            <LayoutDashboard size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">Dashboard</span>
                        </Button>
                    </Link>
                    <Link to="/accounts">
                        <Button variant={isActive('/accounts') ? "secondary" : "ghost"} className={cn("w-full justify-start gap-2 h-10 transition-colors", isActive('/accounts') ? "bg-blue-600 text-white hover:bg-blue-700" : "text-slate-400 hover:text-white hover:bg-slate-800")}>
                            <Wallet size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">My Accounts</span>
                        </Button>
                    </Link>

                    {/* Cashflow Engine Link Removed */}
                    <Link to="/settings">
                        <Button variant={isActive('/settings') ? "secondary" : "ghost"} className={cn("w-full justify-start gap-2 h-10 transition-colors", isActive('/settings') ? "bg-blue-600 text-white hover:bg-blue-700" : "text-slate-400 hover:text-white hover:bg-slate-800")}>
                            <Settings size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">Settings</span>
                        </Button>
                    </Link>
                </nav>

                <div className="border-t border-slate-800 p-4 min-w-max">
                    <Button variant="ghost" className="w-full justify-start gap-2 text-rose-500 hover:text-rose-400 hover:bg-rose-950/20">
                        <LogOut size={18} strokeWidth={1.5} /> <span className="whitespace-nowrap">Sign Out</span>
                    </Button>
                </div>
            </aside>

            {/* ÁREA PRINCIPAL */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-900">
                {/* TOP BAR / HEADER */}
                <header className="flex h-14 items-center gap-4 border-b border-slate-800 bg-slate-950/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60 sticky top-0 z-10">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="text-slate-400 hover:text-white"
                    >
                        <PanelLeft size={20} strokeWidth={1.5} className={cn("transition-transform", !isSidebarOpen && "rotate-180")} />
                    </Button>
                    <div className="flex-1">
                        {/* Breadcrumbs placeholder */}
                    </div>
                </header>

                {/* CONTENIDO SCROLLABLE */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
                    <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}
