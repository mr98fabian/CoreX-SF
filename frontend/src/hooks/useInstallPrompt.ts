import { useSyncExternalStore } from 'react';
import { canInstall, promptInstall, subscribeInstall } from '@/lib/installPrompt';

/** true while the browser offers PWA installation (not installed, event captured). */
export function useInstallPrompt() {
    const available = useSyncExternalStore(subscribeInstall, canInstall, () => false);
    return { available, install: promptInstall };
}
