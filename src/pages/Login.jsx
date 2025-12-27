import React from 'react';
import { redirectToAuthCodeFlow } from '../utils/spotify';

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
                    className="px-8 py-4 bg-green-500 text-black font-bold text-xl rounded-full hover:bg-green-400 transition-transform hover:scale-105"
                >
                    Connect with Spotify
                </button>
            </div>
        </div>
    );
};

export default Login;
