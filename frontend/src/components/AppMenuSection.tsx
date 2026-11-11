import { Download, Loader2, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppMenu } from '@/hooks/useAppMenu';

const ROW = 'flex min-h-10 w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm font-medium text-kx-ink2 transition-colors hover:bg-kx-raised hover:text-kx-ink';

/** Last section of Más: "Descargar la app" (web, not iOS) or "Buscar actualización" (native). */
export function AppMenuSection() {
    const { t } = useLanguage();
    const { showDownload, showCheck, info, check, downloadApp, checkNow } = useAppMenu();
    if (!showDownload && !showCheck) return null;
    const fill = (key: string, v: string) => t(key).replace('{v}', v);

    let label = t('app.check');
    let sub: string | null = null;
    if (check?.state === 'checking') label = t('app.checking');
    if (check?.state === 'new') { label = fill('app.updateTo', check.manifest.version_name); sub = check.manifest.notas || null; }
    if (check?.state === 'current') sub = fill('app.upToDate', check.version_name);
    if (check?.state === 'error') sub = t('app.checkError');

    return (
        <div className="mt-4 border-t border-kx-line pt-3" data-testid="nav-app">
            <p className="kx-label mb-1.5 px-3">{t('app.section')}</p>
            <div className="space-y-1.5">
                {showDownload && (
                    <button type="button" onClick={downloadApp} className={ROW} data-testid="app-download">
                        <Download size={18} strokeWidth={1.5} className="shrink-0 text-kx-amber" aria-hidden="true" />
                        <span className="flex flex-col">
                            <span>{t('app.download')}</span>
                            <span className="text-xs font-normal text-kx-ink3">{t('app.downloadSub')}</span>
                        </span>
                    </button>
                )}
                {showCheck && (
                    <button type="button" onClick={checkNow} className={ROW} data-testid="app-check" data-state={check?.state ?? 'idle'}
                        aria-busy={check?.state === 'checking'}>
                        {check?.state === 'checking'
                            ? <Loader2 size={18} strokeWidth={1.5} className="shrink-0 animate-spin text-kx-amber" aria-hidden="true" />
                            : check?.state === 'new'
                                ? <Download size={18} strokeWidth={1.5} className="shrink-0 text-kx-amber" aria-hidden="true" />
                                : <RefreshCw size={18} strokeWidth={1.5} className="shrink-0 text-kx-amber" aria-hidden="true" />}
                        <span className="flex flex-col">
                            <span data-testid="app-check-label">{label}</span>
                            {sub && <span className={`text-xs font-normal ${check?.state === 'error' ? 'text-kx-debt' : 'text-kx-ink3'}`} data-testid="app-check-sub">{sub}</span>}
                        </span>
                    </button>
                )}
            </div>
            {showCheck && info && (
                <p className="mt-2 px-4 text-[11px] text-slate-500" data-testid="app-version">KoreX v{info.version_name} ({info.version_code})</p>
            )}
        </div>
    );
}
