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
        setStatus('Executing AI Diagnostics...');
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const data = await res.json();
            if (data.models) {
                const names = data.models.map(m => m.name.replace('models/', ''));
                setAvailableAIModels(names);
                alert(`✅ SYSTEM DIAGNOSIS COMPLETE\n\nActive Nodes: ${names.length}\nPrimary Stream: Stable\nSecurity: Verified`);
            } else {
                throw new Error(data.error?.message || "Node handshake failed.");
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
                if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) return data;
            } catch (err) {
                lastError = err.message;
            }
        }
        throw new Error(`AI Connection Failed. Entropy check required.`);
    };

    const generateAIPlaylist = async (e) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        setLoading(true);
        setError(null);
        setResults([]);
        setStatus('AI Neural Brainstorming...');

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) throw new Error('API Key missing.');

            const data = await fetchAIResponse(apiKey, prompt);
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const jsonMatch = textResponse.match(/\[.*\]/s);
            if (!jsonMatch) throw new Error("Could not decompile response.");

            const aiSongs = JSON.parse(jsonMatch[0]);
            const spotifyResults = [];

            for (let i = 0; i < aiSongs.length; i++) {
                const item = aiSongs[i];
                setStatus(`Signal Mapping: ${i + 1}/${aiSongs.length}`);
                const searchQ = encodeURIComponent(`track:${item.track} artist:${item.artist}`);
                const searchData = await spotifyFetch(`/search?q=${searchQ}&type=track&limit=1`);
                if (searchData?.tracks?.items?.length > 0) spotifyResults.push(searchData.tracks.items[0]);
            }

            if (spotifyResults.length === 0) throw new Error("No signal found on Spotify.");
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
        setStatus('Creating Playlist...');
        try {
            const me = await spotifyFetch('/me');
            const playlist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                name: `MAGIC: ${prompt.slice(0, 15)}...`,
                description: `AI Generated Playlist: ${prompt}`,
                public: false
            });
            const trackUris = results.map(t => t.uri);
            await spotifyFetch(`/playlists/${playlist.id}/tracks`, 'POST', { uris: trackUris });
            navigate('/dashboard');
        } catch (err) {
            setError('Handshake failed during save.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="py-20  max-w-6xl mx-auto px-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full -z-10 animate-ios26-float" />

            <header className="mb-24">
                <button onClick={() => navigate('/dashboard')} className="mb-10 flex items-center text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Dashboard
                </button>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
                    <div className="max-w-2xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 ml-1">AI Assistant</p>
                        <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-white mb-8">
                            Magic
                        </h1>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto space-y-16">
                <div className="ios26-card p-6 md:p-12 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-blue-500/[0.02] -z-10" />
                    <form onSubmit={generateAIPlaylist} className="space-y-10">
                        <div className="relative">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g. 90s underground hip-hop for a rainy night in Tokyo..."
                                className="w-full bg-black/40 border border-white/10 rounded-[32px] p-6 md:p-8 text-lg md:text-xl font-black placeholder:text-white/10 focus:border-blue-500 focus:ring-0 outline-none transition-all resize-none h-48 shadow-inner uppercase tracking-widest leading-relaxed"
                            />
                            <div className="absolute top-8 right-8 text-white/5 pointer-events-none">
                                <Plus size={40} />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !prompt}
                            className="w-full py-6 ios26-liquid text-white font-black rounded-[28px] hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-4 shadow-2xl border border-white/20 uppercase tracking-[0.3em] text-[10px]"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />}
                            {loading ? 'Processing Logic' : 'Initiate Render'}
                        </button>
                    </form>
                </div>

                {status && (
                    <div className="text-center">
                        <p className="text-[9px] text-blue-500 font-black animate-pulse tracking-[0.4em] uppercase">{status}</p>
                    </div>
                )}

                {error && (
                    <div className="max-w-xl mx-auto text-center ios26-glass p-8 rounded-[32px] border border-red-500/20">
                        <p className="text-red-500 font-black uppercase tracking-[0.2em] text-[10px] mb-4">{error}</p>
                        <button onClick={runDiagnostics} className="text-[8px] text-white/20 hover:text-white uppercase font-black tracking-widest underline transition-colors">
                            Bypass Security / Diagnostics
                        </button>
                    </div>
                )}

                {results.length > 0 && (
                    <div className="space-y-12  pb-32">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-b border-white/5 pb-12">
                            <div>
                                <h2 className="text-4xl font-black tracking-tighter uppercase text-white leading-none">Suggested Signal</h2>
                                <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-2">{results.length} Neural Matches Detected</p>
                            </div>
                            <button
                                onClick={saveAsPlaylist}
                                disabled={loading}
                                className="flex items-center gap-4 ios26-liquid text-white px-10 py-5 rounded-[22px] font-black hover:scale-105 transition-all shadow-2xl uppercase tracking-[0.2em] text-[10px] border border-white/10"
                            >
                                <Plus size={18} strokeWidth={3} /> Save Archive
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {results.map((track, index) => (
                                <div key={track.id} className="ios26-card-interactive p-5 flex items-center gap-6 group">
                                    <span className="w-8 text-center text-white/20 font-black text-[10px]">{String(index + 1).padStart(2, '0')}</span>
                                    <div className="w-16 h-16 rounded-[24px] overflow-hidden shadow-2xl ring-1 ring-white/10 group-hover:scale-110 transition-all duration-700">
                                        {track.album.images[0] ? (
                                            <img src={track.album.images[0].url} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" alt="" />
                                        ) : (
                                            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                                <Music size={24} className="text-white/20" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-black truncate text-sm tracking-tighter uppercase text-white group-hover:text-blue-500 transition-colors mb-1">{track.name}</div>
                                        <div className="text-[9px] text-white/30 font-black truncate tracking-widest uppercase opacity-80">{track.artists.map(a => a.name).join(', ')}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIGenerator;
