import React from 'react';
import { Music } from 'lucide-react';
import { redirectToAuthCodeFlow } from '../utils/spotify';

const Login = () => {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Atmosphere */}
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-500/10 blur-[150px] rounded-full -z-10 animate-ios26-float" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full -z-10 animate-ios26-float-slow" />

            <div className="text-center max-w-xl relative z-10 animate-ios26-in">
                <div className="ios26-card p-16 md:p-24 border-white/10 shadow-[0_64px_128px_-32px_rgba(0,0,0,0.9)] bg-white/[0.03]">
                    <div className="flex justify-center mb-16">
                        <div className="w-24 h-24 ios26-liquid rounded-[36px] flex items-center justify-center border border-white/20 shadow-2xl">
                            <Music size={48} className="text-white" />
                        </div>
                    </div>

                    <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-white mb-6 uppercase leading-none">
                        Statsify <br /><span className="text-blue-500">Pro</span>
                    </h1>

                    <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.5em] mb-16 leading-relaxed">
                        Authentication Required <br />
                        <span className="opacity-50">Secure Spotify Connection</span>
                    </p>

                    <button
                        onClick={redirectToAuthCodeFlow}
                        className="ios26-liquid block w-full py-7 text-sm font-black uppercase tracking-[0.4em] text-white rounded-[28px] shadow-2xl border border-white/20 active:scale-95 transition-all hover:scale-[1.03]"
                    >
                        Login with Spotify
                    </button>
                </div>

                <div className="mt-16 flex flex-col items-center gap-4 opacity-30">
                    <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white">Handcrafted for Music Lovers</p>
                    <div className="w-12 h-[1px] bg-white/20" />
                </div>
            </div>
        </div>
    );
};

export default Login;
