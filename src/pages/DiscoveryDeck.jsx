import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, X, Heart, Play, Pause, Loader2, Music2, SkipForward } from 'lucide-react';

const DiscoveryDeck = () => {
    const navigate = useNavigate();
    const [queue, setQueue] = useState([]);
    const [currentTrack, setCurrentTrack] = useState(null);
    const [loading, setLoading] = useState(true);
    const [playlistId, setPlaylistId] = useState(null);
    const [swipeDirection, setSwipeDirection] = useState(null); // 'left' | 'right'
    const [isPlaying, setIsPlaying] = useState(false);
    const [audio, setAudio] = useState(null);

    useEffect(() => {
        initDiscovery();
        return () => {
            if (audio) {
                audio.pause();
                setAudio(null);
            }
        };
    }, []);

    const initDiscovery = async () => {
        try {
            await Promise.all([
                fetchRecommendations(),
                findOrCreatePlaylist()
            ]);
        } catch (err) {
            console.error("Init failed:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecommendations = async () => {
        try {
            // Seed with top artists
            const topArtists = await spotifyFetch('/me/top/artists?limit=5&time_range=short_term');
            if (!topArtists?.items?.length) return;

            const seeds = topArtists.items.map(a => a.id).join(',');
            const res = await spotifyFetch(`/recommendations?seed_artists=${seeds}&limit=50`);

            if (res?.tracks) {
                // Filter out songs without audio previews if you want strict preview availability
                // For now, we'll keep them all but disable preview button if missing
                setQueue(res.tracks);
                setCurrentTrack(res.tracks[0]);
            }
        } catch (err) {
            console.error("Fetch recommendations failed:", err);
        }
    };

    const findOrCreatePlaylist = async () => {
        try {
            const me = await spotifyFetch('/me');
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
        }
    };

    const handleSwipe = async (direction) => {
        if (!currentTrack || !queue.length) return;

        // Stop audio
        if (audio) {
            audio.pause();
            setIsPlaying(false);
        }

        setSwipeDirection(direction);

        if (direction === 'right') {
            addToPlaylist(currentTrack.uri);
        }

        // Animation delay
        setTimeout(() => {
            const nextQueue = queue.slice(1);
            setQueue(nextQueue);
            setCurrentTrack(nextQueue[0] || null);
            setSwipeDirection(null);

            // Auto-fetch more if running low
            if (nextQueue.length < 5) fetchRecommendations();
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
        if (!currentTrack?.preview_url) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            const newAudio = new Audio(currentTrack.preview_url);
            newAudio.volume = 0.5;
            newAudio.play();
            newAudio.onended = () => setIsPlaying(false);
            setAudio(newAudio);
            setIsPlaying(true);
        }
    };

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
                <p className="text-gray-400 mb-6">You've swiped through all our recommendations for now.</p>
                <button
                    onClick={() => { setLoading(true); fetchRecommendations(); }}
                    className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors"
                >
                    Refresh Deck
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 flex flex-col animate-fade-in pb-20 overflow-hidden relative">
            <button
                onClick={() => navigate('/dashboard')}
                className="absolute top-6 left-6 z-20 flex items-center text-gray-400 hover:text-white transition-colors"
            >
                <ArrowLeft className="mr-2" size={20} /> Exit
            </button>

            <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full relative">

                {/* Card Container */}
                <div className={`relative w-full aspect-[4/5] bg-[#181818] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-300 ${swipeDirection === 'left' ? '-translate-x-full rotate-[-20deg] opacity-0' : ''} ${swipeDirection === 'right' ? 'translate-x-full rotate-[20deg] opacity-0' : ''}`}>

                    {/* Album Art Cover */}
                    {currentTrack.album.images[0] && (
                        <img
                            src={currentTrack.album.images[0].url}
                            className="absolute inset-0 w-full h-full object-cover"
                            alt=""
                        />
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                    {/* Preload Next Image for Smoothness */}
                    {queue[1]?.album?.images[0] && (
                        <link rel="preload" as="image" href={queue[1].album.images[0].url} />
                    )}

                    {/* Info Section */}
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
                                    {isPlaying ? 'Pause Preview' : 'Preview'}
                                </button>
                            ) : (
                                <div className="flex-1 bg-black/40 backdrop-blur-md text-gray-400 py-3 px-6 rounded-full text-center text-sm font-bold border border-white/10">
                                    No Preview
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Overlay Icons for Swiping */}
                    {swipeDirection === 'right' && (
                        <div className="absolute top-10 left-10 p-4 border-4 border-green-500 rounded-lg text-green-500 font-bold text-4xl -rotate-12 bg-black/20 backdrop-blur-sm">
                            LIKE
                        </div>
                    )}
                    {swipeDirection === 'left' && (
                        <div className="absolute top-10 right-10 p-4 border-4 border-red-500 rounded-lg text-red-500 font-bold text-4xl rotate-12 bg-black/20 backdrop-blur-sm">
                            NOPE
                        </div>
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
                        className="w-16 h-16 rounded-full bg-[#181818] text-green-500 border border-neutral-800 hover:bg-green-500 hover:text-white hover:scale-110 hover:border-green-500 transition-all flex items-center justify-center shadow-lg"
                    >
                        <Heart size={32} fill="currentColor" />
                    </button>
                </div>

                <p className="mt-6 text-xs text-neutral-500">Keyboard: ← Pass | Like →</p>
            </div>
        </div>
    );
};

export default DiscoveryDeck;
