import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, X, Heart, Play, Pause, Loader2, Music2, Layers } from 'lucide-react';

const DiscoveryDeck = () => {
    const navigate = useNavigate();
    const [queue, setQueue] = useState([]);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [loading, setLoading] = useState(false);
    const [playlistId, setPlaylistId] = useState(null);
    const [swipeDirection, setSwipeDirection] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audio, setAudio] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [initDone, setInitDone] = useState(false);

    // Hardcoded Category Playlists (These are stable Spotify Owned playlists)
    const PRESETS = [
        { name: "Global Top 50", query: "Top 50 Global", color: "blue" },
        { name: "Viral 50", query: "Viral 50 Global", color: "purple" },
        { name: "Today's Top Hits", query: "Today's Top Hits", color: "green" },
        { name: "RapCaviar", query: "RapCaviar", color: "red" },
        { name: "Rock Classics", query: "Rock Classics", color: "orange" },
        { name: "New Music Friday", query: "New Music Friday", color: "pink" }
    ];

    useEffect(() => {
        initDiscovery();
        return () => {
            if (audio) {
                audio.pause();
                audio.src = "";
                setAudio(null);
            }
        };
    }, []);

    // Start preview helper (to be called from interaction handlers)
    const playPreview = (track, existingAudio) => {
        if (!track?.preview_url) {
            setIsPlaying(false);
            return null;
        }

        if (existingAudio) {
            existingAudio.pause();
            existingAudio.src = "";
        }

        const newAudio = new Audio(track.preview_url);
        newAudio.volume = 0.5;

        const playPromise = newAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                setIsPlaying(true);
            }).catch(e => {
                console.warn("Auto-play blocked:", e);
                setIsPlaying(false);
            });
        }

        newAudio.onended = () => setIsPlaying(false);
        setAudio(newAudio);
        return newAudio;
    };

    const initDiscovery = async () => {
        try {
            const me = await spotifyFetch('/me');
            if (!me || !me.id) {
                setErrorMsg("Could not fetch user profile. Try re-logging in.");
                return;
            }

            const playlists = await spotifyFetch('/me/playlists?limit=50');
            const found = playlists.items.find(p => p.name === "My Discovery Deck");

            if (found) {
                setPlaylistId(found.id);
            } else {
                const newPlaylist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                    name: "My Discovery Deck",
                    description: "Songs I swiped right on using Discovery Deck.",
                    public: false
                });
                setPlaylistId(newPlaylist.id);
            }
        } catch (err) {
            console.error("Playlist init failed:", err);
            setErrorMsg("Could not access your playlists.");
        }
    };

    const loadCategory = async (query) => {
        setLoading(true);
        setErrorMsg('');
        setInitDone(true);
        try {
            // 1. Search for a playlist matching the query
            let searchRes = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=playlist&limit=5`);

            // Try to find a Spotify-owned one first in the results
            let playlist = searchRes?.playlists?.items?.find(p => p.owner.display_name === 'Spotify') || searchRes?.playlists?.items[0];

            if (!playlist) {
                // Try a broader search if the specific one fails
                searchRes = await spotifyFetch(`/search?q=${encodeURIComponent(query.replace('Global', '').trim())}&type=playlist&limit=1`);
                playlist = searchRes?.playlists?.items[0];
            }

            if (!playlist) {
                throw new Error(`Could not find a playlist for "${query}".`);
            }

            // 2. Fetch tracks from the found playlist
            const res = await spotifyFetch(`/playlists/${playlist.id}/tracks?limit=50`);

            if (res?.items) {
                const tracks = res.items
                    .map(i => i.track)
                    .filter(t => t && t.id && !t.is_local && t.preview_url); // ONLY tracks with previews

                if (tracks.length === 0) {
                    throw new Error("No tracks with previews found in this vibe. Try another!");
                }

                // Shuffle for variety
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
                }

                setQueue(tracks);
                setCurrentTrack(tracks[0]);
                // Start first track immediately (this is inside a click handler's call stack)
                playPreview(tracks[0], audio);
            } else {
                setErrorMsg("Failed to load tracks from this category.");
            }
        } catch (err) {
            console.error(err);
            setErrorMsg(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSwipe = async (direction) => {
        if (!currentTrack || !queue.length) return;

        if (audio) {
            audio.pause();
            setIsPlaying(false);
        }

        setSwipeDirection(direction);

        if (direction === 'right') {
            addToPlaylist(currentTrack.uri);
        }

        setTimeout(() => {
            const nextQueue = queue.slice(1);
            setQueue(nextQueue);
            const nextTrack = nextQueue[0] || null;
            setCurrentTrack(nextTrack);
            setSwipeDirection(null);

            // Play next track (still part of the click interaction chain via setTimeout)
            if (nextTrack) {
                playPreview(nextTrack, audio);
            }
        }, 300);
    };

    const addToPlaylist = async (uri) => {
        if (!playlistId) return;
        try {
            await spotifyFetch(`/playlists/${playlistId}/tracks`, 'POST', {
                uris: [uri]
            });
        } catch (err) {
            console.error("Add to playlist failed:", err);
        }
    };

    const togglePreview = () => {
        if (!currentTrack?.preview_url || !audio) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play().catch(e => console.warn("Playback failed", e));
            setIsPlaying(true);
        }
    };

    if (!initDone) {
        return (
            <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center animate-fade-in">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="absolute top-6 left-6 flex items-center text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="mr-2" size={20} /> Exit
                </button>

                <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
                    <Layers className="text-blue-500" /> Choose a Vibe
                </h1>
                <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                    {PRESETS.map(p => (
                        <button
                            key={p.name}
                            onClick={() => loadCategory(p.query)}
                            className={`p-6 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700 hover:to-${p.color}-900/50 hover:border-${p.color}-500 transition-all text-left group`}
                        >
                            <span className={`text-${p.color}-400 font-bold text-lg block mb-1 group-hover:text-white`}>{p.name}</span>
                            <span className="text-xs text-gray-500">Explore</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                <p>Dealing the cards...</p>
            </div>
        );
    }

    if (!currentTrack) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
                <Music2 size={64} className="text-neutral-700 mb-6" />
                <h2 className="text-2xl font-bold mb-2">Out of cards!</h2>
                <p className="text-gray-400 mb-6">{errorMsg || "You've swiped through this deck."}</p>
                <button
                    onClick={() => setInitDone(false)}
                    className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors"
                >
                    Choose Another Vibe
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 flex flex-col animate-fade-in pb-20 overflow-hidden relative">
            <button
                onClick={() => setInitDone(false)}
                className="absolute top-6 left-6 z-20 flex items-center text-gray-400 hover:text-white transition-colors"
            >
                <ArrowLeft className="mr-2" size={20} /> Back
            </button>

            <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full relative">

                {/* Card */}
                <div className={`relative w-full aspect-[4/5] bg-[#181818] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-300 ${swipeDirection === 'left' ? '-translate-x-full rotate-[-20deg] opacity-0' : ''} ${swipeDirection === 'right' ? 'translate-x-full rotate-[20deg] opacity-0' : ''}`}>
                    {currentTrack.album.images[0] && (
                        <img src={currentTrack.album.images[0].url} className="absolute inset-0 w-full h-full object-cover" alt="" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                    {/* Preload Next */}
                    {queue[1]?.album?.images[0] && (
                        <link rel="preload" as="image" href={queue[1].album.images[0].url} />
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-8">
                        <h2 className="text-3xl font-bold mb-2 leading-tight shadow-black drop-shadow-lg">{currentTrack.name}</h2>
                        <p className="text-xl text-gray-300 mb-6 font-medium shadow-black drop-shadow-md">{currentTrack.artists.map(a => a.name).join(', ')}</p>

                        <div className="flex items-center gap-4">
                            {currentTrack.preview_url ? (
                                <button
                                    onClick={togglePreview}
                                    className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/50 text-white font-bold py-3 px-6 rounded-full flex items-center justify-center gap-2 transition-all"
                                >
                                    {isPlaying ? <Pause fill="white" size={20} /> : <Play fill="white" size={20} />}
                                    {isPlaying ? 'Pause' : 'Preview'}
                                </button>
                            ) : (
                                <div className="flex-1 bg-black/40 backdrop-blur-md text-gray-400 py-3 px-6 rounded-full text-center text-sm font-bold border border-white/10">No Preview</div>
                            )}
                        </div>
                    </div>

                    {/* Overlays */}
                    {swipeDirection === 'right' && (
                        <div className="absolute top-10 left-10 p-4 border-4 border-green-500 rounded-lg text-green-500 font-bold text-4xl -rotate-12 bg-black/20 backdrop-blur-sm">LIKE</div>
                    )}
                    {swipeDirection === 'left' && (
                        <div className="absolute top-10 right-10 p-4 border-4 border-red-500 rounded-lg text-red-500 font-bold text-4xl rotate-12 bg-black/20 backdrop-blur-sm">NOPE</div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-8 mt-10">
                    <button
                        onClick={() => handleSwipe('left')}
                        className="w-16 h-16 rounded-full bg-[#181818] text-red-500 border border-neutral-800 hover:bg-red-500 hover:text-white hover:scale-110 hover:border-red-500 transition-all flex items-center justify-center shadow-lg"
                    >
                        <X size={32} strokeWidth={3} />
                    </button>

                    <button
                        onClick={() => handleSwipe('right')}
                        disabled={!playlistId}
                        className={`w-16 h-16 rounded-full bg-[#181818] border border-neutral-800 flex items-center justify-center shadow-lg transition-all ${!playlistId ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-green-500 hover:bg-green-500 hover:text-white hover:scale-110 hover:border-green-500'}`}
                    >
                        <Heart size={32} fill="currentColor" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DiscoveryDeck;
