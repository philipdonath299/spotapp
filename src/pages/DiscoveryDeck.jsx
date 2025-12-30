import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, X, Heart, Play, Pause, Loader2, Music2, Sparkles, User, Search, Mic2, Disc, Music } from 'lucide-react';

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
    const [userMarket, setUserMarket] = useState('US');
    const [topArtists, setTopArtists] = useState([]);
    const audioRef = useRef(null);

    const VIBES = [
        { name: "For You", id: "for-you", color: "purple", icon: <Sparkles />, desc: "Based on artists you love" },
        { name: "Pop", id: "genre:pop", color: "blue", icon: <Music />, desc: "Top hits & viral tracks" },
        { name: "Hip Hop", id: "genre:hip-hop", color: "red", icon: <Mic2 />, desc: "The culture right now" },
        { name: "Indie", id: "genre:indie", color: "orange", icon: <Disc />, desc: "Alternative & fresh finds" },
        { name: "Electronic", id: "genre:electronic", color: "green", icon: <Music2 />, desc: "Beats & night vibes" },
        { name: "Rock", id: "genre:rock", color: "yellow", icon: <Search />, desc: "Classic & modern anthems" }
    ];

    useEffect(() => {
        initDiscovery();
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        };
    }, []);

    const initDiscovery = async () => {
        try {
            const me = await spotifyFetch('/me');
            if (!me) return;
            setUserMarket(me.country || 'US');

            // 1. Find or Create "My Discovery Deck" playlist (with pagination)
            let foundPlaylist = null;
            let nextUrl = '/me/playlists?limit=50';
            while (nextUrl && !foundPlaylist) {
                const res = await spotifyFetch(nextUrl.replace('https://api.spotify.com/v1', ''));
                foundPlaylist = res.items.find(p => p.name === "My Discovery Deck");
                nextUrl = res.next;
            }

            if (foundPlaylist) {
                setPlaylistId(foundPlaylist.id);
            } else {
                const newList = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                    name: "My Discovery Deck",
                    description: "Tracks I liked in the Discovery Deck.",
                    public: false
                });
                setPlaylistId(newList.id);
            }

            // 2. Fetch Top Artists for "For You" Vibe
            const topRes = await spotifyFetch('/me/top/artists?limit=10&time_range=medium_term');
            if (topRes?.items) setTopArtists(topRes.items.map(a => a.name));

        } catch (err) {
            console.error("Init failed:", err);
            setErrorMsg("Connection stable, but profile sync failed. Try again?");
        }
    };

    const playPreview = (track) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = "";
        }
        if (!track?.preview_url) {
            setIsPlaying(false);
            return;
        }
        const newAudio = new Audio(track.preview_url);
        newAudio.volume = 0.5;
        audioRef.current = newAudio;

        const playPromise = newAudio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => setIsPlaying(true))
                .catch(e => { console.warn("Autoplay blocked", e); setIsPlaying(false); });
        }
        newAudio.onended = () => setIsPlaying(false);
        setAudio(newAudio);
    };

    const loadVibe = async (vibeId) => {
        setLoading(true);
        setErrorMsg('');
        setInitDone(true);
        try {
            let tracks = [];

            // Step 1: Search for tracks directly (Type=Track is most reliable global API)
            let query = vibeId;
            if (vibeId === 'for-you') {
                if (topArtists.length > 0) {
                    const randomArtist = topArtists[Math.floor(Math.random() * topArtists.length)];
                    query = `artist:"${randomArtist}"`;
                } else {
                    query = "genre:pop"; // Fallback
                }
            }

            const searchRes = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=50&market=${userMarket}`);
            tracks = searchRes?.tracks?.items || [];

            // Step 2: Filter for playables & duplicates
            let existingUris = new Set();
            if (playlistId) {
                try {
                    const currentRes = await spotifyFetch(`/playlists/${playlistId}/tracks?limit=100`);
                    if (currentRes?.items) currentRes.items.forEach(i => { if (i.track) existingUris.add(i.track.uri); });
                } catch (e) { console.warn("Duplicate check failed", e); }
            }

            const cleanTracks = tracks.filter(t => t && t.id && !t.is_local && t.preview_url && !existingUris.has(t.uri));

            if (cleanTracks.length === 0) {
                throw new Error(`No new tracks found for this vibe in your region (${userMarket}).`);
            }

            // Shuffle
            const shuffled = [...cleanTracks].sort(() => Math.random() - 0.5);

            setQueue(shuffled);
            setCurrentTrack(shuffled[0]);
            playPreview(shuffled[0]);

        } catch (err) {
            console.error(err);
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSwipe = async (direction) => {
        if (!currentTrack || !queue.length) return;
        if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); }
        setSwipeDirection(direction);

        if (direction === 'right') {
            try {
                await spotifyFetch(`/playlists/${playlistId}/tracks`, 'POST', { uris: [currentTrack.uri] });
            } catch (err) { console.error("Save failed", err); }
        }

        setTimeout(() => {
            const nextQueue = queue.slice(1);
            setQueue(nextQueue);
            const nextTrack = nextQueue[0] || null;
            setCurrentTrack(nextTrack);
            setSwipeDirection(null);
            if (nextTrack) playPreview(nextTrack);
        }, 300);
    };

    const togglePreview = () => {
        if (!audioRef.current) return;
        if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
        else { audioRef.current.play().catch(e => console.warn(e)); setIsPlaying(true); }
    };

    if (!initDone) {
        return (
            <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center animate-fade-in relative">
                <button onClick={() => navigate('/dashboard')} className="absolute top-6 left-6 flex items-center text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="mr-2" size={20} /> Exit
                </button>
                <header className="text-center mb-12">
                    <h1 className="text-5xl font-extrabold mb-4 tracking-tighter bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        Discovery Deck
                    </h1>
                    <p className="text-gray-400 text-lg">Swipe to discover your next obsession.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
                    {VIBES.map(v => (
                        <button
                            key={v.id}
                            onClick={() => loadVibe(v.id)}
                            className={`p-8 rounded-3xl bg-[#121212] border border-white/5 hover:border-${v.color}-500 transition-all text-left group overflow-hidden relative active:scale-95`}
                        >
                            <div className={`w-14 h-14 rounded-2xl bg-${v.color}-500/10 text-${v.color}-400 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-${v.color}-500/20 transition-all`}>
                                {React.cloneElement(v.icon, { size: 28 })}
                            </div>
                            <h2 className="text-2xl font-bold mb-2">{v.name}</h2>
                            <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
                            <div className={`absolute -right-8 -bottom-8 w-32 h-32 bg-${v.color}-500/5 blur-3xl rounded-full`} />
                        </button>
                    ))}
                </div>
                {errorMsg && <p className="text-red-500 mt-10 font-bold bg-red-500/10 px-6 py-3 rounded-full border border-red-500/20">{errorMsg}</p>}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
                <Loader2 className="animate-spin text-purple-500 mb-6" size={64} />
                <p className="text-2xl font-black tracking-tighter animate-pulse text-gray-400">BUILDING YOUR DECK...</p>
            </div>
        );
    }

    if (!currentTrack) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-6 text-center">
                <div className="w-24 h-24 bg-neutral-900 rounded-full flex items-center justify-center mb-8 border border-neutral-800">
                    <Music2 size={48} className="text-neutral-700" />
                </div>
                <h2 className="text-3xl font-black mb-4">Deck Empty</h2>
                <p className="text-gray-400 mb-10 max-w-xs">{errorMsg || "We've filtered through your region and found no new playable tracks in this vibe."}</p>
                <button onClick={() => setInitDone(false)} className="px-10 py-4 bg-white text-black font-black uppercase tracking-widest rounded-full hover:bg-gray-200 transition-all active:scale-95 shadow-xl">
                    Try Another Vibe
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 flex flex-col animate-fade-in pb-20 items-center justify-center overflow-hidden relative">
            <button onClick={() => setInitDone(false)} className="absolute top-8 left-8 z-20 flex items-center text-gray-400 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs">
                <ArrowLeft className="mr-2" size={16} /> Deck Select
            </button>

            <div className="relative w-full max-w-[400px] aspect-[3.5/5]">
                <div className={`relative w-full h-full bg-[#181818] rounded-[40px] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] border border-white/5 transition-all duration-300 ease-out transform-gpu ${swipeDirection === 'left' ? '-translate-x-[150%] rotate-[-30deg] opacity-0 scale-75' : ''} ${swipeDirection === 'right' ? 'translate-x-[150%] rotate-[30deg] opacity-0 scale-75' : ''}`}>
                    {currentTrack.album.images[0] && (
                        <img src={currentTrack.album.images[0].url} className="absolute inset-0 w-full h-full object-cover pointer-events-none" alt="" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent pointer-events-none" />

                    <div className="absolute bottom-0 left-0 right-0 p-10 pt-40">
                        <div className="mb-2 inline-flex items-center px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/70">
                            Now Playing
                        </div>
                        <h2 className="text-4xl font-black mb-3 tracking-tighter drop-shadow-2xl leading-[0.9]">{currentTrack.name}</h2>
                        <p className="text-xl text-gray-300 mb-8 font-medium italic opacity-80">{currentTrack.artists[0].name}</p>

                        <button onClick={togglePreview} className="w-full bg-white text-black font-black py-5 rounded-3xl flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl">
                            {isPlaying ? <Pause fill="black" size={24} /> : <Play fill="black" size={24} />}
                            {isPlaying ? 'PAUSE PREVIEW' : 'PLAY PREVIEW'}
                        </button>
                    </div>
                </div>

                <div className="absolute -bottom-24 left-0 right-0 flex items-center justify-center gap-8 px-4">
                    <button onClick={() => handleSwipe('left')} className="flex-1 max-w-[80px] h-20 rounded-full bg-[#181818] text-red-500 border border-white/5 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-2xl active:scale-90 group">
                        <X size={36} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <button onClick={() => handleSwipe('right')} className="flex-1 max-w-[80px] h-20 rounded-full bg-[#181818] text-green-500 border border-white/5 hover:bg-green-500 hover:text-white transition-all flex items-center justify-center shadow-2xl active:scale-90 group">
                        <Heart size={36} fill="currentColor" className="group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DiscoveryDeck;
