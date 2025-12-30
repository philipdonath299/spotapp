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
            setStatus('Updated successfully!');
            fetchPlaylists(); // Refresh list data
        } catch (err) {
            setStatus('Update failed.');
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
        setStatus("AI is analyzing your playlist's vibe...");
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            setStatus("Missing API Key. Check your .env file.");
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
            setStatus("AI description generated!");

        } catch (err) {
            console.error("AI Error:", err);
            setStatus(`AI Error: ${err.message}`);
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
        setStatus('Updating playlist order...');

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

        setStatus('Playlist updated!');
    };

    const handleTrueShuffle = async () => {
        setLoading(true);
        setStatus('');
        try {
            const tracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            for (let i = tracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
            }
            const uris = tracks.map(t => t.track.uri);
            await replaceTracks(uris);
        } catch (err) {
            setStatus('Shuffle failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleSmartSort = async (criteria) => {
        setLoading(true);
        setStatus('');
        try {
            const tracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            setStatus('Analyzing audio features...');

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
            setStatus('Sort failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleSplitPlaylist = async () => {
        if (splitSize < 5) {
            setStatus('Split size too small.');
            return;
        }
        setLoading(true);
        setStatus('Fetching tracks to split...');
        try {
            const allTracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            const totalParts = Math.ceil(allTracks.length / splitSize);
            const me = await spotifyFetch('/me');

            setStatus(`Creating ${totalParts} new playlists...`);

            for (let i = 0; i < totalParts; i++) {
                const chunk = allTracks.slice(i * splitSize, (i + 1) * splitSize);
                const uris = chunk.map(t => t.track.uri);

                const newPlaylist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                    name: `${selectedPlaylist.name} (Part ${i + 1})`,
                    description: `Part ${i + 1} of split playlist based on ${selectedPlaylist.name}.`,
                    public: false
                });

                // Add in chunks of 100
                for (let k = 0; k < uris.length; k += 100) {
                    await spotifyFetch(`/playlists/${newPlaylist.id}/tracks`, 'POST', {
                        uris: uris.slice(k, k + 100)
                    });
                }
            }
            setStatus(`Successfully created ${totalParts} playlists!`);
            fetchPlaylists();
        } catch (err) {
            console.error(err);
            setStatus('Split failed.');
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
        setStatus('Merging playlists...');
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
                setStatus('No new tracks to merge!');
                setLoading(false);
                return;
            }

            setStatus(`Adding ${newUris.length} new tracks...`);

            // Add in chunks
            for (let i = 0; i < newUris.length; i += 100) {
                const chunk = newUris.slice(i, i + 100);
                await spotifyFetch(`/playlists/${selectedPlaylist.id}/tracks`, 'POST', {
                    uris: chunk
                });
            }

            setStatus(`Successfully merged ${newUris.length} tracks!`);
            setSelectedMergePlaylists(new Set()); // Clear selection

        } catch (err) {
            console.error(err);
            setStatus('Merge failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleClonePlaylist = async () => {
        setLoading(true);
        setStatus('Creating copy...');
        try {
            const me = await spotifyFetch('/me');
            const tracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            const uris = tracks.map(t => t.track.uri);

            const newPlaylist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                name: `Copy of ${selectedPlaylist.name}`,
                description: selectedPlaylist.description || '',
                public: false
            });

            // Add tracks in chunks
            for (let i = 0; i < uris.length; i += 100) {
                await spotifyFetch(`/playlists/${newPlaylist.id}/tracks`, 'POST', {
                    uris: uris.slice(i, i + 100)
                });
            }
            setStatus('Playlist cloned successfully!');
            fetchPlaylists(); // Update sidebar list
        } catch (err) {
            setStatus('Clone failed.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleReverseOrder = async () => {
        setLoading(true);
        setStatus('Reversing...');
        try {
            const tracks = await fetchTracksForPlaylist(selectedPlaylist.id);
            const reversedUris = tracks.map(t => t.track.uri).reverse();
            await replaceTracks(reversedUris);
            setStatus('Order reversed!');
        } catch (err) {
            setStatus('Reverse failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleScanArtists = async () => {
        setLoading(true);
        setStatus('Analyzing artists...');
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
            setStatus(`Found ${sorted.length} top artists.`);
        } catch (err) {
            setStatus('Scan failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveArtist = async (artistName) => {
        if (!confirm(`Remove all songs by ${artistName}?`)) return;
        setLoading(true);
        setStatus(`Removing ${artistName}...`);
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
            setStatus(`Removed tracks by ${artistName}!`);
        } catch (err) {
            setStatus('Removal failed.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (view === 'list') {
        return (
            <div className="py-8 animate-apple-in max-w-6xl mx-auto px-4">
                <header className="mb-12">
                    <button onClick={() => navigate('/dashboard')} className="mb-6 flex items-center text-blue-500 font-bold text-sm hover:underline">
                        <ArrowLeft size={16} className="mr-1" /> Dashboard
                    </button>
                    <h1 className="text-5xl font-extrabold tracking-tighter">Playlists</h1>
                    <p className="text-gray-500 text-xl font-medium mt-1">Management and curation tools.</p>
                </header>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {playlists.map(p => (
                        <div key={p.id} onClick={() => handleSelect(p)} className="group cursor-pointer">
                            <div className="relative aspect-square mb-3 shadow-2xl overflow-hidden rounded-[32px] border border-white/5 group-active:scale-95 transition-all">
                                {p.images?.[0]?.url ? (
                                    <img src={p.images[0].url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                ) : (
                                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                        <Music className="w-10 h-10 text-gray-600" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <h3 className="font-bold text-sm truncate mb-0.5 tracking-tight group-hover:text-blue-400 transition-colors uppercase">{p.name}</h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{p.tracks.total} tracks</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="py-8 animate-apple-in max-w-4xl mx-auto px-4">
            <header className="mb-10">
                <button onClick={() => setView('list')} className="mb-6 flex items-center text-blue-500 font-bold text-sm hover:underline">
                    <ArrowLeft size={16} className="mr-1" /> All Playlists
                </button>
                <div className="flex items-center gap-8">
                    <div className="w-40 h-40 shadow-2xl rounded-[40px] overflow-hidden border border-white/10 shrink-0">
                        {selectedPlaylist.images?.[0]?.url ? (
                            <img src={selectedPlaylist.images[0].url} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center"><Music size={40} className="text-gray-600" /></div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-4xl font-extrabold tracking-tighter mb-2">{selectedPlaylist.name}</h1>
                        <p className="text-gray-500 text-lg font-medium">{selectedPlaylist.tracks.total} tracks • {selectedPlaylist.owner.display_name}</p>
                    </div>
                </div>
            </header>

            <div className="flex gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide">
                {[
                    { id: 'details', label: 'Details', icon: Edit3 },
                    { id: 'tools', label: 'Magic Tools', icon: Wand2 },
                    { id: 'split', label: 'Splitter', icon: Scissors },
                    { id: 'merge', label: 'Merge', icon: Merge }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'bg-blue-500 text-white shadow-lg'
                            : 'bg-white/5 text-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'details' && (
                    <div className="apple-glass p-10 rounded-[40px] animate-apple-in">
                        <form onSubmit={handleUpdateDetails} className="space-y-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Playlist Name</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:border-blue-500 focus:bg-black/60 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-4">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Description</label>
                                    <button
                                        type="button"
                                        onClick={generateAIDescription}
                                        disabled={aiLoading}
                                        className="text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 flex items-center gap-1"
                                    >
                                        <Wand2 size={12} /> {aiLoading ? 'Thinking...' : 'AI Enhance'}
                                    </button>
                                </div>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-medium outline-none focus:border-blue-500 focus:bg-black/60 transition-all h-32 resize-none"
                                />
                            </div>

                            {status && <p className={`text-center text-sm font-bold ${status.includes('failed') ? 'text-red-500' : 'text-blue-500'}`}>{status}</p>}

                            <button type="submit" disabled={loading} className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95 shadow-xl">
                                {loading ? 'Syncing...' : 'Save and Sync'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'tools' && (
                    <div className="space-y-6 animate-apple-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="apple-card p-6 flex flex-col justify-between">
                                <div>
                                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 mb-4">
                                        <Music size={20} />
                                    </div>
                                    <h3 className="text-xl font-bold tracking-tight mb-1">True Shuffle</h3>
                                    <p className="text-xs text-gray-500 font-medium mb-6">Algorithmically randomizes Every. Single. Song. No bias.</p>
                                </div>
                                <button onClick={handleTrueShuffle} disabled={loading} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all border border-white/5">
                                    {loading ? 'Rolling...' : 'Randomize Order'}
                                </button>
                            </div>

                            <div className="apple-card p-6 flex flex-col justify-between">
                                <div>
                                    <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 mb-4">
                                        <Copy size={20} />
                                    </div>
                                    <h3 className="text-xl font-bold tracking-tight mb-1">Mirror</h3>
                                    <p className="text-xs text-gray-500 font-medium mb-6">Clone this playlist into a fresh copy instantly.</p>
                                </div>
                                <button onClick={handleClonePlaylist} disabled={loading} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all border border-white/5">
                                    {loading ? 'Copying...' : 'Make Clone'}
                                </button>
                            </div>
                        </div>

                        <div className="apple-card p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <BarChart3 className="text-pink-500" size={24} />
                                <h3 className="text-xl font-bold tracking-tighter">Sonic Sorter</h3>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { id: 'energy', label: 'Energy', icon: '🔥' },
                                    { id: 'danceability', label: 'Flow', icon: '💃' },
                                    { id: 'tempo', label: 'BPM', icon: '🏃' },
                                    { id: 'valence', label: 'Mood', icon: '😊' }
                                ].map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => handleSmartSort(tool.id)}
                                        disabled={loading}
                                        className="flex flex-col items-center justify-center p-4 bg-black/40 rounded-2xl border border-white/5 hover:border-blue-500/30 hover:bg-black/60 transition-all group"
                                    >
                                        <span className="text-2xl mb-2 group-hover:scale-125 transition-transform">{tool.icon}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors">{tool.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="apple-card p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <UserX className="text-red-500" size={24} />
                                    <h3 className="text-xl font-bold tracking-tighter">Artist Health</h3>
                                </div>
                                {topArtists.length > 0 && (
                                    <button onClick={() => setTopArtists([])} className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white">Reset Scan</button>
                                )}
                            </div>

                            {topArtists.length === 0 ? (
                                <button onClick={handleScanArtists} disabled={loading} className="w-full py-12 border-2 border-dashed border-white/5 rounded-[32px] hover:border-red-500/20 hover:bg-red-500/5 transition-all text-gray-500 flex flex-col items-center gap-4">
                                    {loading ? <Loader2 className="animate-spin text-red-500" /> : <Sparkles className="text-red-500" />}
                                    <span className="font-bold text-sm">Scan for artist over-saturation</span>
                                </button>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {topArtists.map((artist, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-sm tracking-tight">{artist.name}</span>
                                                <span className="text-[10px] font-black text-gray-500 uppercase">{artist.count} tracks</span>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveArtist(artist.name)}
                                                disabled={loading}
                                                className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                                            >
                                                <Trash size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'split' && (
                    <div className="apple-glass p-10 rounded-[40px] animate-apple-in">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500">
                                <Scissors size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold tracking-tighter">Segment Playlist</h3>
                                <p className="text-gray-500 font-medium">Divide one massive list into manageable mini-mixes.</p>
                            </div>
                        </div>

                        <div className="mb-10 space-y-4">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Tracks per Mixed Segment</label>
                            <input
                                type="number"
                                value={splitSize}
                                onChange={(e) => setSplitSize(parseInt(e.target.value))}
                                min={5}
                                max={500}
                                className="w-full bg-black/40 border border-white/5 rounded-2xl p-6 text-2xl font-black text-center outline-none focus:border-green-500 transition-all"
                            />
                            <p className="text-center text-xs text-gray-500 font-medium">
                                We'll create approximately <span className="text-green-500 font-black">{Math.ceil(selectedPlaylist.tracks.total / (splitSize || 1))}</span> new playlists for you.
                            </p>
                        </div>

                        <button
                            onClick={handleSplitPlaylist}
                            disabled={loading || splitSize < 5}
                            className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95 shadow-xl"
                        >
                            {loading ? 'Processing...' : 'Generate Segments'}
                        </button>
                    </div>
                )}

                {activeTab === 'merge' && (
                    <div className="apple-glass p-10 rounded-[40px] animate-apple-in">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500">
                                <Merge size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold tracking-tighter">Merge and Unify</h3>
                                <p className="text-gray-500 font-medium">Consolidate multiple themes into one master selection.</p>
                            </div>
                        </div>

                        <div className="max-h-80 overflow-y-auto custom-scrollbar mb-8 space-y-2 pr-2">
                            {playlists.filter(p => p.id !== selectedPlaylist.id).map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => toggleMergeSelection(p.id)}
                                    className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border ${selectedMergePlaylists.has(p.id)
                                        ? 'bg-indigo-500/10 border-indigo-500/30'
                                        : 'bg-black/20 border-white/5 hover:bg-black/40'
                                        }`}
                                >
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedMergePlaylists.has(p.id)
                                        ? 'bg-indigo-500 border-indigo-500'
                                        : 'border-white/10'
                                        }`}>
                                        {selectedMergePlaylists.has(p.id) && <CheckCircle size={14} className="text-white" />}
                                    </div>
                                    <div className="flex-1 truncate">
                                        <div className="font-bold text-sm tracking-tight truncate">{p.name}</div>
                                        <div className="text-[10px] text-gray-500 font-black uppercase">{p.tracks.total} tracks</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleMergePlaylists}
                            disabled={loading || selectedMergePlaylists.size === 0}
                            className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95 shadow-xl"
                        >
                            {loading ? 'Merging...' : `Integrate ${selectedMergePlaylists.size} Sources`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaylistManager;
