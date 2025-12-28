import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { Wand2, ArrowLeft, Loader2, Plus, Music } from 'lucide-react';

const AIGenerator = () => {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('');
    const navigate = useNavigate();

    const [availableAIModels, setAvailableAIModels] = useState([]);

    const runDiagnostics = async () => {
        setLoading(true);
        setStatus('Running AI Diagnostics...');
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const data = await res.json();
            if (data.models) {
                const names = data.models.map(m => m.name.replace('models/', ''));
                setAvailableAIModels(names);
                console.log("Available Gemini Models:", names);
                alert(`✅ Diagnostics Complete!\n\nYour key is active. Found ${names.length} models.\n\nWorking models for your key:\n${names.slice(0, 10).join('\n')}\n...`);
            } else {
                throw new Error(data.error?.message || "No models returned. Your API key might be invalid or restricted.");
            }
        } catch (err) {
            setError(`Diagnostic Failed: ${err.message}`);
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    const fetchAIResponse = async (apiKey, prompt) => {
        const models = [
            { version: 'v1beta', id: 'gemini-2.5-flash' },
            { version: 'v1beta', id: 'gemini-2.0-flash' },
            { version: 'v1beta', id: 'gemini-flash-latest' },
            { version: 'v1beta', id: 'gemini-pro-latest' }
        ];

        let lastError = null;

        for (const model of models) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/${model.version}/models/${model.id}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `Generate a list of exactly 80 songs that match this vibe: "${prompt}". 
                                Return ONLY a JSON array of objects with "track" and "artist" keys. 
                                Format: [{"track": "Song Name", "artist": "Artist Name"}]`
                            }]
                        }]
                    })
                });

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                    return data;
                }
            } catch (err) {
                console.warn(`Model ${model.id} (${model.version}) failed:`, err.message);
                lastError = err.message;
            }
        }
        throw new Error(`AI Connection Failed. Last error: ${lastError}. Please ensure your API Key is valid for Gemini 1.5.`);
    };

    const generateAIPlaylist = async (e) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        setLoading(true);
        setError(null);
        setResults([]);
        setStatus('AI is brainstorming songs (trying stable models)...');

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('Gemini API Key is missing. Please add VITE_GEMINI_API_KEY to your environment variables.');
            }

            const data = await fetchAIResponse(apiKey, prompt);
            const textResponse = data.candidates[0].content.parts[0].text;

            // Extract JSON from potential markdown backticks
            const jsonMatch = textResponse.match(/\[.*\]/s);
            if (!jsonMatch) throw new Error("Could not parse AI response.");

            const aiSongs = JSON.parse(jsonMatch[0]);

            // 2. Search for each song on Spotify
            const spotifyResults = [];

            for (let i = 0; i < aiSongs.length; i++) {
                const item = aiSongs[i];
                setStatus(`Searching for songs (${i + 1}/${aiSongs.length})...`);

                const searchQ = encodeURIComponent(`track:${item.track} artist:${item.artist}`);
                const searchData = await spotifyFetch(`/search?q=${searchQ}&type=track&limit=1`);

                if (searchData?.tracks?.items?.length > 0) {
                    spotifyResults.push(searchData.tracks.items[0]);
                }
            }

            if (spotifyResults.length === 0) {
                throw new Error("No matching songs found on Spotify.");
            }

            setResults(spotifyResults);
            setStatus('');
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveAsPlaylist = async () => {
        setLoading(true);
        setStatus('Creating your playlist...');
        try {
            const me = await spotifyFetch('/me');
            const playlist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                name: `Magic: ${prompt.slice(0, 20)}...`,
                description: `AI generated playlist for prompt: ${prompt}`,
                public: false
            });

            const trackUris = results.map(t => t.uri);
            await spotifyFetch(`/playlists/${playlist.id}/tracks`, 'POST', {
                uris: trackUris
            });

            alert('Playlist created successfully!');
            navigate('/dashboard');
        } catch (err) {
            setError('Failed to save playlist.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 animate-fade-in">
            <button
                onClick={() => navigate('/dashboard')}
                className="hidden md:flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft className="mr-2" size={20} /> Back to Dashboard
            </button>

            <div className="max-w-2xl mx-auto text-center mb-12">
                <div className="inline-block p-3 bg-green-500/10 rounded-full mb-4">
                    <Wand2 className="text-green-500" size={32} />
                </div>
                <h1 className="text-4xl font-bold mb-4">AI Playlist Generator</h1>
                <p className="text-gray-400">Describe the mood, activity, or vibe, and let AI build your perfect soundtrack.</p>
            </div>

            <div className="max-w-xl mx-auto bg-[#181818] p-6 rounded-xl border border-neutral-800 shadow-2xl mb-8">
                <form onSubmit={generateAIPlaylist}>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g. 90s underground hip-hop for a rainy night in Tokyo"
                        className="w-full bg-black border border-neutral-700 rounded-lg p-4 text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all resize-none h-32 mb-4"
                    />
                    <button
                        type="submit"
                        disabled={loading || !prompt}
                        className="w-full py-4 bg-green-500 text-black font-bold rounded-full hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                        {loading ? 'Working Magic...' : 'Generate Playlist'}
                    </button>
                </form>
            </div>

            {status && <p className="text-center text-green-500 animate-pulse mb-8">{status}</p>}
            {error && (
                <div className="max-w-xl mx-auto mb-8 text-center">
                    <p className="text-red-500 mb-4 p-4 bg-red-500/10 rounded-lg">{error}</p>
                    <button
                        onClick={runDiagnostics}
                        className="text-xs text-neutral-500 hover:text-white underline transition-colors"
                    >
                        Run Connection Diagnostics
                    </button>
                    {availableAIModels.length > 0 && (
                        <div className="mt-4 p-4 bg-neutral-900 rounded-lg border border-neutral-800 text-left">
                            <p className="text-[10px] text-neutral-600 uppercase mb-2">Available Models for your Key:</p>
                            <div className="flex flex-wrap gap-2">
                                {availableAIModels.map(m => (
                                    <span key={m} className="text-[10px] bg-black px-2 py-1 rounded text-green-400 font-mono">{m}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {results.length > 0 && (
                <div className="max-w-4xl mx-auto space-y-4">
                    <div className="flex justify-between items-center bg-[#181818] p-6 rounded-xl border border-neutral-800">
                        <div>
                            <h2 className="text-xl font-bold">Suggested Tracks</h2>
                            <p className="text-sm text-gray-400">{results.length} songs brainstorming</p>
                        </div>
                        <button
                            onClick={saveAsPlaylist}
                            disabled={loading}
                            className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition-colors"
                        >
                            <Plus size={18} /> Save as Playlist
                        </button>
                    </div>

                    <div className="grid gap-2">
                        {results.map((track, index) => (
                            <div key={track.id} className="flex items-center gap-4 bg-[#121212]/50 p-2 rounded-lg hover:bg-[#181818] transition-colors group">
                                <span className="w-8 text-center text-gray-500">{index + 1}</span>
                                {track.album.images[0] ? (
                                    <img src={track.album.images[0].url} className="w-12 h-12 rounded shadow" alt="" />
                                ) : (
                                    <div className="w-12 h-12 bg-neutral-800 flex items-center justify-center rounded">
                                        <Music size={20} className="text-neutral-600" />
                                    </div>
                                )}
                                <div className="flex-1 truncate">
                                    <div className="font-bold truncate">{track.name}</div>
                                    <div className="text-sm text-gray-400 truncate">{track.artists.map(a => a.name).join(', ')}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIGenerator;
