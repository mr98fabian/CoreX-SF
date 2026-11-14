/**
 * Google Play purchase flow for the Android build: plugin → POST /api/subscriptions/google/verify
 * → refetch /api/subscriptions/status. The server grants; the app only reports tokens.
 * The price shown is Play's localized one, never a hardcoded figure.
 */
import { useCallback, useContext, useEffect, useState } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { fetchSubStatus } from '@/lib/planLimits';
import { PLAY_PRODUCT_ID, PlayBilling, playErrorCode, verifyPlayPurchase, type PlayProduct } from '@/lib/playBilling';

export type PlayPhase = 'idle' | 'buying' | 'verifying' | 'restoring';

export interface PlayBillingState {
    product: PlayProduct | null;
    unavailable: boolean;
    phase: PlayPhase;
    buy: () => Promise<void>;
    restore: () => Promise<void>;
    /** "1 mes gratis, luego MX$1,799.00/año" — null until Play answers or without a trial */
    trialLine: string | null;
    /** Play's localized recurring price, or the loading / unavailable text */
    priceText: string;
}

function trialText(iso: string | null, t: (k: string) => string): string | null {
    if (!iso) return null;
    const m = /^P(\d+)([DWM])$/.exec(iso);
    if (!m) return null;
    const n = Number(m[1]);
    if (m[2] === 'M' && n === 1) return t('billing.trialMonth');
    const days = m[2] === 'D' ? n : m[2] === 'W' ? n * 7 : n * 30;
    return t('billing.trialDays').replace('{n}', String(days));
}

export function usePlayBilling({ enabled, onActivated }: { enabled: boolean; onActivated?: () => void }): PlayBillingState {
    const { user, isDemo } = useAuth();
    const { t } = useLanguage();
    const { toast } = useToast();
    // Optional on purpose: screens rendered without a provider (tests, web) keep working
    const qc = useContext(QueryClientContext);
    const [product, setProduct] = useState<PlayProduct | null>(null);
    const [unavailable, setUnavailable] = useState(false);
    const [phase, setPhase] = useState<PlayPhase>('idle');

    useEffect(() => {
        if (!enabled) return;
        let alive = true;
        PlayBilling.getProductDetails({ productId: PLAY_PRODUCT_ID })
            .then((p) => { if (alive) setProduct(p); })
            .catch(() => { if (alive) setUnavailable(true); });
        return () => { alive = false; };
    }, [enabled]);

    const refresh = useCallback(async () => {
        await qc?.invalidateQueries({ queryKey: ['subscription-status'] });
        await fetchSubStatus();
        onActivated?.();
    }, [qc, onActivated]);

    const restore = useCallback(async () => {
        setPhase('restoring');
        try {
            const { purchases } = await PlayBilling.restorePurchases();
            let granted = false;
            for (const p of purchases) {
                try { granted = (await verifyPlayPurchase(p)).granted || granted; } catch { /* next token */ }
            }
            toast({ title: granted ? t('billing.restored') : t('billing.nothingToRestore') });
            if (granted) await refresh();
        } catch {
            toast({ title: t('billing.failed'), description: t('billing.failedDesc'), variant: 'destructive' });
        } finally {
            setPhase('idle');
        }
    }, [refresh, t, toast]);

    const buy = useCallback(async () => {
        if (isDemo || !user?.id) {
            toast({ title: t('billing.demo') });
            return;
        }
        setPhase('buying');
        try {
            const purchase = await PlayBilling.purchase({ productId: PLAY_PRODUCT_ID, accountId: user.id });
            if (purchase.state === 'pending') {
                toast({ title: t('billing.pending'), description: t('billing.pendingDesc') });
                return;
            }
            setPhase('verifying');
            const r = await verifyPlayPurchase(purchase);
            if (r.granted) {
                toast({ title: t('billing.active') });
                await refresh();
            } else {
                toast({ title: t('billing.notActive'), variant: 'destructive' });
            }
        } catch (e) {
            const code = playErrorCode(e);
            if (code === 'USER_CANCELED') {
                toast({ title: t('billing.canceled'), description: t('billing.canceledDesc') });
            } else if (code === 'ITEM_ALREADY_OWNED') {
                setPhase('idle');
                await restore();
            } else {
                toast({ title: t('billing.failed'), description: t('billing.failedDesc'), variant: 'destructive' });
            }
        } finally {
            setPhase('idle');
        }
    }, [isDemo, user, t, toast, refresh, restore]);

    // Off the Play flow (web) nothing is computed: the screen keeps its own USD figures
    const priceText = !enabled ? '' : product?.formattedPrice ?? (unavailable ? t('billing.unavailable') : t('billing.priceLoading'));
    const trial = trialText(product?.trialPeriod ?? null, t);
    const trialLine = trial && product?.formattedPrice ? `${trial}, ${t('billing.then').replace('{price}', product.formattedPrice)}` : null;
    return { product, unavailable, phase, buy, restore, trialLine, priceText };
}

/** Label of the buy button for the current phase. */
export function playButtonLabel(play: PlayBillingState, t: (k: string) => string): string {
    if (play.phase === 'buying') return t('billing.buying');
    if (play.phase === 'verifying') return t('billing.verifying');
    if (play.phase === 'restoring') return t('billing.restoring');
    return play.product?.trialPeriod ? t('billing.start') : t('billing.subscribe');
}
