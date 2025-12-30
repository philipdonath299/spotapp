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
    const [categories, setCategories] = useState([]);

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

    const initDiscovery = async () => {
        try {
            // 1. Fetch User Profile
            const me = await spotifyFetch('/me');
            if (!me || !me.id) {
                setErrorMsg("Could not fetch user profile. Try re-logging in.");
                return;
            }

            // 2. Find or Create "My Discovery Deck" playlist
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

            // 3. Fetch Regional Categories for the user
            const catRes = await spotifyFetch('/browse/categories?limit=8');
            if (catRes?.categories?.items) {
                setCategories(catRes.categories.items);
            }

        } catch (err) {
            console.error("Discovery init failed:", err);
            setErrorMsg(`Error: ${err.message}`);
        }
    };

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

    const loadCategoryPlaylists = async (categoryId) => {
        setLoading(true);
        setErrorMsg('');
        setInitDone(true);
        try {
            // 1. Get playlists for this category
            const res = await spotifyFetch(`/browse/categories/${categoryId}/playlists?limit=5`);
            const playlists = res?.playlists?.items?.filter(Boolean) || [];

            if (playlists.length === 0) {
                throw new Error("No playlists found for this category in your region.");
            }

            // 2. Pick a random playlist from the results for variety
            const targetPlaylist = playlists[Math.floor(Math.random() * playlists.length)];

            // 3. Fetch tracks from that playlist
            const trackRes = await spotifyFetch(`/playlists/${targetPlaylist.id}/tracks?limit=50`);

            if (trackRes?.items) {
                const tracks = trackRes.items
                    .map(i => i.track)
                    .filter(t => t && t.id && !t.is_local && t.preview_url);

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
            <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center animate-fade-in relative">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="absolute top-6 left-6 flex items-center text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="mr-2" size={20} /> Exit
                </button>

                <header className="text-center mb-10">
                    <h1 className="text-4xl font-bold mb-3 flex items-center justify-center gap-3">
                        <Layers className="text-blue-500" /> Discovery Deck
                    </h1>
                    <p className="text-gray-400">Choose a vibey category to start swiping.</p>
                </header>

                {errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-sm mb-6 max-w-md w-full">
                        {errorMsg}
                    </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => loadCategoryPlaylists(cat.id)}
                            className="relative group aspect-square rounded-2xl overflow-hidden border border-white/5 hover:border-blue-500 transition-all"
                        >
                            {cat.icons[0] && (
                                <img src={cat.icons[0].url} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500" alt="" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                            <div className="absolute inset-0 flex items-center justify-center p-4">
                                <span className="text-xl font-bold text-center drop-shadow-lg">{cat.name}</span>
                            </div>
                        </button>
                    ))}
                    {!categories.length && !errorMsg && (
                        <div className="col-span-full flex flex-col items-center py-12">
                            <Loader2 className="animate-spin text-blue-500 mb-4" />
                            <p className="text-gray-400">Fetching categories...</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                <p className="text-xl font-bold">Dealing your discovery deck...</p>
            </div>
        );
    }

    if (!currentTrack) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
                <Music2 size={64} className="text-neutral-700 mb-6" />
                <h2 className="text-2xl font-bold mb-2">Out of cards!</h2>
                <p className="text-gray-400 mb-6">{errorMsg || "You've swiped through this vibe."}</p>
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
                <ArrowLeft className="mr-2" size={20} /> Change Vibe
            </button>

            <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full relative">

                {/* Card */}
                <div className={`relative w-full aspect-[4/5] bg-[#181818] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-300 ${swipeDirection === 'left' ? '-translate-x-full rotate-[-20deg] opacity-0' : ''} ${swipeDirection === 'right' ? 'translate-x-full rotate-[20deg] opacity-0' : ''}`}>
                    {currentTrack.album.images[0] && (
                        <img src={currentTrack.album.images[0].url} className="absolute inset-0 w-full h-full object-cover" alt="" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

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
                                    {isPlaying ? 'Pause' : 'Previewing'}
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
