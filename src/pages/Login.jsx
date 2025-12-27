import { redirectToAuthCodeFlow, REDIRECT_URI } from '../utils/spotify';

const Login = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
            <div className="text-center max-w-md">
                <h1 className="text-5xl font-bold mb-6 text-green-500 tracking-tighter">Spotify Discovery</h1>
                <p className="text-gray-400 mb-10 text-lg">
                    Connect your account to find new music based on your unique playlists.
                    We check against your library to ensure every recommendation is brand new to you.
                </p>
                <button
                    onClick={redirectToAuthCodeFlow}
                    className="px-8 py-4 bg-green-500 text-black font-bold text-xl rounded-full hover:bg-green-400 transition-transform hover:scale-105 mb-8"
                >
                    Connect with Spotify
                </button>

                {/* Hidden Debug Box - Preserving working state logic */}
                <div className="hidden mt-8 p-4 bg-neutral-900/50 rounded-lg border border-neutral-800">
                    <p className="text-xs text-neutral-500 mb-2 uppercase tracking-widest font-bold">Whitelisted URI</p>
                    <code className="text-green-400 text-xs block break-all font-mono">
                        {REDIRECT_URI}
                    </code>
                </div>
            </div>
        </div>
    );
};

export default Login;
