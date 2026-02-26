import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthContext';

const DEMO_WELCOME_KEY = 'korex-demo-welcome-shown';

/**
 * One-time welcome popup when entering Demo Mode.
 * Explains the purpose and limitations of the demo sandbox.
 */
export default function DemoWelcomeModal() {
    const { isDemo } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!isDemo) return;
        // Show only once per demo session
        const alreadyShown = sessionStorage.getItem(DEMO_WELCOME_KEY);
        if (!alreadyShown) {
            setIsOpen(true);
            sessionStorage.setItem(DEMO_WELCOME_KEY, 'true');
        }
    }, [isDemo]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={() => setIsOpen(false)}
            />

            {/* Modal Card */}
            <div className="relative z-10 w-full max-w-md animate-in zoom-in-95 slide-in-from-bottom-4 duration-400">
                <div className="bg-[#0f0f0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header accent bar */}
                    <div className="h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />

                    <div className="p-6">
                        {/* Icon + Title */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Demo Mode</h2>
                                <p className="text-xs text-gray-400">Sandbox environment</p>
                            </div>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-gray-300 leading-relaxed mb-4">
                            Welcome! You're exploring <span className="text-amber-400 font-medium">KoreX</span> with pre-loaded
                            financial data from a fictional profile. This demo showcases the platform's
                            full capabilities:
                        </p>

                        {/* Features list */}
                        <div className="space-y-2 mb-5">
                            {[
                                { icon: '📊', text: 'Velocity Banking dashboard & projections' },
                                { icon: '🎯', text: 'Debt attack strategy & action plans' },
                                { icon: '🗓️', text: 'Cashflow heat map & scheduling' },
                                { icon: '📈', text: 'Freedom counter & savings calculator' },
                            ].map(({ icon, text }) => (
                                <div key={text} className="flex items-center gap-2.5 text-sm text-gray-400">
                                    <span className="text-base">{icon}</span>
                                    <span>{text}</span>
                                </div>
                            ))}
                        </div>

                        {/* Disclaimer */}
                        <div className="rounded-lg bg-neutral-800/60 border border-neutral-700/50 px-3 py-2.5 mb-5">
                            <p className="text-xs text-gray-500 leading-relaxed">
                                <span className="text-gray-400 font-medium">Note:</span> Changes in demo mode are temporary
                                and reset after logout. Create an account to save your own financial data securely.
                            </p>
                        </div>

                        {/* CTA Button */}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300
                                bg-gradient-to-r from-amber-500 to-amber-600 text-white
                                hover:from-amber-400 hover:to-amber-500 hover:shadow-lg hover:shadow-amber-500/25
                                active:scale-[0.98]"
                        >
                            Explore the Demo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
