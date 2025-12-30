import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Play, Save, Loader2, RefreshCw, Zap, Smile, Music2, Sliders } from 'lucide-react';

const MoodMix = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [tracks, setTracks] = useState([]);
    const [filteredTracks, setFilteredTracks] = useState([]);
    const [status, setStatus] = useState('');

    // Mood State (0-100)
    const [energy, setEnergy] = useState(50);
    const [valence, setValence] = useState(50); // Happiness
    const [danceability, setDanceability] = useState(50);
    const [tolerance, setTolerance] = useState(20); // How strict the filter is (+/-)

    useEffect(() => {
        fetchLikedSongs();
    }, []);

    useEffect(() => {
        if (tracks.length > 0) {
            applyFilters();
        }
    }, [energy, valence, danceability, tolerance, tracks]);

    const fetchLikedSongs = async () => {
        setLoading(true);
        setStatus('Fetching your liked songs...');
        try {
            // 1. Fetch last 100 liked songs (can increase to 250/500 if needed)
            let allTracks = [];
            let errorCount = 0;

            // Fetch 2 pages of 50
            for (let offset of [0, 50, 100, 150]) {
                try {
                    const res = await spotifyFetch(`/me/tracks?limit=50&offset=${offset}`);
                    if (res?.items) {
                        allTracks = [...allTracks, ...res.items];
                    }
                } catch (e) {
                    console.warn(`Failed to fetch offset ${offset}:`, e);
                    errorCount++;
                }
            }

            if (allTracks.length === 0) {
                throw new Error("Could not fetch any songs. Check connection.");
            }

            // 2. Extract IDs for Audio Features
            const trackIds = allTracks.map(t => t.track.id).filter(Boolean);
            const featuresMap = {};

            setStatus(`Analyzing vibes of ${trackIds.length} songs...`);
            setAnalyzing(true);

            // 3. Fetch Audio Features in chunks of 100
            for (let i = 0; i < trackIds.length; i += 100) {
                try {
                    const chunk = trackIds.slice(i, i + 100);
                    const featureRes = await spotifyFetch(`/audio-features?ids=${chunk.join(',')}`);
                    if (featureRes?.audio_features) {
                        featureRes.audio_features.forEach(f => {
                            if (f) featuresMap[f.id] = f;
                        });
                    }
                } catch (e) {
                    console.warn("Failed to fetch features chunk:", e);
                }
            }

            // 4. Combine Data
            const enrichedTracks = allTracks.map(item => ({
                ...item,
                features: featuresMap[item.track.id]
            })).filter(t => t.features); // Only keep tracks with features

            setTracks(enrichedTracks);
            if (enrichedTracks.length === 0) {
                setStatus('No songs with audio features found.');
            } else {
                setStatus('');
            }
        } catch (err) {
            console.error(err);
            setStatus(`Error: ${err.message}`);
        } finally {
            setLoading(false);
            setAnalyzing(false);
        }
    };

    const applyFilters = () => {
        const eTarget = energy / 100;
        const vTarget = valence / 100;
        const dTarget = danceability / 100;
        const tol = tolerance / 100;

        const filtered = tracks.filter(t => {
            const f = t.features;
            if (!f) return false;

            const matchEnergy = Math.abs(f.energy - eTarget) <= tol;
            const matchValence = Math.abs(f.valence - vTarget) <= tol;
            const matchDance = Math.abs(f.danceability - dTarget) <= tol;

            return matchEnergy && matchValence && matchDance;
        });

        setFilteredTracks(filtered);
    };

    const handleCreatePlaylist = async () => {
        if (filteredTracks.length === 0) return;
        setLoading(true);
        setStatus('Creating playlist...');
        try {
            const me = await spotifyFetch('/me');
            const name = `Mood Mix: ${getMoodName()}`;

            const playlist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                name: name,
                description: `A generated mix based on Energy: ${energy}%, Happiness: ${valence}%, Danceability: ${danceability}%.`,
                public: false
            });

            const uris = filteredTracks.map(t => t.track.uri);

            // Add in chunks
            for (let i = 0; i < uris.length; i += 100) {
                await spotifyFetch(`/playlists/${playlist.id}/tracks`, 'POST', {
                    uris: uris.slice(i, i + 100)
                });
            }

            setStatus('Playlist saved! Check Spotify.');
            setTimeout(() => setStatus(''), 3000);
        } catch (err) {
            console.error(err);
            setStatus('Failed to save playlist.');
        } finally {
            setLoading(false);
        }
    };

    const getMoodName = () => {
        if (energy > 80 && valence > 80) return "Hyper Happy 🦄";
        if (energy > 80 && valence < 30) return "Aggressive Dark 🧛";
        if (energy < 30 && valence < 30) return "Sad & Slow 🌧️";
        if (energy < 40 && valence > 70) return "Chill Vibes 🍃";
        if (danceability > 80) return "Dance Party 🕺";
        return "Custom Vibe ✨";
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 animate-fade-in pb-32">
            <button
                onClick={() => navigate('/dashboard')}
                className="hidden md:flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft className="mr-2" size={20} /> Back to Dashboard
            </button>

            <header className="mb-12 text-center md:text-left">
                <h1 className="text-4xl font-bold mb-4 flex items-center justify-center md:justify-start gap-3">
                    <Sliders className="text-purple-500" /> Mood Mix Builder
                </h1>
                <p className="text-gray-400">Filter your liked songs to find the perfect vibe.</p>
            </header>

            {loading && !tracks.length ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-purple-500 mb-4" size={48} />
                    <p className="text-xl font-bold">{status}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Controls */}
                    <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800 h-fit">
                        <h2 className="text-xl font-bold mb-6">Dial in the Vibe</h2>

                        <div className="space-y-8">
                            {/* Energy */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="font-bold flex items-center gap-2"><Zap size={16} className="text-yellow-500" /> Energy</label>
                                    <span className="text-yellow-500 font-bold">{energy}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="100" value={energy}
                                    onChange={(e) => setEnergy(parseInt(e.target.value))}
                                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Chill</span>
                                    <span>Intense</span>
                                </div>
                            </div>

                            {/* Valence */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="font-bold flex items-center gap-2"><Smile size={16} className="text-green-500" /> Happiness</label>
                                    <span className="text-green-500 font-bold">{valence}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="100" value={valence}
                                    onChange={(e) => setValence(parseInt(e.target.value))}
                                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Sad/Angry</span>
                                    <span>Joyful</span>
                                </div>
                            </div>

                            {/* Danceability */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="font-bold flex items-center gap-2"><Music2 size={16} className="text-blue-500" /> Danceability</label>
                                    <span className="text-blue-500 font-bold">{danceability}%</span>
                                </div>
                                <input
                                    type="range" min="0" max="100" value={danceability}
                                    onChange={(e) => setDanceability(parseInt(e.target.value))}
                                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Static</span>
                                    <span>Groovy</span>
                                </div>
                            </div>

                            {/* Tolerance */}
                            <div className="pt-4 border-t border-neutral-700">
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm text-gray-400">Match Strictness</label>
                                    <span className="text-gray-400 text-sm">{tolerance}% Range</span>
                                </div>
                                <input
                                    type="range" min="5" max="50" value={tolerance}
                                    onChange={(e) => setTolerance(parseInt(e.target.value))}
                                    className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-gray-400"
                                />
                            </div>
                        </div>

                        <div className="mt-8">
                            <div className="text-center mb-4">
                                <span className="text-4xl font-bold">{filteredTracks.length}</span>
                                <p className="text-gray-400 text-sm">matches found</p>
                            </div>

                            <button
                                onClick={handleCreatePlaylist}
                                disabled={loading || filteredTracks.length === 0}
                                className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <Save />}
                                {loading ? 'Saving Vibe...' : 'Save as Playlist'}
                            </button>
                            {status && <p className="text-center mt-3 text-sm text-green-400 animate-pulse">{status}</p>}
                        </div>
                    </div>

                    {/* Results List */}
                    <div className="lg:col-span-2">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            {getMoodName()} Preview
                        </h3>

                        {filteredTracks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filteredTracks.slice(0, 50).map((item, i) => (
                                    <div key={i} className="bg-white/5 p-3 rounded-lg flex items-center gap-3 hover:bg-white/10 transition-colors">
                                        {item.track.album.images[2] && (
                                            <img src={item.track.album.images[2].url} className="w-12 h-12 rounded" alt="" />
                                        )}
                                        <div className="overflow-hidden">
                                            <p className="font-bold truncate">{item.track.name}</p>
                                            <p className="text-xs text-gray-400 truncate">{item.track.artists[0].name}</p>
                                        </div>
                                    </div>
                                ))}
                                {filteredTracks.length > 50 && (
                                    <div className="flex items-center justify-center text-gray-500 text-sm">
                                        + {filteredTracks.length - 50} more...
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-neutral-800 rounded-2xl text-gray-500">
                                <Music2 size={48} className="mb-4 opacity-50" />
                                <p>No songs match this specific vibe.</p>
                                <p className="text-sm">Try widening the range or adjusting the sliders.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MoodMix;
