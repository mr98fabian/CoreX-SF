import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useLanguage } from '@/contexts/LanguageContext';
import { NOT_FOUND_COPY } from './notFoundCopy';

export default function NotFoundPage() {
    const { language } = useLanguage();
    const c = NOT_FOUND_COPY[language === 'en' ? 'en' : 'es'];
    usePageTitle(c.title);

    return (
        <div className="kx-scope min-h-screen flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[color-mix(in_srgb,var(--kx-amber)_5%,transparent)] rounded-full blur-[120px]" />
            </div>

            {/* Raccoon mascot */}
            <div className="relative z-10 mb-8 animate-bounce-slow">
                <img
                    src="/korex-isotipo.svg"
                    alt={c.mascotAlt}
                    className="kx-logo h-32 mx-auto opacity-60 drop-shadow-[0_0_40px_rgba(251,191,36,0.2)]"
                />
            </div>

            {/* 404 number */}
            <h1 className="relative z-10 text-[120px] sm:text-[160px] font-black text-kx-amber leading-none tracking-tighter">
                404
            </h1>

            {/* Message */}
            <p className="relative z-10 text-kx-ink2 text-lg mt-4 max-w-md">
                {c.lead}
            </p>
            <p className="relative z-10 text-kx-ink3 text-sm mt-2">
                {c.hint}
            </p>

            {/* Actions */}
            <div className="relative z-10 flex gap-4 mt-10">
                <Link
                    to="/"
                    className="px-6 py-3 bg-kx-amber text-kx-on-amber font-semibold rounded-lg transition-all duration-300 shadow-lg "
                >
                    {c.home}
                </Link>
                <button
                    onClick={() => window.history.back()}
                    className="px-6 py-3 bg-kx-raised text-kx-ink2 font-medium rounded-lg border border-kx-line hover:bg-kx-raised hover:text-kx-ink transition-all duration-300"
                >
                    {c.back}
                </button>
            </div>

            {/* Footer brand */}
            <div className="absolute bottom-8 z-10">
                <img
                    src="/korex-logotipo.svg"
                    alt="KoreX"
                    className="kx-logo h-5 opacity-20"
                />
            </div>

            {/* CSS for custom animation */}
            <style>{`
 @keyframes bounce-slow {
 0%, 100% { transform: translateY(0); }
 50% { transform: translateY(-12px); }
 }
 .animate-bounce-slow {
 animation: bounce-slow 3s ease-in-out infinite;
 }
 `}</style>
        </div>
    );
}
