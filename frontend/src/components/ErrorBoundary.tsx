import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white h-screen overflow-auto">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong.</h1>
                    <div className="mb-4">
                        <h2 className="text-xl font-semibold">Error:</h2>
                        <pre className="mt-2 p-4 bg-gray-100 dark:bg-zinc-900 rounded text-red-500 dark:text-red-300 whitespace-pre-wrap">
                            {this.state.error?.toString()}
                        </pre>
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">Location:</h2>
                        <div className="mt-2 text-zinc-400 text-sm">
                            Check the console for the full stack trace.
                        </div>
                        <pre className="mt-2 p-4 bg-gray-100 dark:bg-zinc-900 rounded text-gray-500 dark:text-zinc-500 whitespace-pre-wrap text-xs overflow-x-auto">
                            {this.state.errorInfo?.componentStack}
                        </pre>
                    </div>
                    <button
                        className="mt-6 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 font-medium"
                        onClick={() => window.location.reload()}
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
