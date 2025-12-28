import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Edit3, Wand2, Loader2, Save, X, CheckCircle, Sparkles, Music, BarChart3, Scissors, Merge } from 'lucide-react';

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

            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Write a creative, catchy, and short description (max 150 chars) for a Spotify playlist named "${selectedPlaylist.name}" that contains these songs: ${tracks}. Do NOT use quotes.`
                        }]
                    }]
                })
            });

            const data = await res.json();

            if (data.error) {
                throw new Error(data.error.message || "API Error");
            }

            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (aiText) {
                setDescription(aiText.replace(/^["']|["']$/g, ''));
                setStatus("AI description generated!");
            } else {
                throw new Error("No description returned");
            }
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

    if (view === 'list') {
        return (
            <div className="min-h-screen bg-black text-white p-4 md:p-8 animate-fade-in">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
                >
                    <ArrowLeft className="mr-2" size={20} /> Back to Dashboard
                </button>
                <header className="mb-12">
                    <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
                        <Wand2 className="text-purple-500" /> Playlist Manager
                    </h1>
                    <p className="text-gray-400">Rename, describe, shuffle, sort, split, or merge your playlists.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {playlists.map(p => (
                        <div key={p.id} onClick={() => handleSelect(p)} className="bg-[#181818] p-4 rounded-xl border border-neutral-800 hover:border-purple-500 cursor-pointer transition-all flex items-center gap-4 group">
                            {p.images?.[0]?.url ? (
                                <img src={p.images[0].url} className="w-16 h-16 rounded shadow-lg group-hover:scale-105 transition-transform" alt="" />
                            ) : (
                                <div className="w-16 h-16 bg-neutral-800 rounded flex items-center justify-center text-gray-500">?</div>
                            )}
                            <div className="truncate flex-1">
                                <h3 className="font-bold truncate">{p.name}</h3>
                                <p className="text-xs text-gray-500">{p.tracks.total} tracks</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 animate-fade-in">
            <button onClick={() => setView('list')} className="text-gray-400 hover:text-white mb-8 flex items-center">
                <ArrowLeft className="mr-1" size={18} /> Back to Playlists
            </button>

            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-6 mb-8">
                    {selectedPlaylist.images?.[0]?.url && (
                        <img src={selectedPlaylist.images[0].url} className="w-32 h-32 rounded-lg shadow-2xl" alt="" />
                    )}
                    <div>
                        <h1 className="text-3xl font-bold mb-2">{selectedPlaylist.name}</h1>
                        <p className="text-gray-400 text-sm">{selectedPlaylist.tracks.total} tracks</p>
                    </div>
                </div>

                <div className="flex gap-4 border-b border-neutral-800 mb-8 overflow-x-auto">
                    <button onClick={() => setActiveTab('details')} className={`pb-4 px-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'details' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500 hover:text-white'}`}>
                        Details
                    </button>
                    <button onClick={() => setActiveTab('tools')} className={`pb-4 px-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'tools' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500 hover:text-white'}`}>
                        Tools
                    </button>
                    <button onClick={() => setActiveTab('split')} className={`pb-4 px-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'split' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500 hover:text-white'}`}>
                        Splitter
                    </button>
                    <button onClick={() => setActiveTab('merge')} className={`pb-4 px-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'merge' ? 'text-purple-500 border-b-2 border-purple-500' : 'text-gray-500 hover:text-white'}`}>
                        Merge
                    </button>
                </div>

                {activeTab === 'details' && (
                    <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800 animate-slide-up">
                        <form onSubmit={handleUpdateDetails} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold mb-2 text-gray-400">Name</label>
                                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black border border-neutral-700 rounded-lg p-4 text-white focus:border-purple-500 outline-none transition-all" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="block text-sm font-bold text-gray-400">Description</label>
                                    <button type="button" onClick={generateAIDescription} disabled={aiLoading} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                        <Wand2 size={12} /> {aiLoading ? 'Magic working...' : 'Auto-Generate with AI'}
                                    </button>
                                </div>
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-black border border-neutral-700 rounded-lg p-4 text-white focus:border-purple-500 outline-none transition-all h-32 resize-none" />
                            </div>

                            {status && <p className={`text-center ${status.includes('failed') ? 'text-red-500' : 'text-green-500'} animate-pulse`}>{status}</p>}

                            <button type="submit" disabled={loading} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-900/20">
                                {loading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'tools' && (
                    <div className="space-y-6 animate-slide-up">
                        <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800">
                            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                <span className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Music size={20} /></span>
                                True Shuffle
                            </h3>
                            <button onClick={handleTrueShuffle} disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all">
                                {loading ? 'Shuffling...' : 'Randomize Order'}
                            </button>
                        </div>

                        <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800">
                            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                <span className="p-2 bg-pink-500/10 text-pink-500 rounded-lg"><BarChart3 size={20} /></span>
                                Smart Sort
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => handleSmartSort('energy')} disabled={loading} className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-bold border border-neutral-700 transition-all">🔥 High Energy</button>
                                <button onClick={() => handleSmartSort('danceability')} disabled={loading} className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-bold border border-neutral-700 transition-all">💃 Danceability</button>
                                <button onClick={() => handleSmartSort('tempo')} disabled={loading} className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-bold border border-neutral-700 transition-all">🏃 Fast to Slow</button>
                                <button onClick={() => handleSmartSort('valence')} disabled={loading} className="p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-bold border border-neutral-700 transition-all">😊 Happy to Sad</button>
                            </div>
                        </div>
                        {status && <p className="text-center text-green-500 font-bold">{status}</p>}
                    </div>
                )}

                {activeTab === 'split' && (
                    <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800 animate-slide-up">
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                            <span className="p-2 bg-green-500/10 text-green-500 rounded-lg"><Scissors size={20} /></span>
                            Playlist Splitter
                        </h3>
                        <div className="mb-8">
                            <label className="block text-sm font-bold mb-2 text-gray-400">Tracks per Playlist</label>
                            <input
                                type="number"
                                value={splitSize}
                                onChange={(e) => setSplitSize(parseInt(e.target.value))}
                                min={5}
                                max={500}
                                className="w-full bg-black border border-neutral-700 rounded-lg p-4 text-white font-bold outline-none focus:border-green-500"
                            />
                            <p className="text-xs text-neutral-500 mt-2">
                                This will create approx. {Math.ceil(selectedPlaylist.tracks.total / (splitSize || 1))} new playlists.
                            </p>
                        </div>

                        <button
                            onClick={handleSplitPlaylist}
                            disabled={loading || splitSize < 5}
                            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Scissors />}
                            {loading ? 'Splitting...' : 'Split Playlist'}
                        </button>

                        {status && <p className="text-center text-green-500 font-bold mt-4">{status}</p>}
                    </div>
                )}

                {activeTab === 'merge' && (
                    <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800 animate-slide-up">
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                            <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg"><Merge size={20} /></span>
                            Merge Playlists
                        </h3>
                        <p className="text-gray-400 text-sm mb-6">
                            Select playlists to merge INTO <strong>{selectedPlaylist.name}</strong>. Duplicates will be ignored.
                        </p>

                        <div className="max-h-60 overflow-y-auto custom-scrollbar mb-6 space-y-2 border border-neutral-800 rounded-lg p-2">
                            {playlists.filter(p => p.id !== selectedPlaylist.id).map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => toggleMergeSelection(p.id)}
                                    className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-all ${selectedMergePlaylists.has(p.id) ? 'bg-indigo-500/20 border border-indigo-500' : 'hover:bg-neutral-800 border border-transparent'}`}
                                >
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedMergePlaylists.has(p.id) ? 'bg-indigo-500 border-indigo-500' : 'border-neutral-600'}`}>
                                        {selectedMergePlaylists.has(p.id) && <CheckCircle size={12} className="text-white" />}
                                    </div>
                                    <div className="flex-1 truncate">
                                        <div className="font-bold text-sm truncate">{p.name}</div>
                                        <div className="text-xs text-gray-500">{p.tracks.total} tracks</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleMergePlaylists}
                            disabled={loading || selectedMergePlaylists.size === 0}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <Merge />}
                            {loading ? 'Merging...' : `Merge ${selectedMergePlaylists.size} Playlists`}
                        </button>

                        {status && <p className="text-center text-indigo-400 font-bold mt-4">{status}</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaylistManager;
