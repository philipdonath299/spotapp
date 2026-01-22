import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken } from '../utils/spotify';

const Callback = () => {
    const navigate = useNavigate();
    const [debugInfo, setDebugInfo] = React.useState("");

    const effectRan = React.useRef(false);

    useEffect(() => {
        if (effectRan.current) return;

        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            effectRan.current = true; // Mark as ran
            getAccessToken(code).then((data) => {
                if (data.access_token) {
                    navigate('/dashboard');
                } else {
                    console.error("Auth failed", data);
                    setDebugInfo(JSON.stringify(data, null, 2));
                    // Check if verifier exists
                    const verifier = localStorage.getItem("verifier");
                    if (!verifier) {
                        setDebugInfo(prev => prev + "\nError: No code_verifier found in localStorage.");
                    }
                }
            }).catch(err => {
                setDebugInfo("Fetch error: " + err.message);
            });
        }
    }, [navigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8">
            <h2 className="text-2xl animate-pulse mb-4">Authenticating...</h2>
            {debugInfo && (
                <div className="bg-red-900 p-4 rounded border border-red-500 max-w-2xl w-full overflow-auto">
                    <h3 className="font-bold text-red-200 mb-2">Authentication Failed</h3>
                    <pre className="text-xs font-mono whitespace-pre-wrap text-red-100">
                        {debugInfo}
                    </pre>
                    <p className="mt-4 text-sm text-gray-300">
                        Please verify your Redirect URI in Spotify Dashboard matches EXACTLY: <br />
                        <code className="bg-black p-1 rounded">{import.meta.env.VITE_REDIRECT_URI}</code>
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="mt-6 px-4 py-2 bg-white text-black rounded hover:bg-gray-200"
                    >
                        Return to Login
                    </button>
                </div>
            )}
        </div>
    );
};

export default Callback;
