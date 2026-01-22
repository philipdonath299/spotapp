import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Edit3, Wand2, Loader2, Save, X, CheckCircle, Sparkles, Music, BarChart3, Scissors, Merge, Copy, ArrowUpDown, UserX, Trash } from 'lucide-react';

const PlaylistManager = () => {
    const navigate = useNavigate();
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [view, setView] = useState('list'); // 'list' | 'editor'
    const [activeTab, setActiveTab] = useState('details'); // 'details' | 'tools' | 'split' | 'merge'

    // Editor State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [status, setStatus] = useState('');

    // Split State
    const [splitSize, setSplitSize] = useState(50);

    // Merge State
    const [selectedMergePlaylists, setSelectedMergePlaylists] = useState(new Set());

    // Artist Cleanup State
    const [topArtists, setTopArtists] = useState([]);

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const fetchPlaylists = async () => {
        try {
            const data = await spotifyFetch('/me/playlists?limit=50');
            if (data?.items) setPlaylists(data.items);
        } catch (err) {
            console.error("Failed to fetch playlists");
        }
    };

    const handleSelect = (playlist) => {
        setSelectedPlaylist(playlist);
        setName(playlist.name);
        setDescription(playlist.description || '');
        setView('editor');
        setActiveTab('details');
        setStatus('');
        setSelectedMergePlaylists(new Set()); // Reset merge selection
        setTopArtists([]); // Reset artist scan
    };

    const handleUpdateDetails = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus('');
        try {
            await spotifyFetch(`/playlists/${selectedPlaylist.id}`, 'PUT', { name, description });
            setStatus('Handshake Success.');
            fetchPlaylists(); // Refresh list data
        } catch (err) {
            setStatus('Protocol Failure.');
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

        let lastError = null;

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
                lastError = err.message;
            }
        }
        throw new Error(`All AI models failed. Last error: ${lastError}`);
    };

    const generateAIDescription = async () => {
        setAiLoading(true);
        setStatus("Analyzing Acoustic Signature...");
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            setStatus("API Key Missing.");
            setAiLoading(false);
            return;
        }
        try {
            const tracksData = await spotifyFetch(`/playlists/${selectedPlaylist.id}/tracks?limit=20`);
            const tracks = tracksData.items
                .filter(item => item.track)
                .map(i => `${i.track.name} by ${i.track.artists[0]?.name || 'Unknown'}`)
                .join(', ');

            const prompt = `Write a creative, catchy, and short description (max 150 chars) for a Spotify playlist named "${selectedPlaylist.name}" that contains these songs: ${tracks}. Do NOT use quotes.`;

            const aiText = await fetchAIResponse(apiKey, prompt);

            setDescription(aiText.replace(/^["']|["']$/g, ''));
            setStatus("Logic Rendered.");

        } catch (err) {
            console.error("AI Error:", err);
            setStatus(`Logic Error.`);
        } finally {
            setAiLoading(false);
        }
    };

    // --- TOOLS: SHUFFLE, SORT, SPLIT, MERGE ---

    const fetchTracksForPlaylist = async (playlistId) => {
        let allTracks = [];
        let nextUrl = `/playlists/${playlistId}/tracks?limit=100`;
        while (nextUrl) {
            const res = await spotifyFetch(nextUrl.replace('https://api.spotify.com/v1', ''));
            if (res?.items) {
                allTracks = [...allTracks, ...res.items];
                nextUrl = res.next;
            } else {
                nextUrl = null;
            }
        }
        return allTracks.filter(t => t.track && !t.is_local);
    };

    const replaceTracks = async (newTrackUris) => {
        setStatus('Rearranging Signal...');

        const chunks = [];
        for (let i = 0; i < newTrackUris.length; i += 100) {
            chunks.push(newTrackUris.slice(i, i + 100));
        }

        if (chunks.length === 0) {
            await spotifyFetch(`/playlists/${selectedPlaylist.id}/tracks`, 'PUT', { uris: [] });
            return;
        }

        await spotifyFetch(`/playlists/${selectedPlaylist.id}/tracks`, 'PUT', { uris: chunks[0] });

        for (let i = 1; i < chunks.length; i++) {
            await spotifyFetch(`/playlists/${selectedPlaylist.id}/tracks`, 'POST', { uris: chunks[i] });
        }

        setStatus('Sequence Optimized.');
    };

    const handleTrueShuffle = async () => {
        setLoading(true);
        setStatus('Entropy Generation...');
        try {
            const tracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            for (let i = tracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
            }
            const uris = tracks.map(t => t.track.uri);
            await replaceTracks(uris);
        } catch (err) {
            setStatus('Chaos Failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleSmartSort = async (criteria) => {
        setLoading(true);
        setStatus('Sonic Decomposition...');
        try {
            const tracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            setStatus('Sonic Decomposition...');

            const ids = tracks.map(t => t.track.id).filter(Boolean);
            const featureMap = {};

            for (let i = 0; i < ids.length; i += 100) {
                const chunk = ids.slice(i, i + 100);
                const res = await spotifyFetch(`/audio-features?ids=${chunk.join(',')}`);
                if (res.audio_features) {
                    res.audio_features.forEach(f => {
                        if (f) featureMap[f.id] = f;
                    });
                }
            }

            tracks.sort((a, b) => {
                const featA = featureMap[a.track.id];
                const featB = featureMap[b.track.id];
                if (!featA && !featB) return 0;
                if (!featA) return 1;
                if (!featB) return -1;

                if (criteria === 'energy') return featB.energy - featA.energy;
                if (criteria === 'danceability') return featB.danceability - featA.danceability;
                if (criteria === 'tempo') return featB.tempo - featA.tempo;
                if (criteria === 'valence') return featB.valence - featA.valence;
                return 0;
            });

            const uris = tracks.map(t => t.track.uri);
            await replaceTracks(uris);
        } catch (err) {
            setStatus('Sort Failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleSplitPlaylist = async () => {
        if (splitSize < 5) {
            setStatus('Underflow Error.');
            return;
        }
        setLoading(true);
        setStatus('Fissioning Stream...');
        try {
            const allTracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            const totalParts = Math.ceil(allTracks.length / splitSize);
            const me = await spotifyFetch('/me');

            setStatus('Protocol Engaged.');

            for (let i = 0; i < totalParts; i++) {
                const chunk = allTracks.slice(i * splitSize, (i + 1) * splitSize);
                const uris = chunk.map(t => t.track.uri);

                const newPlaylist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                    name: `${selectedPlaylist.name} [DECOUPLED ${i + 1}]`,
                    description: `Automated Logic Render. Part ${i + 1} of ${selectedPlaylist.name}.`,
                    public: false
                });

                // Add in chunks of 100
                for (let k = 0; k < uris.length; k += 100) {
                    await spotifyFetch(`/playlists/${newPlaylist.id}/tracks`, 'POST', {
                        uris: uris.slice(k, k + 100)
                    });
                }
            }
            setStatus('Fission Complete.');
            fetchPlaylists();
        } catch (err) {
            console.error(err);
            setStatus('Split Protocol Failed.');
        } finally {
            setLoading(false);
        }
    };

    const toggleMergeSelection = (playlistId) => {
        const newSet = new Set(selectedMergePlaylists);
        if (newSet.has(playlistId)) {
            newSet.delete(playlistId);
        } else {
            newSet.add(playlistId);
        }
        setSelectedMergePlaylists(newSet);
    };

    const handleMergePlaylists = async () => {
        if (selectedMergePlaylists.size === 0) return;
        setLoading(true);
        setStatus('Initiating Fusion...');
        try {
            const currentTracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            const existingUris = new Set(currentTracks.map(t => t.track.uri));

            const newUris = [];

            for (const playlistId of selectedMergePlaylists) {
                setStatus(`Fetching tracks from ${playlists.find(p => p.id === playlistId)?.name}...`);
                const tracks = await fetchTracksForPlaylist(playlistId);
                tracks.forEach(t => {
                    if (!existingUris.has(t.track.uri)) {
                        existingUris.add(t.track.uri);
                        newUris.push(t.track.uri);
                    }
                });
            }

            if (newUris.length === 0) {
                setStatus('No Unseen Signals.');
                setLoading(false);
                return;
            }

            setStatus('Fusion Protocol Engaged...');

            // Add in chunks
            for (let i = 0; i < newUris.length; i += 100) {
                const chunk = newUris.slice(i, i + 100);
                await spotifyFetch(`/playlists/${selectedPlaylist.id}/tracks`, 'POST', {
                    uris: chunk
                });
            }

            setStatus('Fusion Successful.');
            setSelectedMergePlaylists(new Set()); // Clear selection

        } catch (err) {
            console.error(err);
            setStatus('Fusion Failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleClonePlaylist = async () => {
        setLoading(true);
        setStatus('Duplicating Stream...');
        try {
            const me = await spotifyFetch('/me');
            const tracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            const uris = tracks.map(t => t.track.uri);

            const newPlaylist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                name: `${selectedPlaylist.name} (B-SIDE)`,
                description: selectedPlaylist.description || '',
                public: false
            });

            // Add tracks in chunks
            for (let i = 0; i < uris.length; i += 100) {
                await spotifyFetch(`/playlists/${newPlaylist.id}/tracks`, 'POST', {
                    uris: uris.slice(i, i + 100)
                });
            }
            setStatus('Duplication Complete.');
            fetchPlaylists(); // Update sidebar list
        } catch (err) {
            setStatus('Cloning Protocol Failed.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleReverseOrder = async () => {
        setLoading(true);
        setStatus('Inverting Logic...');
        try {
            const tracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            const reversedUris = tracks.map(t => t.track.uri).reverse();
            await replaceTracks(reversedUris);
            setStatus('Order Inverted.');
        } catch (err) {
            setStatus('Inversion Failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleScanArtists = async () => {
        setLoading(true);
        setStatus('Metabolic Scan...');
        try {
            const tracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            const artistCounts = {};
            tracks.forEach(t => {
                const artist = t.track.artists[0]?.name;
                if (artist) {
                    artistCounts[artist] = (artistCounts[artist] || 0) + 1;
                }
            });
            const sorted = Object.entries(artistCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 50) // Top 50 artists
                .map(([name, count]) => ({ name, count }));
            setTopArtists(sorted);
            setStatus(`Scan Complete.`);
        } catch (err) {
            setStatus('Scan Failure.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveArtist = async (artistName) => {
        if (!confirm(`Remove all songs by ${artistName}?`)) return;
        setLoading(true);
        setStatus(`Purging ${artistName}...`);
        try {
            const tracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            // Invert logic: Keep tracks that are NOT by this artist
            const keepUris = tracks
                .filter(t => t.track.artists[0]?.name !== artistName)
                .map(t => t.track.uri);

            // Safety check: if we somehow removed everything, warn or handle
            if (keepUris.length === 0 && tracks.length > 0) {
                // Deleting everything - simple way
                await spotifyFetch(`/playlists/${selectedPlaylist.id}/tracks`, 'PUT', { uris: [] });
            } else {
                await replaceTracks(keepUris);
            }

            // Update local list UI
            setTopArtists(prev => prev.filter(p => p.name !== artistName));
            setStatus('Purge Complete.');
        } catch (err) {
            setStatus('Purge Failed.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (view === 'list') {
        return (
            <div className="py-20  max-w-6xl mx-auto px-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full -z-10 animate-ios26-float" />

                <header className="mb-24">
                    <button onClick={() => navigate('/dashboard')} className="mb-10 flex items-center text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">
                        <ArrowLeft size={16} className="mr-2" /> Dashboard
                    </button>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 ml-1">Manage Your Library</p>
                            <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-white">
                                Vault
                            </h1>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
                    {playlists.map(p => (
                        <div key={p.id} onClick={() => handleSelect(p)} className="ios26-card-interactive p-4 group">
                            <div className="relative aspect-square mb-6 rounded-[28px] overflow-hidden shadow-2xl ring-1 ring-white/10">
                                {p.images?.[0]?.url ? (
                                    <img src={p.images[0].url} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700" alt="" />
                                ) : (
                                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                        <Music className="w-10 h-10 text-white/10" />
                                    </div>
                                )}
                            </div>
                            <h3 className="font-black text-sm truncate mb-1 tracking-tighter uppercase text-white group-hover:text-blue-500 transition-colors leading-none">{p.name}</h3>
                            <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mt-2">{p.tracks.total} Tracks</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="py-20  max-w-5xl mx-auto px-6 relative overflow-hidden">
            <header className="mb-16">
                <button onClick={() => setView('list')} className="mb-10 flex items-center text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Dashboard
                </button>
                <div className="flex items-center gap-10">
                    <div className="w-48 h-48 shadow-2xl rounded-[48px] overflow-hidden shrink-0 ring-1 ring-white/20">
                        {selectedPlaylist.images?.[0]?.url ? (
                            <img src={selectedPlaylist.images[0].url} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center"><Music size={48} className="text-white/10" /></div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-5xl font-black tracking-tighter text-white uppercase leading-none mb-4">{selectedPlaylist.name}</h1>
                        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.4em]">{selectedPlaylist.tracks.total} Units • Node: {selectedPlaylist.owner.display_name.toUpperCase()}</p>
                    </div>
                </div>
            </header>

            <div className="ios26-tabs p-1.5 flex gap-2 mb-16 overflow-x-auto no-scrollbar">
                {[
                    { id: 'details', label: 'Identity', icon: Edit3 },
                    { id: 'tools', label: 'Logic Tools', icon: Wand2 },
                    { id: 'split', label: 'Fission', icon: Scissors },
                    { id: 'merge', label: 'Fusion', icon: Merge }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-4 px-8 py-4 rounded-[18px] text-[10px] font-black transition-all uppercase tracking-[0.2em] whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-white text-black shadow-2xl scale-105'
                            : 'text-white/30 hover:text-white'
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[500px]">
                {activeTab === 'details' && (
                    <div className="ios26-card p-12  border-white/5 bg-white/[0.02]">
                        <form onSubmit={handleUpdateDetails} className="space-y-12">
                            <div className="space-y-4">
                                <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] ml-2">Stream Identity</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-[28px] p-6 text-white font-black uppercase tracking-widest outline-none focus:border-blue-500 focus:bg-black/60 transition-all text-xl"
                                />
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-2">
                                    <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">Signal Descriptor</label>
                                    <button
                                        type="button"
                                        onClick={generateAIDescription}
                                        disabled={aiLoading}
                                        className="text-[9px] font-black text-blue-500 uppercase tracking-[0.3em] hover:text-blue-400 flex items-center gap-2 transition-colors"
                                    >
                                        <Wand2 size={12} /> {aiLoading ? 'Decompiling...' : 'AI Logic Render'}
                                    </button>
                                </div>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-[28px] p-6 text-white font-black uppercase tracking-widest outline-none focus:border-blue-500 focus:bg-black/60 transition-all h-40 resize-none text-sm leading-relaxed"
                                />
                            </div>

                            {status && <p className={`text-center text-[9px] font-black uppercase tracking-[0.4em] animate-pulse ${status.includes('fail') ? 'text-red-500' : 'text-blue-500'}`}>{status}</p>}

                            <button type="submit" disabled={loading} className="w-full py-6 ios26-liquid text-white font-black uppercase tracking-[0.3em] rounded-[24px] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl border border-white/20 text-[10px]">
                                {loading ? 'Synchronizing Stream' : 'Apply Security Protocol'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'tools' && (
                    <div className="space-y-8 ">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="ios26-card p-10 flex flex-col justify-between group">
                                <div>
                                    <div className="w-14 h-14 ios26-liquid rounded-[22px] flex items-center justify-center text-blue-500 mb-8 border border-white/20 shadow-2xl">
                                        <Music size={24} />
                                    </div>
                                    <h3 className="text-3xl font-black tracking-tighter mb-2 uppercase text-white">Quantum Shuffle</h3>
                                    <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mb-10 leading-relaxed">Absolute entropy render. Breaks all algorithmic patterns across every track unit.</p>
                                </div>
                                <button onClick={handleTrueShuffle} disabled={loading} className="w-full py-5 ios26-glass hover:bg-white/10 text-white font-black uppercase tracking-[0.3em] text-[10px] rounded-[20px] transition-all border border-white/5">
                                    {loading ? 'Rolling Logic' : 'Execute Shuffle'}
                                </button>
                            </div>

                            <div className="ios26-card p-10 flex flex-col justify-between group">
                                <div>
                                    <div className="w-14 h-14 ios26-liquid rounded-[22px] flex items-center justify-center text-purple-500 mb-8 border border-white/20 shadow-2xl">
                                        <Copy size={24} />
                                    </div>
                                    <h3 className="text-3xl font-black tracking-tighter mb-2 uppercase text-white">Mirroring</h3>
                                    <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mb-10 leading-relaxed">Full state duplication. Create a perfect redundant side-channel for this stream.</p>
                                </div>
                                <button onClick={handleClonePlaylist} disabled={loading} className="w-full py-5 ios26-glass hover:bg-white/10 text-white font-black uppercase tracking-[0.3em] text-[10px] rounded-[20px] transition-all border border-white/5">
                                    {loading ? 'Duplicating' : 'Clone Stream'}
                                </button>
                            </div>
                        </div>

                        <div className="ios26-card p-12 relative overflow-hidden">
                            <div className="flex items-center gap-4 mb-10">
                                <BarChart3 className="text-blue-500" size={24} />
                                <h3 className="text-2xl font-black tracking-tighter uppercase text-white">Spectral Sorter</h3>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {[
                                    { id: 'energy', label: 'Energy', icon: '⚡' },
                                    { id: 'danceability', label: 'Flow', icon: '🌊' },
                                    { id: 'tempo', label: 'BPM', icon: '⏱️' },
                                    { id: 'valence', label: 'Mood', icon: '🧠' }
                                ].map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => handleSmartSort(tool.id)}
                                        disabled={loading}
                                        className="ios26-card-interactive p-6 flex flex-col items-center justify-center group border-white/5"
                                    >
                                        <span className="text-3xl mb-4 group-hover:scale-125 transition-all duration-500">{tool.icon}</span>
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 group-hover:text-blue-500 transition-colors">{tool.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="ios26-card p-12">
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-4">
                                    <UserX className="text-red-500" size={24} />
                                    <h3 className="text-2xl font-black tracking-tighter uppercase text-white">Metabolism</h3>
                                </div>
                                {topArtists.length > 0 && (
                                    <button onClick={() => setTopArtists([])} className="text-[9px] font-black text-white/20 uppercase tracking-[0.4em] hover:text-white transition-colors">Reset Node Scan</button>
                                )}
                            </div>

                            {topArtists.length === 0 ? (
                                <button onClick={handleScanArtists} disabled={loading} className="w-full py-16 border-2 border-dashed border-white/5 rounded-[48px] hover:border-red-500/20 hover:bg-red-500/[0.02] transition-all text-white/20 flex flex-col items-center gap-6">
                                    {loading ? <Loader2 className="animate-spin text-red-500" size={32} /> : <Sparkles className="text-red-500" size={32} />}
                                    <span className="font-black text-[10px] uppercase tracking-[0.4em]">Scan for artist over-saturation</span>
                                </button>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {topArtists.map((artist, i) => (
                                        <div key={i} className="flex items-center justify-between p-5 bg-white/[0.02] rounded-[24px] border border-white/5 hover:border-red-500/20 transition-all">
                                            <div className="flex items-center gap-4">
                                                <span className="font-black text-sm uppercase tracking-tighter text-white">{artist.name}</span>
                                                <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{artist.count} Units</span>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveArtist(artist.name)}
                                                disabled={loading}
                                                className="w-10 h-10 rounded-full ios26-liquid border border-red-500/20 text-red-500 flex items-center justify-center hover:scale-110 transition-all shadow-2xl"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'split' && (
                    <div className="ios26-card p-12  relative overflow-hidden border-white/10 bg-white/[0.02]">
                        <div className="absolute inset-0 bg-green-500/[0.01] -z-10" />
                        <div className="flex items-center gap-6 mb-12">
                            <div className="w-16 h-16 ios26-liquid rounded-[28px] flex items-center justify-center text-green-500 border border-white/20 shadow-2xl">
                                <Scissors size={32} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h3 className="text-4xl font-black tracking-tighter text-white uppercase leading-none">Stream Fission</h3>
                                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] mt-3">Divide a massive stream into optimized sub-channels.</p>
                            </div>
                        </div>

                        <div className="mb-12 space-y-6">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] ml-4">Units per Segment</label>
                            <input
                                type="number"
                                value={splitSize}
                                onChange={(e) => setSplitSize(parseInt(e.target.value))}
                                min={5}
                                max={500}
                                className="w-full bg-black/60 border border-white/10 rounded-[36px] p-8 text-6xl font-black text-center text-white outline-none focus:border-green-500 transition-all shadow-inner tracking-tighter"
                            />
                            <p className="text-center text-[10px] text-white/40 font-black uppercase tracking-[0.3em]">
                                Protocol will generate <span className="text-green-500 font-black">{Math.ceil(selectedPlaylist.tracks.total / (splitSize || 1))}</span> redundant streams.
                            </p>
                        </div>

                        <button
                            onClick={handleSplitPlaylist}
                            disabled={loading || splitSize < 5}
                            className="w-full py-6 ios26-liquid text-white font-black uppercase tracking-[0.3em] rounded-[28px] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl border border-green-500/20 text-[10px]"
                        >
                            {loading ? 'Fissioning Stream' : 'Apply Fission'}
                        </button>
                    </div>
                )}

                {activeTab === 'merge' && (
                    <div className="ios26-card p-12  relative overflow-hidden border-white/10 bg-white/[0.02]">
                        <div className="absolute inset-0 bg-indigo-500/[0.01] -z-10" />
                        <div className="flex items-center gap-6 mb-12">
                            <div className="w-16 h-16 ios26-liquid rounded-[28px] flex items-center justify-center text-indigo-500 border border-white/20 shadow-2xl">
                                <Merge size={32} strokeWidth={1.5} />
                            </div>
                            <div>
                                <h3 className="text-4xl font-black tracking-tighter text-white uppercase leading-none">Stream Fusion</h3>
                                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] mt-3">Consolidate multiple frequency streams into one master nexus.</p>
                            </div>
                        </div>

                        <div className="max-h-96 overflow-y-auto custom-scrollbar mb-12 space-y-3 pr-4">
                            {playlists.filter(p => p.id !== selectedPlaylist.id).map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => toggleMergeSelection(p.id)}
                                    className={`p-5 rounded-[24px] flex items-center gap-6 cursor-pointer transition-all border ${selectedMergePlaylists.has(p.id)
                                        ? 'bg-indigo-500/10 border-indigo-500/30'
                                        : 'bg-black/40 border-white/5 hover:border-white/10'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shadow-2xl ${selectedMergePlaylists.has(p.id)
                                        ? 'bg-indigo-500 border-indigo-500'
                                        : 'border-white/10'
                                        }`}>
                                        {selectedMergePlaylists.has(p.id) && <CheckCircle size={18} className="text-white" />}
                                    </div>
                                    <div className="flex-1 truncate">
                                        <div className="font-black text-sm uppercase tracking-tighter text-white truncate mb-1">{p.name}</div>
                                        <div className="text-[9px] text-white/30 font-black uppercase tracking-widest">{p.tracks.total} Units</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleMergePlaylists}
                            disabled={loading || selectedMergePlaylists.size === 0}
                            className="w-full py-6 ios26-liquid text-white font-black uppercase tracking-[0.3em] rounded-[28px] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl border border-indigo-500/20 text-[10px]"
                        >
                            {loading ? 'Fusing Channels' : `Initiate fusion of ${selectedMergePlaylists.size} sources`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaylistManager;
