import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useLanguage } from '@/contexts/LanguageContext';

// Storage key to avoid nagging after the toast has been shown
const DISMISS_KEY = 'korex-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * InstallPrompt — one-shot toast notification (mobile only).
 * Replaces the old fixed bottom card to reduce floating UI clutter.
 * Shows at most once every 7 days.
 */
export default function InstallPrompt() {
    const isMobile = useIsMobile();
    const { language } = useLanguage();
    const { toast } = useToast();
    const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
    const shownRef = useRef(false);
    // Already running as standalone PWA — no need to prompt
    const [isInstalled, setIsInstalled] = useState(
        () => window.matchMedia('(display-mode: standalone)').matches,
    );

    useEffect(() => {
        if (isInstalled || !isMobile || shownRef.current) return;

        // Check suppression window (7 days since last shown)
        const dismissedAt = localStorage.getItem(DISMISS_KEY);
        if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION_MS) return;

        const isEs = language === 'es';

        const handler = (e: Event) => {
            e.preventDefault();
            deferredRef.current = e as BeforeInstallPromptEvent;
            if (shownRef.current) return;
            shownRef.current = true;

            // A toast is transient — record the impression so we don't nag
            localStorage.setItem(DISMISS_KEY, String(Date.now()));

            toast({
                title: isEs ? 'Instala KoreX' : 'Install KoreX',
                description: isEs
                    ? 'Acceso más rápido, funciona sin conexión'
                    : 'Faster access, works offline',
                duration: 12000,
                action: (
                    <ToastAction
                        altText={isEs ? 'Instalar' : 'Install'}
                        onClick={async () => {
                            const promptEvent = deferredRef.current;
                            if (!promptEvent) return;
                            await promptEvent.prompt();
                            const { outcome } = await promptEvent.userChoice;
                            if (outcome === 'accepted') setIsInstalled(true);
                            deferredRef.current = null;
                        }}
                    >
                        {isEs ? 'Instalar' : 'Install'}
                    </ToastAction>
                ),
            });
        };

        // Track successful installs
        const installedHandler = () => {
            setIsInstalled(true);
            deferredRef.current = null;
        };

        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, [isInstalled, isMobile, language, toast]);

    // Renders nothing — notification is delivered via the toast system
    return null;
}
