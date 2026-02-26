import { useState, useEffect, useCallback } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

// Storage key to avoid nagging after dismissal
const DISMISS_KEY = 'korex-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
    const isMobile = useIsMobile();
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    // Check if already installed or dismissed
    useEffect(() => {
        // Already running as standalone PWA — no need to prompt
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        // Check dismissal expiry
        const dismissedAt = localStorage.getItem(DISMISS_KEY);
        if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS) {
            return;
        }

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Track successful installs
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
            setIsVisible(false);
            setDeferredPrompt(null);
        });

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setIsInstalled(true);
        }
        setIsVisible(false);
        setDeferredPrompt(null);
    }, [deferredPrompt]);

    const handleDismiss = useCallback(() => {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setIsVisible(false);
    }, []);

    if (!isVisible || isInstalled || !isMobile) return null;

    return (
        <div
            className={cn(
                "fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3",
                "rounded-xl border p-4 shadow-2xl backdrop-blur-xl",
                "bg-white/95 border-gray-200 dark:bg-[#0f0f0f]/95 dark:border-white/10",
                "animate-in slide-in-from-bottom-8 fade-in duration-500"
            )}
        >
            {/* App icon */}
            <div className="flex-shrink-0 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 p-2 shadow-lg shadow-amber-900/20">
                <Download size={20} className="text-slate-900" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Install KoreX
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    Faster access, works offline
                </p>
            </div>

            {/* Actions */}
            <Button
                size="sm"
                variant="premium"
                className="flex-shrink-0 text-xs h-8 px-3"
                onClick={handleInstall}
            >
                Install
            </Button>
            <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-slate-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Dismiss"
            >
                <X size={16} />
            </button>
        </div>
    );
}
