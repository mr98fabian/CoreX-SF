import { Download, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApkUpdate } from '@/hooks/useApkUpdate';

/** Dismissible, never blocking. Slate + amber, sits above the bottom safe area. */
export function ApkUpdateBanner() {
    const { offer, dismiss, update } = useApkUpdate();
    const { language } = useLanguage();
    if (!offer) return null;
    const es = language === 'es';
    return (
        <div role="status" data-testid="apk-update"
            className="fixed inset-x-3 z-[60] mx-auto max-w-md rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100 shadow-lg"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }}>
            <div className="flex items-start gap-3">
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" strokeWidth={1.75} aria-hidden />
                <p className="flex-1 text-sm leading-snug">
                    {es ? `Hay una versión nueva de KoreX (v${offer.version_name})` : `A new version of KoreX is available (v${offer.version_name})`}
                </p>
                <button type="button" onClick={dismiss} aria-label={es ? 'Cerrar' : 'Close'} className="kx-press -m-1 p-1 text-slate-400">
                    <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
            </div>
            <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={dismiss} className="kx-press rounded-lg px-3 py-1.5 text-sm text-slate-300">
                    {es ? 'Ahora no' : 'Not now'}
                </button>
                <button type="button" onClick={update} className="kx-press rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950">
                    {es ? 'Actualizar' : 'Update'}
                </button>
            </div>
        </div>
    );
}
