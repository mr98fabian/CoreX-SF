import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function NotFoundPage() {
    usePageTitle('404');

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[120px]" />
            </div>

            {/* Raccoon mascot */}
            <div className="relative z-10 mb-8 animate-bounce-slow">
                <img
                    src="/korex-icon.png"
                    alt="KoreX Raccoon"
                    className="h-32 mx-auto opacity-60 drop-shadow-[0_0_40px_rgba(251,191,36,0.2)]"
                />
            </div>

            {/* 404 number */}
            <h1 className="relative z-10 text-[120px] sm:text-[160px] font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-300 to-slate-700 leading-none tracking-tighter">
                404
            </h1>

            {/* Message */}
            <p className="relative z-10 text-slate-400 text-lg mt-4 max-w-md">
                The raccoon searched everywhere, but this page doesn't exist.
            </p>
            <p className="relative z-10 text-slate-500 text-sm mt-2">
                Maybe it was moved, deleted, or never existed in the first place.
            </p>

            {/* Actions */}
            <div className="relative z-10 flex gap-4 mt-10">
                <Link
                    to="/"
                    className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all duration-300 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
                >
                    Go to Dashboard
                </Link>
                <button
                    onClick={() => window.history.back()}
                    className="px-6 py-3 bg-slate-800/60 text-slate-300 font-medium rounded-lg border border-slate-700/50 hover:bg-slate-700/60 hover:text-white transition-all duration-300"
                >
                    Go Back
                </button>
            </div>

            {/* Footer brand */}
            <div className="absolute bottom-8 z-10">
                <img
                    src="/korex-logotipo.png"
                    alt="KoreX"
                    className="h-5 opacity-20"
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
