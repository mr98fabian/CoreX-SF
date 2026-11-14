/**
 * Android build: purchases that complete outside the direct flow (a pending payment that
 * clears, a purchase from another device) arrive through the plugin's PurchasesUpdatedListener
 * as `purchaseUpdated`. Each one goes to the server for verification; nothing is granted here.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { getBillingProvider } from '@/lib/billing';
import { fetchSubStatus } from '@/lib/planLimits';
import { PlayBilling, verifyPlayPurchase } from '@/lib/playBilling';

export function PlayPurchaseWatcher() {
    const { user, isDemo } = useAuth();
    const { t } = useLanguage();
    const { toast } = useToast();
    const qc = useQueryClient();
    const signedIn = !!user?.id && !isDemo;

    useEffect(() => {
        if (getBillingProvider() !== 'google_play' || !signedIn) return;
        const handle = PlayBilling.addListener('purchaseUpdated', async (p) => {
            if (p.state !== 'purchased') return;
            try {
                if ((await verifyPlayPurchase(p)).granted) {
                    await qc.invalidateQueries({ queryKey: ['subscription-status'] });
                    await fetchSubStatus();
                    toast({ title: t('billing.active') });
                }
            } catch { /* "Restaurar compras" and RTDN cover it */ }
        });
        return () => { handle.then((h) => h.remove()).catch(() => undefined); };
    }, [signedIn, qc, t, toast]);

    return null;
}
