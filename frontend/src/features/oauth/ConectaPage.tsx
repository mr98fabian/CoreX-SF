/**
 * /conecta — the page Fabián sends to anyone: connect KoreX to your assistant in 3 steps.
 * The MCP URL is not a secret (OAuth does the securing). No tokens, no kit, nothing technical.
 */
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { MCP_REMOTE_URL } from '@/lib/api';

export default function ConectaPage() {
    const { t } = useLanguage();
    usePageTitle(t('conecta.title'));
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(MCP_REMOTE_URL);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard blocked: the URL stays selectable */ }
    };

    const steps = [t('conecta.step1'), t('conecta.step2'), t('conecta.step3')];
    return (
        <div className="kx-scope min-h-screen bg-kx-bg px-5 py-10">
            <div className="mx-auto max-w-md space-y-6">
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-semibold text-kx-ink">{t('conecta.title')}</h1>
                    <p className="text-[14.5px] text-kx-ink2">{t('conecta.lead')}</p>
                </div>
                <ol data-testid="conecta-steps" className="space-y-4">
                    {steps.map((text, i) => (
                        <li key={i} className="flex gap-3 rounded-[20px] border border-kx-line bg-kx-surface p-[18px]">
                            <span className="kx-num flex h-7 w-7 flex-none items-center justify-center rounded-full bg-kx-amber text-sm font-bold text-kx-on-amber">{i + 1}</span>
                            <div className="min-w-0 flex-1 space-y-3">
                                <p className="pt-0.5 text-[15px] font-semibold text-kx-ink">{text}</p>
                                {i === 1 && (
                                    <div className="flex items-center gap-2">
                                        <code data-testid="conecta-url" className="min-w-0 flex-1 break-all rounded-lg border border-kx-line px-3 py-2 font-mono text-xs text-kx-ink select-all">{MCP_REMOTE_URL}</code>
                                        <button type="button" data-testid="conecta-copy" onClick={copy}
                                            className="kx-press flex-none rounded-xl bg-kx-amber px-3.5 py-2 text-xs font-bold text-kx-on-amber">
                                            {copied ? t('conecta.copied') : t('conecta.copy')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ol>
                <p className="text-center text-[13.5px] text-kx-ink2">{t('conecta.after')}</p>
            </div>
        </div>
    );
}
