/**
 * Android build only: "Restaurar compras" and, when the row is charged by Google Play,
 * "Gestionar en Google Play" (Play's own subscription page). Never a Lemon link here.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { PLAY_MANAGE_URL } from '@/lib/playBilling';
import type { PlayBillingState } from '@/hooks/usePlayBilling';

export function PlayStoreActions({ play, storeSource }: { play: PlayBillingState; storeSource?: string | null }) {
    const { t } = useLanguage();
    return (
        <div className="flex flex-col items-center gap-2" data-testid="play-store-actions">
            {storeSource === 'google_play' && (
                <a href={PLAY_MANAGE_URL} target="_blank" rel="noopener noreferrer" data-testid="play-manage"
                    className="kx-press block w-full rounded-xl border border-kx-line py-3 text-center text-sm font-semibold text-kx-ink">
                    {t('billing.manage')}
                </a>
            )}
            <button type="button" onClick={play.restore} disabled={play.phase !== 'idle'} data-testid="play-restore"
                className="text-xs font-semibold text-kx-ink2 underline-offset-2 hover:underline disabled:opacity-50">
                {play.phase === 'restoring' ? t('billing.restoring') : t('billing.restore')}
            </button>
        </div>
    );
}
