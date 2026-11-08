import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { fetchFreshJson } from '@/lib/fetchFresh';
import { APK_MANIFEST_URL, cachedManifest, muteVersion, parseManifest, rememberManifest, shouldOffer, type ApkManifest } from '@/lib/apkUpdate';

/** Native only. Offers a newer APK; any failure (offline, bad JSON, plugin missing) stays silent. */
export function useApkUpdate() {
    const [offer, setOffer] = useState<ApkManifest | null>(null);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;
        let alive = true;
        (async () => {
            try {
                const installed = parseInt((await App.getInfo()).build, 10);
                const now = Date.now();
                const cached = cachedManifest(now);
                let manifest = cached.manifest;
                if (!cached.fresh) {
                    manifest = parseManifest(await fetchFreshJson(APK_MANIFEST_URL));
                    if (manifest) rememberManifest(now, manifest);
                }
                if (alive && shouldOffer(installed, manifest, now)) setOffer(manifest);
            } catch { /* silent by design */ }
        })();
        return () => { alive = false; };
    }, []);

    const dismiss = useCallback(() => {
        if (offer) muteVersion(offer.version_code, Date.now());
        setOffer(null);
    }, [offer]);

    // External https URL → Capacitor hands it to the system browser (the WebView stays put).
    const update = useCallback(() => { if (offer) window.location.href = offer.apk_url; }, [offer]);

    return { offer, dismiss, update };
}
