import { useEffect, useState } from 'react';

/**
 * KoreX branded loading screen — shown during initial app load.
 * Features the Isologo with a pulse animation and a progress bar.
 */
export default function LoadingScreen() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(timer);
                    return 100;
                }
                // Accelerate near the end for a snappy feel
                const increment = prev < 60 ? 3 : prev < 85 ? 2 : 1;
                return Math.min(prev + increment, 100);
            });
        }, 30);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center">
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[100px] animate-pulse" />
            </div>

            {/* Logo with pulse */}
            <div className="relative z-10 animate-logo-pulse">
                <img
                    src="/korex-imagotipo.svg"
                    alt="KoreX"
                    className="h-24 drop-shadow-[0_0_30px_rgba(251,191,36,0.3)]"
                />
            </div>

            {/* Progress bar */}
            <div className="relative z-10 mt-8 w-48">
                <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-100 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Status text */}
            <p className="relative z-10 text-slate-500 text-xs mt-4 font-mono tracking-wider">
                {progress < 20
                    ? 'Initializing KoreX Intelligence Engine...'
                    : progress < 40
                        ? 'Scanning financial landscape...'
                        : progress < 60
                            ? 'Calculating your attack vectors...'
                            : progress < 80
                                ? 'Preparing your command dashboard...'
                                : progress < 95
                                    ? 'Deploying strategic defenses...'
                                    : '⚡ Ready, Commander'}
            </p>

            {/* Animations */}
            <style>{`
                @keyframes logo-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(0.97); }
                }
                .animate-logo-pulse {
                    animation: logo-pulse 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
