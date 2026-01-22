import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                        <AlertTriangle className="text-red-500" size={40} />
                    </div>
                    <h1 className="text-3xl font-black mb-4">Something went wrong</h1>
                    <p className="text-white/50 mb-8 max-w-md">
                        The application encountered a critical error. We've logged it for investigation.
                    </p>

                    <div className="bg-white/5 p-4 rounded-xl mb-8 max-w-full overflow-auto text-left w-full md:w-96">
                        <p className="text-red-400 font-mono text-xs mb-2">Error Details:</p>
                        <code className="text-[10px] text-white/70 font-mono block whitespace-pre-wrap">
                            {this.state.error && this.state.error.toString()}
                        </code>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform flex items-center gap-2"
                    >
                        <RefreshCw size={18} />
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
