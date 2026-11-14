/**
 * TS side of KoreX's own Play Billing plugin (android/app/src/main/java/com/korexf/app/billing).
 * It only talks to Google Play: nothing here grants a plan. Every purchase token goes to
 * POST /api/subscriptions/google/verify (see verifyPlayPurchase), which reads it from
 * Google, grants and acknowledges.
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { apiFetch } from '@/lib/api';

export const PLAY_PRODUCT_ID = 'korex_annual';
export const PLAY_MANAGE_URL = `https://play.google.com/store/account/subscriptions?package=com.korexf.app&sku=${PLAY_PRODUCT_ID}`;

export interface PlayPricingPhase {
    formattedPrice: string;
    priceAmountMicros: number;
    priceCurrencyCode: string;
    billingPeriod: string;
    billingCycleCount: number;
    recurrenceMode: number;
}

export interface PlayProduct {
    productId: string;
    title: string;
    offerToken: string;
    basePlanId: string;
    offerId?: string | null;
    /** Localized recurring price from Play (e.g. "MX$1,799.00"): the only price shown in the Play flow */
    formattedPrice: string | null;
    billingPeriod: string | null;
    /** ISO 8601 period of the free phase ("P1M", "P30D") when the user is eligible */
    trialPeriod: string | null;
    phases: PlayPricingPhase[];
}

export interface PlayPurchase {
    productId: string;
    purchaseToken: string;
    packageName: string;
    acknowledged: boolean;
    state: 'purchased' | 'pending';
}

/** Error codes the plugin rejects with. USER_CANCELED is not a failure. */
export type PlayErrorCode = 'USER_CANCELED' | 'ITEM_ALREADY_OWNED' | 'BILLING_UNAVAILABLE' | 'PRODUCT_NOT_FOUND'
    | 'NETWORK_ERROR' | 'IN_PROGRESS' | 'INVALID_ACCOUNT' | 'ERROR';

export interface PlayBillingPlugin {
    getProductDetails(opts?: { productId?: string }): Promise<PlayProduct>;
    purchase(opts: { productId?: string; accountId: string }): Promise<PlayPurchase>;
    restorePurchases(): Promise<{ purchases: PlayPurchase[] }>;
    acknowledge(opts: { purchaseToken: string }): Promise<{ acknowledged: boolean }>;
    addListener(event: 'purchaseUpdated', fn: (p: PlayPurchase) => void): Promise<PluginListenerHandle>;
}

export const PlayBilling = registerPlugin<PlayBillingPlugin>('PlayBilling');

export function playErrorCode(e: unknown): PlayErrorCode {
    const code = (e as { code?: string } | null)?.code;
    return (code as PlayErrorCode) || 'ERROR';
}

export interface VerifyResult {
    granted: boolean;
    status: string;
    plan: string | null;
    current_period_end: string | null;
    acknowledged: boolean;
    store_source: 'google_play';
}

/** The server decides. If it granted but couldn't acknowledge, the app acknowledges as backup. */
export async function verifyPlayPurchase(p: PlayPurchase): Promise<VerifyResult> {
    const r = await apiFetch<VerifyResult>('/api/subscriptions/google/verify', {
        method: 'POST',
        body: JSON.stringify({ product_id: p.productId || PLAY_PRODUCT_ID, purchase_token: p.purchaseToken, package_name: p.packageName }),
    });
    if (r.granted && !r.acknowledged) await PlayBilling.acknowledge({ purchaseToken: p.purchaseToken }).catch(() => undefined);
    return r;
}
