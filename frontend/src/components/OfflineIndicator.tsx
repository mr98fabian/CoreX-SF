import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OfflineIndicator() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [showReconnected, setShowReconnected] = useState(false);

    useEffect(() => {
        const handleOffline = () => {
            setIsOffline(true);
            setShowReconnected(false);
        };

        const handleOnline = () => {
            setIsOffline(false);
            // Brief "reconnected" feedback before hiding
            setShowReconnected(true);
            const timer = setTimeout(() => setShowReconnected(false), 3000);
            return () => clearTimeout(timer);
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    if (!isOffline && !showReconnected) return null;

    return (
        <div
            className={cn(
                "fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-1.5 px-4 text-xs font-medium transition-all duration-300",
                isOffline
                    ? "bg-amber-500/95 text-slate-900"
                    : "bg-emerald-500/95 text-white animate-in fade-in duration-300"
            )}
        >
            {isOffline ? (
                <>
                    <WifiOff size={14} />
                    <span>You're offline — some data may be outdated</span>
                </>
            ) : (
                <>
                    <Wifi size={14} />
                    <span>Back online</span>
                </>
            )}
        </div>
    );
}
