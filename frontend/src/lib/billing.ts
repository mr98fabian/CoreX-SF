/**
 * Who charges on this platform. The Android build (sold through Google Play) MUST use Play
 * Billing for digital goods: in that build no path to the web checkout (Stripe) may exist (no
 * checkout call, no link, no window.open). The web buys through Stripe Managed Payments.
 */
import { Capacitor } from '@capacitor/core';

export type BillingProvider = 'google_play' | 'stripe';

export function getBillingProvider(): BillingProvider {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' ? 'google_play' : 'stripe';
}
