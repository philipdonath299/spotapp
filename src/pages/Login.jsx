import { redirectToAuthCodeFlow, REDIRECT_URI } from '../utils/spotify';

const Login = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/20 blur-[120px] rounded-full animate-pulse" />

            <div className="text-center max-w-xl relative z-10 animate-apple-in">
                <div className="apple-glass p-12 md:p-20 rounded-[48px] border border-white/15 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                    <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter leading-none uppercase bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
                        Statsify
                    </h1>
                    <p className="text-gray-400 mb-14 text-xl font-bold tracking-tight leading-relaxed max-w-md mx-auto">
                        Connect your digital footprint to architect the perfect audio ecosystem.
                    </p>
                    <button
                        onClick={redirectToAuthCodeFlow}
                        className="apple-button-primary w-full py-6 text-xl font-black uppercase tracking-[0.2em] shadow-[0_24px_48px_-12px_rgba(59,130,246,0.5)] active:scale-95 transition-all"
                    >
                        Initiate Link
                    </button>
                </div>

                {/* Hidden Debug Box - Preserving working state logic */}
                <div className="hidden mt-12 p-6 apple-glass rounded-[24px] border border-white/10 opacity-50">
                    <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-[0.3em] font-black">Secure Tunnel</p>
                    <code className="text-blue-400 text-xs block break-all font-mono font-bold tracking-tighter">
                        {REDIRECT_URI}
                    </code>
                </div>
            </div>
        </div>
    );
};

export default Login;
