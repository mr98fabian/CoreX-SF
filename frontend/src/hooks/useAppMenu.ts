import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { fetchFreshJson } from '@/lib/fetchFresh';
import { APK_MANIFEST_URL, isIOS, manualCheckResult, parseManifest, type ApkManifest, type ManualCheck } from '@/lib/apkUpdate';

/**
 * "App" section of Más. Same manifest and rules as the automatic banner
 * (lib/apkUpdate.ts), but:
 *  - web (not iOS): offers the APK download, only if apk.json has a real URL;
 *  - native: a MANUAL check, always fresh (ignores the 6 h cache and the mute),
 *    with visible feedback in every state.
 */
export function useAppMenu() {
    const native = Capacitor.isNativePlatform();
    const ios = !native && typeof navigator !== 'undefined' && isIOS(navigator.userAgent, navigator.maxTouchPoints ?? 0);
    const [download, setDownload] = useState<ApkManifest | null>(null);
    const [info, setInfo] = useState<{ version_name: string; version_code: string } | null>(null);
    const [check, setCheck] = useState<ManualCheck | null>(null);

    useEffect(() => {
        let alive = true;
        if (native) {
            App.getInfo().then((i) => { if (alive) setInfo({ version_name: i.version, version_code: i.build }); }).catch(() => undefined);
        } else if (!ios) {
            fetchFreshJson(APK_MANIFEST_URL).then((raw) => { if (alive) setDownload(parseManifest(raw)); });
        }
        return () => { alive = false; };
    }, [native, ios]);

    /** Web: re-read the manifest at tap time and open its APK. */
    const downloadApp = useCallback(async () => {
        const fresh = parseManifest(await fetchFreshJson(APK_MANIFEST_URL)) ?? download;
        if (fresh) window.location.href = fresh.apk_url;
    }, [download]);

    /** Native: fresh check every time; a found update downloads like the banner. */
    const checkNow = useCallback(async () => {
        if (check?.state === 'new') { window.location.href = check.manifest.apk_url; return; }
        if (check?.state === 'checking') return;
        setCheck({ state: 'checking' });
        try {
            const i = await App.getInfo();
            setInfo({ version_name: i.version, version_code: i.build });
            const manifest = parseManifest(await fetchFreshJson(APK_MANIFEST_URL));
            setCheck(manualCheckResult(parseInt(i.build, 10), i.version, manifest));
        } catch {
            setCheck({ state: 'error' });
        }
    }, [check]);

    return { native, showDownload: !native && !ios && !!download, showCheck: native, info, check, downloadApp, checkNow };
}
