import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Global error boundary — catches unhandled React render errors
 * and shows a branded fallback UI instead of a blank white screen.
 *
 * Must be a class component: React does not support error boundaries
 * via hooks (as of React 19).
 */
export default class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // Log to console with actionable context for debugging
        console.error(
            '[ErrorBoundary] Uncaught render error:',
            error,
            '\nComponent stack:',
            info.componentStack
        );
    }

    private handleReload = () => {
        window.location.href = '/';
    };

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-[120px]" />
                </div>

                {/* Raccoon mascot */}
                <div className="relative z-10 mb-8">
                    <img
                        src="/korex-isotipo.svg"
                        alt="KoreX"
                        className="h-24 mx-auto opacity-50 drop-shadow-[0_0_40px_rgba(239,68,68,0.2)]"
                    />
                </div>

                {/* Error icon */}
                <div className="relative z-10 mb-4">
                    <svg
                        className="w-16 h-16 text-red-400/60 mx-auto"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="1.5"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                        />
                    </svg>
                </div>

                {/* Title */}
                <h1 className="relative z-10 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-3">
                    Algo salió mal
                </h1>

                {/* Message */}
                <p className="relative z-10 text-slate-400 text-base max-w-md mb-2">
                    La aplicación encontró un error inesperado. Tu información está segura.
                </p>
                <p className="relative z-10 text-slate-500 text-sm max-w-md">
                    Intenta recargar la página. Si el problema persiste, contacta soporte.
                </p>

                {/* Error details (dev-friendly, collapsed) */}
                {this.state.error && (
                    <details className="relative z-10 mt-6 max-w-lg w-full text-left">
                        <summary className="text-xs text-slate-600 cursor-pointer hover:text-slate-400 transition-colors">
                            Detalles técnicos
                        </summary>
                        <pre className="mt-2 p-3 bg-slate-100 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-red-400/80 overflow-x-auto whitespace-pre-wrap break-words">
                            {this.state.error.message}
                        </pre>
                    </details>
                )}

                {/* Actions */}
                <div className="relative z-10 flex gap-4 mt-8">
                    <button
                        onClick={this.handleReload}
                        className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold rounded-lg hover:from-amber-400 hover:to-orange-400 transition-all duration-300 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
                    >
                        Ir al Inicio
                    </button>
                    <button
                        onClick={this.handleRetry}
                        className="px-6 py-3 bg-slate-200 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-medium rounded-lg border border-slate-300 dark:border-slate-700/50 hover:bg-slate-300 dark:hover:bg-slate-700/60 hover:text-slate-900 dark:hover:text-white transition-all duration-300"
                    >
                        Reintentar
                    </button>
                </div>

                {/* Footer brand */}
                <div className="absolute bottom-8 z-10">
                    <img
                        src="/korex-logotipo.svg"
                        alt="KoreX"
                        className="h-5 opacity-20"
                    />
                </div>
            </div>
        );
    }
}
