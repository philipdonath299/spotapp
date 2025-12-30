import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, X, Heart, Play, Pause, Loader2, Music2, Layers, Search, Mic2, Disc } from 'lucide-react';

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
    const [userMarket, setUserMarket] = useState('US'); // Default fallback

    // Reliable Search-based vibes
    const VIBES = [
        { name: "Pop Hits", query: "Today's Top Hits", color: "blue", icon: <Layers /> },
        { name: "Hip Hop", query: "RapCaviar", color: "red", icon: <Mic2 /> },
        { name: "Indie/Alt", query: "Indie Pop", color: "orange", icon: <Disc /> },
        { name: "Electronic", query: "Mint", color: "purple", icon: <Music2 /> },
        { name: "Classic Rock", query: "Rock Classics", color: "green", icon: <Layers /> },
        { name: "Fresh Finds", query: "Fresh Finds", color: "pink", icon: <Search /> }
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

    const initDiscovery = async () => {
        try {
            const me = await spotifyFetch('/me');
            if (!me || !me.id) {
                setErrorMsg("Could not fetch user profile.");
                return;
            }
            setUserMarket(me.country || 'US');

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
            console.error("Discovery init failed:", err);
            setErrorMsg(`Init Error: ${err.message}`);
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
            playPromise.then(() => setIsPlaying(true))
                .catch(e => { console.warn("Auto-play blocked", e); setIsPlaying(false); });
        }
        newAudio.onended = () => setIsPlaying(false);
        setAudio(newAudio);
        return newAudio;
    };

    const loadDiscoverySource = async (query) => {
        setLoading(true);
        setErrorMsg('');
        setInitDone(true);
        try {
            // 1. Search for a playlist matching the vibe (Market-aware)
            let searchUrl = `/search?q=${encodeURIComponent(query)}&type=playlist&limit=10&market=${userMarket}`;
            let searchRes = await spotifyFetch(searchUrl);

            // If No localized results found, try global search
            if (!searchRes?.playlists?.items?.length) {
                console.log(`Vibe "${query}" not found in market ${userMarket}, trying global...`);
                searchUrl = `/search?q=${encodeURIComponent(query)}&type=playlist&limit=10`;
                searchRes = await spotifyFetch(searchUrl);
            }

            // Prioritize Spotify-owned playlists
            let playlist = searchRes?.playlists?.items?.find(p =>
                p && p.owner && (
                    p.owner.display_name?.toLowerCase().includes('spotify') ||
                    p.owner.id === 'spotify'
                )
            ) || searchRes?.playlists?.items?.[0];

            // 2. Broad Fallback if still nothing
            if (!playlist) {
                console.log(`Still nothing for "${query}", trying broad "Top 50"...`);
                searchUrl = `/search?q=${encodeURIComponent("Top 50 - Global")}&type=playlist&limit=1`;
                searchRes = await spotifyFetch(searchUrl);
                playlist = searchRes?.playlists?.items?.[0];
            }

            if (!playlist) {
                throw new Error(`We couldn't find any music for "${query}" right now. Try a different vibe!`);
            }

            // 2. Fetch tracks
            const trackRes = await spotifyFetch(`/playlists/${playlist.id}/tracks?limit=50`);

            const tracks = (trackRes?.items || [])
                .map(i => i.track)
                .filter(t => t && t.id && !t.is_local && t.preview_url);

            if (tracks.length === 0) {
                throw new Error("No playable tracks found in this vibe. Try a different one!");
            }

            // Shuffle
            for (let i = tracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
            }

            setQueue(tracks);
            setCurrentTrack(tracks[0]);
            playPreview(tracks[0], audio);

        } catch (err) {
            console.error(err);
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSwipe = async (direction) => {
        if (!currentTrack || !queue.length) return;
        if (audio) { audio.pause(); setIsPlaying(false); }
        setSwipeDirection(direction);
        if (direction === 'right') addToPlaylist(currentTrack.uri);

        setTimeout(() => {
            const nextQueue = queue.slice(1);
            setQueue(nextQueue);
            const nextTrack = nextQueue[0] || null;
            setCurrentTrack(nextTrack);
            setSwipeDirection(null);
            if (nextTrack) playPreview(nextTrack, audio);
        }, 300);
    };

    const addToPlaylist = async (uri) => {
        if (!playlistId) return;
        try {
            await spotifyFetch(`/playlists/${playlistId}/tracks`, 'POST', { uris: [uri] });
        } catch (err) { console.error("Save failed", err); }
    };

    const togglePreview = () => {
        if (!currentTrack?.preview_url || !audio) return;
        if (isPlaying) { audio.pause(); setIsPlaying(false); }
        else { audio.play().catch(e => console.warn(e)); setIsPlaying(true); }
    };

    if (!initDone) {
        return (
            <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center animate-fade-in relative">
                <button onClick={() => navigate('/dashboard')} className="absolute top-6 left-6 flex items-center text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="mr-2" size={20} /> Exit
                </button>
                <header className="text-center mb-12">
                    <h1 className="text-4xl font-bold mb-3 flex items-center justify-center gap-3">
                        <Layers className="text-blue-500" /> Discovery Deck
                    </h1>
                    <p className="text-gray-400">Pick a vibe to start your session.</p>
                </header>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-4xl">
                    {VIBES.map(v => (
                        <button
                            key={v.name}
                            onClick={() => loadDiscoverySource(v.query)}
                            className={`p-6 rounded-2xl bg-gradient-to-br from-${v.color}-900/10 to-${v.color}-900/30 border border-${v.color}-500/20 hover:border-${v.color}-500 transition-all text-left flex flex-col justify-between aspect-square group overflow-hidden relative`}
                        >
                            <div className={`p-4 rounded-full bg-${v.color}-500/10 text-${v.color}-400 w-fit group-hover:scale-110 transition-transform`}>
                                {v.icon}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{v.name}</h2>
                                <p className="text-xs text-gray-500 mt-1">Explore Mix</p>
                            </div>
                            <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-${v.color}-500/10 blur-3xl rounded-full`} />
                        </button>
                    ))}
                </div>
                {errorMsg && <p className="text-red-500 mt-8 font-medium bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">{errorMsg}</p>}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                <p className="text-xl font-bold">Mixing your deck...</p>
            </div>
        );
    }

    if (!currentTrack) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
                <Music2 size={64} className="text-neutral-700 mb-6" />
                <h2 className="text-2xl font-bold mb-2">Deck Empty</h2>
                <p className="text-gray-400 mb-6">{errorMsg || "We've reached the bottom of this pile."}</p>
                <button onClick={() => setInitDone(false)} className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors">
                    Pick Another Vibe
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 flex flex-col animate-fade-in pb-20 overflow-hidden relative">
            <button onClick={() => setInitDone(false)} className="absolute top-6 left-6 z-20 flex items-center text-gray-400 hover:text-white transition-colors">
                <ArrowLeft className="mr-2" size={20} /> Back
            </button>

            <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full relative">
                <div className={`relative w-full aspect-[4/5] bg-[#181818] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-300 ${swipeDirection === 'left' ? '-translate-x-full rotate-[-20deg] opacity-0' : ''} ${swipeDirection === 'right' ? 'translate-x-full rotate-[20deg] opacity-0' : ''}`}>
                    {currentTrack.album.images[0] && <img src={currentTrack.album.images[0].url} className="absolute inset-0 w-full h-full object-cover" alt="" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-8">
                        <h2 className="text-2xl font-bold mb-2 drop-shadow-lg leading-tight">{currentTrack.name}</h2>
                        <p className="text-lg text-gray-300 mb-6 drop-shadow-md">{currentTrack.artists[0].name}</p>
                        <div className="flex items-center gap-4">
                            <button onClick={togglePreview} className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/50 text-white font-bold py-3 px-6 rounded-full flex items-center justify-center gap-2 transition-all">
                                {isPlaying ? <Pause fill="white" size={20} /> : <Play fill="white" size={20} />}
                                {isPlaying ? 'Pause' : 'Playing Preview'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-8 mt-10">
                    <button onClick={() => handleSwipe('left')} className="w-16 h-16 rounded-full bg-[#181818] text-red-500 border border-neutral-800 hover:bg-red-500 hover:text-white hover:scale-110 transition-all flex items-center justify-center shadow-lg">
                        <X size={32} strokeWidth={3} />
                    </button>
                    <button onClick={() => handleSwipe('right')} disabled={!playlistId} className={`w-16 h-16 rounded-full bg-[#181818] border border-neutral-800 flex items-center justify-center shadow-lg transition-all ${!playlistId ? 'opacity-50' : 'text-green-500 hover:bg-green-500 hover:text-white hover:scale-110'}`}>
                        <Heart size={32} fill="currentColor" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DiscoveryDeck;
