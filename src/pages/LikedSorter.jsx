import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Wand2, Loader2, CheckCircle, Plus, Music, ShieldCheck, ListMusic, Zap } from 'lucide-react';

const LikedSorter = () => {
    const navigate = useNavigate();
    const [likedSongs, setLikedSongs] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [suggestions, setSuggestions] = useState({}); // { playlistId: [trackUris] }
    const [processedPlaylists, setProcessedPlaylists] = useState(new Set());

    useEffect(() => {
        init();
    }, []);

    const init = async () => {
        setLoading(true);
        setStatus('Initializing Frequency Channels...');
        try {
            const me = await spotifyFetch('/me');

            // 1. Fetch all liked tracks with pagination
            let allTracks = [];
            let nextUrl = '/me/tracks?limit=50';
            let total = 0;

            while (nextUrl) {
                const res = await spotifyFetch(nextUrl.replace('https://api.spotify.com/v1', ''));
                if (res?.items) {
                    allTracks = [...allTracks, ...res.items.map(i => i.track)];
                    total = res.total;
                    nextUrl = res.next;
                    setStatus(`Syncing Logic: ${allTracks.length} / ${total} Units`);
                } else {
                    nextUrl = null;
                }
            }
            setLikedSongs(allTracks);

            // 2. Fetch all playlists
            let allPlaylists = [];
            let nextPlaylistUrl = '/me/playlists?limit=50';
            while (nextPlaylistUrl) {
                const res = await spotifyFetch(nextPlaylistUrl.replace('https://api.spotify.com/v1', ''));
                if (res?.items) {
                    allPlaylists = [...allPlaylists, ...res.items];
                    nextPlaylistUrl = res.next;
                } else {
                    nextPlaylistUrl = null;
                }
            }

            const ownedPlaylists = allPlaylists.filter(p => p.owner.id === me.id);
            setPlaylists(ownedPlaylists);

            setStatus('Standing By.');
        } catch (err) {
            console.error(err);
            setStatus('Initialization Failure.');
        } finally {
            setLoading(false);
        }
    };

    const fetchAIResponse = async (apiKey, prompt) => {
        const models = [
            { version: 'v1beta', id: 'gemini-2.5-flash' },
            { version: 'v1beta', id: 'gemini-2.0-flash' },
            { version: 'v1beta', id: 'gemini-flash-latest' },
            { version: 'v1beta', id: 'gemini-pro-latest' }
        ];

        for (const model of models) {
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/${model.version}/models/${model.id}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }]
                    })
                });

                const data = await res.json();
                if (data.error) throw new Error(data.error.message);
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) return text;
            } catch (err) {
                console.warn(`Model ${model.id} failed:`, err.message);
            }
        }
        throw new Error(`All AI models failed.`);
    };

    const runCategorization = async () => {
        setAiLoading(true);
        setStatus('Synthesizing Acoustic Logic...');
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            setStatus('API Key Missing.');
            setAiLoading(false);
            return;
        }

        try {
            const batchSize = 100;
            const allSuggestions = {};
            const totalBatches = Math.ceil(likedSongs.length / batchSize);

            for (let i = 0; i < likedSongs.length; i += batchSize) {
                const batchNum = Math.floor(i / batchSize) + 1;
                setStatus(`Synthesizing Logic: Batch ${batchNum} / ${totalBatches}...`);

                const batch = likedSongs.slice(i, i + batchSize);
                const tracksList = batch.map(t => ({ id: t.uri, name: t.name, artist: t.artists[0]?.name }));
                const playlistsList = playlists.map(p => ({ id: p.id, name: p.name, description: p.description }));

                const prompt = `
                    I have a list of my "Liked Songs" (subset) and a list of my "Playlists" from Spotify.
                    I want you to suggest which playlist each song should be added to based on its genre, mood, or artist.
                    Only suggest a playlist if it's a good match.
                    
                    Songs:
                    ${JSON.stringify(tracksList)}

                    Playlists:
                    ${JSON.stringify(playlistsList)}

                    Return ONLY a JSON object where the keys are Playlist IDs and the values are arrays of Song URIs.
                    Example: {"playlistId1": ["spotify:track:123", "spotify:track:456"], "playlistId2": ["spotify:track:789"]}
                    If no match, return an empty object.
                `;

                const response = await fetchAIResponse(apiKey, prompt);
                const jsonStr = response.replace(/```json|```/g, '').trim();
                const mapping = JSON.parse(jsonStr);

                // Merge results
                Object.entries(mapping).forEach(([playlistId, uris]) => {
                    if (!allSuggestions[playlistId]) allSuggestions[playlistId] = [];
                    allSuggestions[playlistId] = [...allSuggestions[playlistId], ...uris];
                });
            }

            setSuggestions(allSuggestions);
            setStatus('Logic Rendered.');
        } catch (err) {
            console.error(err);
            setStatus('Categorization Protocol Failed.');
        } finally {
            setAiLoading(false);
        }
    };

    const commitPlaylist = async (playlistId, uris) => {
        setStatus(`Fusing Signals into ${playlists.find(p => p.id === playlistId)?.name}...`);
        try {
            // Add in chunks of 50 to be safe
            for (let i = 0; i < uris.length; i += 50) {
                const chunk = uris.slice(i, i + 50);
                await spotifyFetch(`/playlists/${playlistId}/tracks`, 'POST', { uris: chunk });
            }
            setProcessedPlaylists(prev => new Set(prev).add(playlistId));
            setStatus('Fusion Successful.');
        } catch (err) {
            console.error(err);
            setStatus('Fusion Failed.');
        }
    };

    return (
        <div className="py-20 animate-ios26-in max-w-6xl mx-auto px-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full -z-10 animate-ios26-float" />

            <header className="mb-24">
                <button onClick={() => navigate('/dashboard')} className="mb-10 flex items-center text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Index
                </button>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 ml-1">AI Library Sorting</p>
                        <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-white">
                            Signal Sorter
                        </h1>
                    </div>
                </div>
            </header>

            {!likedSongs.length || !playlists.length ? (
                <div className="ios26-card p-24 text-center">
                    <Loader2 className="animate-spin text-blue-500 mx-auto mb-10" size={48} />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">{status || 'Synchronizing Data...'}</p>
                </div>
            ) : (
                <div className="space-y-16">
                    <div className="ios26-card p-12 md:p-16 text-center flex flex-col items-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-blue-500/[0.02] -z-10 group-hover:scale-110 transition-transform duration-1000" />
                        <div className="w-24 h-24 ios26-liquid rounded-[36px] flex items-center justify-center mb-10 border border-white/20 shadow-2xl">
                            <Wand2 size={44} className="text-blue-500" strokeWidth={1} />
                        </div>
                        <h2 className="text-5xl font-black mb-4 tracking-tighter uppercase text-white">Logic Scan</h2>
                        <p className="text-[10px] text-white/30 mb-12 max-w-md font-black uppercase tracking-[0.3em] leading-relaxed">
                            Analyze your recent {likedSongs.length} liked tracks and find their target destinations within your {playlists.length} active playlists.
                        </p>
                        <button
                            onClick={runCategorization}
                            disabled={aiLoading}
                            className="ios26-liquid px-16 py-6 font-black uppercase tracking-[0.3em] text-[10px] text-white border border-white/20 shadow-2xl hover:scale-105 active:scale-95 transition-all"
                        >
                            {aiLoading ? <Loader2 className="animate-spin" size={20} /> : 'Initiate Scan'}
                        </button>
                        {status && <p className="mt-8 text-[9px] font-black text-blue-500 uppercase tracking-[0.4em] animate-pulse">{status}</p>}
                    </div>

                    {Object.keys(suggestions).length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {Object.entries(suggestions).map(([playlistId, uris]) => {
                                const playlist = playlists.find(p => p.id === playlistId);
                                if (!playlist) return null;
                                const isDone = processedPlaylists.has(playlistId);

                                return (
                                    <div key={playlistId} className={`ios26-card p-8 group transition-all duration-500 ${isDone ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                        <div className="flex items-center gap-6 mb-8">
                                            <div className="w-16 h-16 rounded-[24px] overflow-hidden ring-1 ring-white/10 shadow-2xl shrink-0">
                                                {playlist.images?.[0]?.url ? (
                                                    <img src={playlist.images[0].url} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-full h-full bg-white/5 flex items-center justify-center"><Music size={24} className="text-white/10" /></div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-black text-white uppercase text-sm truncate tracking-tighter">{playlist.name}</h3>
                                                <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest mt-1">{uris.length} New Signals</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3 mb-10 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                            {uris.map(uri => {
                                                const track = likedSongs.find(t => t.uri === uri);
                                                return track ? (
                                                    <div key={uri} className="flex items-center gap-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                                                        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                                            <img src={track.album.images[2]?.url} className="w-full h-full object-cover" alt="" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[10px] text-white font-black uppercase truncate">{track.name}</p>
                                                            <p className="text-[8px] text-white/30 font-black uppercase truncate">{track.artists[0].name}</p>
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })}
                                        </div>

                                        <button
                                            onClick={() => commitPlaylist(playlistId, uris)}
                                            className={`w-full py-4 rounded-[20px] font-black uppercase tracking-[0.3em] text-[10px] transition-all flex items-center justify-center gap-3 ${isDone ? 'bg-green-500/20 text-green-500' : 'ios26-liquid text-white border border-white/10 hover:scale-[1.02]'
                                                }`}
                                        >
                                            {isDone ? <CheckCircle size={14} /> : <Zap size={14} />}
                                            {isDone ? 'Logic Synced' : 'Commit Fusion'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LikedSorter;
