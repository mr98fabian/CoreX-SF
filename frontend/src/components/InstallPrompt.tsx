import { useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { useLanguage } from '@/contexts/LanguageContext';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { isInstallMuted, muteInstall } from '@/lib/installPrompt';

/**
 * InstallPrompt — a one-time toast per session (mobile web) offering to install.
 * Showing it NEVER mutes it: the 7-day silence is written only when the user
 * says "Ahora no" (or cancels the browser dialog, see lib/installPrompt.ts).
 * The offer also lives, persistently, in Más → App ("Instalar KoreX").
 */
export default function InstallPrompt() {
    const isMobile = useIsMobile();
    const { language } = useLanguage();
    const { toast } = useToast();
    const { available, install } = useInstallPrompt();
    const shownRef = useRef(false);

    useEffect(() => {
        if (!available || !isMobile || shownRef.current || isInstallMuted()) return;
        shownRef.current = true;
        const es = language === 'es';
        const t = toast({
            title: es ? 'Instala KoreX' : 'Install KoreX',
            description: (
                <span>
                    {es ? 'Acceso más rápido, funciona sin conexión. ' : 'Faster access, works offline. '}
                    <button type="button" data-testid="install-not-now" className="underline underline-offset-2"
                        onClick={() => { muteInstall(); t.dismiss(); }}>
                        {es ? 'Ahora no' : 'Not now'}
                    </button>
                </span>
            ),
            duration: 12000,
            action: (
                <ToastAction altText={es ? 'Instalar' : 'Install'} onClick={() => { void install(); }}>
                    {es ? 'Instalar' : 'Install'}
                </ToastAction>
            ),
        });
    }, [available, isMobile, language, toast, install]);

    return null;
}
