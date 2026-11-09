/**
 * ReferralProgram — Referral link sharing widget.
 *
 * Shows inside the Settings page or as a CTA in the sidebar.
 * Generates a unique referral URL based on user ID, with copy + share buttons.
 *
 * Revenue model: Each successful referral = 1 free month for referrer.
 *
 * Source: referral-gamification skill §3
 */
import { useState, useCallback } from 'react';
import { Copy, Check, Share2, Gift, Users } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';

export function ReferralProgram() {
    const { user } = useAuth();
    const { language } = useLanguage();
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    // Generate referral link using user ID (first 8 chars as ref code)
    const refCode = user?.id?.substring(0, 8) || 'demo';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://korex.app';
    const referralUrl = `${baseUrl}/signup?ref=${refCode}`;

    const isEs = language === 'es';

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(referralUrl);
            setCopied(true);
            toast({
                title: isEs ? '¡Enlace copiado!' : 'Link copied!',
                description: isEs ? 'Comparte con amigos para ganar un mes gratis' : 'Share with friends to earn a free month',
            });
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for non-HTTPS contexts
            const textArea = document.createElement('textarea');
            textArea.value = referralUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [referralUrl, toast, isEs]);

    const handleShare = useCallback(async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'KoreX — Velocity Banking',
                    text: isEs
                        ? '¡Prueba KoreX para acelerar tu libertad financiera!'
                        : 'Try KoreX to accelerate your financial freedom!',
                    url: referralUrl,
                });
            } catch {
                // User cancelled share — ignore
            }
        } else {
            handleCopy();
        }
    }, [referralUrl, handleCopy, isEs]);

    return (
        <div className="rounded-2xl border border-kx-line bg-kx-surface via-transparent p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-kx-raised text-kx-ink2">
                    <Gift size={22} />
                </div>
                <div>
                    <h3 className="text-base font-bold text-kx-ink">
                        {isEs ? '🎁 Programa de Referidos' : '🎁 Referral Program'}
                    </h3>
                    <p className="text-xs text-kx-ink2">
                        {isEs
                            ? 'Invita amigos y gana 1 mes gratis por cada registro'
                            : 'Invite friends and earn 1 free month per signup'}
                    </p>
                </div>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-3 gap-2 text-center">
                {[
                    {
                        step: '1',
                        icon: <Share2 size={16} />,
                        label: isEs ? 'Comparte tu link' : 'Share your link',
                    },
                    {
                        step: '2',
                        icon: <Users size={16} />,
                        label: isEs ? 'Amigo se registra' : 'Friend signs up',
                    },
                    {
                        step: '3',
                        icon: <Gift size={16} />,
                        label: isEs ? '1 mes gratis' : '1 free month',
                    },
                ].map((s) => (
                    <div key={s.step} className="p-2.5 rounded-lg bg-kx-surface border border-kx-line">
                        <div className="mx-auto w-8 h-8 rounded-full bg-kx-raised flex items-center justify-center text-kx-ink2 mb-1.5">
                            {s.icon}
                        </div>
                        <p className="text-[11px] text-kx-ink2 font-medium">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Referral Link */}
            <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg bg-[#0f0f0f]/80 border border-kx-line px-3 py-2.5 text-xs text-kx-ink2 font-mono truncate select-all">
                    {referralUrl}
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-kx-raised hover:bg-kx-raised text-kx-ink2 text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? (isEs ? 'Copiado' : 'Copied') : (isEs ? 'Copiar' : 'Copy')}
                </button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                    <button
                        onClick={handleShare}
                        className="p-2.5 rounded-lg bg-kx-surface hover:bg-kx-raised text-kx-ink2 hover:text-kx-ink transition-all"
                        aria-label="Share"
                    >
                        <Share2 size={14} />
                    </button>
                )}
            </div>

            {/* Stats placeholder — will be wired to backend later */}
            <div className="flex items-center justify-between pt-2 border-t border-kx-line">
                <p className="text-[11px] text-kx-ink3">
                    {isEs ? 'Tu código:' : 'Your code:'}{' '}
                    <span className="font-mono text-kx-ink2 font-bold">{refCode}</span>
                </p>
                <p className="text-[11px] text-kx-ink3">
                    {isEs ? '0 referidos · 0 meses ganados' : '0 referrals · 0 months earned'}
                </p>
            </div>
        </div>
    );
}
