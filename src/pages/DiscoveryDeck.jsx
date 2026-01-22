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
                foundPlaylist = res?.items?.find(p => p.name === "My Discovery Deck");
                nextUrl = res?.next;
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
            let query = vibeId;
            if (vibeId === 'for-you') {
                if (topArtists.length > 0) {
                    const randomArtist = topArtists[Math.floor(Math.random() * topArtists.length)];
                    query = `artist:"${randomArtist}"`;
                } else {
                    query = "genre:pop";
                }
            }

            // Strategy 1: Search with market
            let searchRes = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=50&market=${userMarket}`);
            tracks = searchRes?.tracks?.items || [];

            // Strategy 2: If no tracks, search WITHOUT market (sometimes market parameter bugs out)
            if (tracks.length === 0) {
                console.log(`No results for "${query}" with market ${userMarket}, retrying global...`);
                searchRes = await spotifyFetch(`/search?q=${encodeURIComponent(query)}&type=track&limit=50`);
                tracks = searchRes?.tracks?.items || [];
            }

            // Strategy 3: Hard fallback to general pop if still nothing
            if (tracks.length === 0) {
                console.log(`Still no results, hard fallback to pop...`);
                searchRes = await spotifyFetch(`/search?q=genre:pop&type=track&limit=50`);
                tracks = searchRes?.tracks?.items || [];
            }

            if (tracks.length === 0) {
                throw new Error("Spotify search returned zero results for your region.");
            }

            // Get existing uris to avoid duplicates
            let existingUris = new Set();
            if (playlistId) {
                try {
                    const currentRes = await spotifyFetch(`/playlists/${playlistId}/tracks?limit=100`);
                    if (currentRes?.items) currentRes.items.forEach(i => { if (i.track) existingUris.add(i.track.uri); });
                } catch (e) { console.warn("Duplicate check failed", e); }
            }

            // Strategy 4: Filter for playable (preview_url exists)
            let cleanTracks = tracks.filter(t => t && t.id && !t.is_local && t.preview_url && !existingUris.has(t.uri));

            // Strategy 5: If ALL tracks are filtered out because they lack previews, 
            // relax the constraint so the user at least sees SOMETHING.
            if (cleanTracks.length === 0) {
                console.warn("No tracks with previews found. Relaxing preview constraint.");
                cleanTracks = tracks.filter(t => t && t.id && !t.is_local && !existingUris.has(t.uri));
            }

            if (cleanTracks.length === 0) {
                throw new Error(`All discovered tracks are already in your Deck! Try a different vibe.`);
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
            <div className="py-20  max-w-6xl mx-auto px-6">
                <header className="mb-24">
                    <button onClick={() => navigate('/dashboard')} className="mb-10 flex items-center text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">
                        <ArrowLeft size={16} className="mr-2" /> Dashboard
                    </button>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
                        <div className="max-w-2xl">
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 ml-1">Daily Mixes</p>
                            <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-white mb-8">
                                Discovery
                            </h1>
                            <p className="text-white/40 text-lg font-black tracking-widest uppercase max-w-lg leading-relaxed">
                                Swipe to find your new favorite songs in the music ocean.
                            </p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {VIBES.map(v => (
                        <button
                            key={v.id}
                            onClick={() => loadVibe(v.id)}
                            className="ios26-card-interactive p-8 md:p-12 flex flex-col items-center text-center gap-6 md:gap-10 group relative overflow-hidden"
                        >
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-${v.color}-500/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-1000`} />

                            <div className={`w-20 h-20 md:w-24 md:h-24 rounded-[32px] md:rounded-[36px] ios26-liquid flex items-center justify-center text-white/80 group-hover:scale-110 transition-all duration-700 shadow-2xl border border-white/20`}>
                                {React.cloneElement(v.icon, { size: 36, strokeWidth: 1 })}
                            </div>

                            <div>
                                <h2 className="text-3xl font-black mb-3 tracking-tighter uppercase text-white group-hover:text-blue-500 transition-colors">{v.name}</h2>
                                <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em]">{v.desc}</p>
                            </div>

                            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                                <ArrowLeft className="rotate-180 text-blue-500" size={18} />
                            </div>
                        </button>
                    ))}
                </div>
                {errorMsg && (
                    <div className="mt-20 ios26-card p-8 border border-red-500/20 text-center animate-pulse">
                        <p className="text-red-500 font-black uppercase tracking-widest text-xs">{errorMsg}</p>
                    </div>
                )}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-white relative">
                <div className="absolute inset-0 bg-blue-500/5 blur-[120px] rounded-full -z-10 animate-ios26-float" />
                <div className="w-24 h-24 ios26-liquid rounded-[32px] flex items-center justify-center mb-10 shadow-2xl border border-white/20">
                    <Loader2 className="animate-spin text-blue-500" size={40} />
                </div>
                <p className="text-[10px] font-black tracking-[0.4em] uppercase text-white/40 animate-pulse">Syncing frequencies...</p>
            </div>
        );
    }

    if (!currentTrack) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-white px-8 text-center ">
                <div className="w-24 h-24 ios26-glass rounded-[32px] flex items-center justify-center mb-10 border border-white/10 shadow-2xl">
                    <Music2 size={40} className="text-white/20" />
                </div>
                <h2 className="text-6xl font-black mb-4 tracking-tighter uppercase text-white leading-none">Signal Lost</h2>
                <p className="text-[10px] text-white/30 mb-12 max-w-[240px] font-black uppercase tracking-[0.2em] leading-loose">
                    {errorMsg || "Temporal window closed. All local signals have been processed."}
                </p>
                <button
                    onClick={() => setInitDone(false)}
                    className="ios26-liquid px-14 py-5 font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 active:scale-95 transition-all text-white border border-white/20 shadow-2xl"
                >
                    Retune Archetype
                </button>
            </div>
        );
    }

    return (
        <div className="py-12  min-h-[90vh] flex flex-col relative overflow-hidden">
            {/* Ambient background glow matching track colors */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full -z-10 animate-ios26-float" />

            <header className="mb-16 max-w-md mx-auto w-full px-6">
                <button onClick={() => setInitDone(false)} className="flex items-center text-white/40 font-black text-[9px] uppercase tracking-[0.4em] hover:text-white transition-colors group">
                    <ArrowLeft size={14} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Mixes
                </button>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center relative pb-32 px-6">
                <div className="relative w-full max-w-[420px] aspect-[10/15] group">
                    {/* iOS 26 Spatial Stack Underlays */}
                    <div className="absolute inset-0 translate-y-12 scale-90 ios26-glass opacity-20 -z-30 rounded-[64px]" />
                    <div className="absolute inset-0 translate-y-6 scale-95 ios26-glass opacity-40 -z-20 rounded-[64px]" />

                    {/* Main Interaction Card */}
                    <div className={`relative w-full h-full ios26-card rounded-[64px] overflow-hidden shadow-[0_80px_160px_-40px_rgba(0,0,0,0.8)] transition-all duration-700 cubic-bezier(0.2, 1, 0.2, 1) transform-gpu ${swipeDirection === 'left' ? '-translate-x-[150%] rotate-[-30deg] opacity-0 scale-75' : ''} ${swipeDirection === 'right' ? 'translate-x-[150%] rotate-[30deg] opacity-0 scale-75' : ''}`}>

                        {/* Artwork with Parallax/Hover effect potential */}
                        {currentTrack.album.images[0] && (
                            <div className="absolute inset-0 overflow-hidden">
                                <img
                                    src={currentTrack.album.images[0].url}
                                    className="w-full h-full object-cover grayscale-[0.2] brightness-75 group-hover:scale-110 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-[2000ms]"
                                    alt=""
                                />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/30 pointer-events-none" />

                        {/* Content Overlay */}
                        <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
                            <div className="mb-6 md:mb-8 p-1.5 ios26-glass w-fit rounded-full px-4 border border-white/10 backdrop-blur-3xl">
                                <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em]">NEW TRACK DETECTED</span>
                            </div>

                            <h2 className="text-5xl md:text-6xl font-black mb-4 tracking-tighter leading-[0.85] text-white uppercase drop-shadow-2xl">
                                {currentTrack.name}
                            </h2>
                            <p className="text-xl text-white/60 mb-12 font-black tracking-widest uppercase truncate">
                                {currentTrack.artists[0].name}
                            </p>

                            <button
                                onClick={togglePreview}
                                disabled={!currentTrack.preview_url}
                                className={`w-full py-6 rounded-[32px] flex items-center justify-center gap-4 transition-all duration-500 font-black tracking-[0.2em] uppercase shadow-2xl relative overflow-hidden group/btn ${currentTrack.preview_url
                                    ? 'ios26-liquid text-white border border-white/20 hover:scale-[1.02] active:scale-95'
                                    : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                                    }`}
                            >
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                {currentTrack.preview_url ? (
                                    <>
                                        {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
                                        <span className="relative z-10 text-[10px]">{isPlaying ? 'Stop' : 'Play'}</span>
                                    </>
                                ) : <span className="text-[10px]">No Signal</span>}
                            </button>
                        </div>
                    </div>

                    {/* Spatial Controls */}
                    <div className="absolute -bottom-16 md:-bottom-20 left-0 right-0 flex items-center justify-center gap-6 md:gap-10 translate-y-4">
                        <button
                            onClick={() => handleSwipe('left')}
                            className="w-20 h-20 md:w-24 md:h-24 rounded-full ios26-glass text-red-500 border border-white/10 flex items-center justify-center shadow-2xl active:scale-90 hover:bg-red-500/10 transition-all group overflow-hidden"
                            title="Discard Signal"
                        >
                            <div className="absolute inset-0 bg-red-500/0 group-hover:bg-red-500/5 transition-colors" />
                            <X size={32} strokeWidth={1} className="relative z-10 group-hover:rotate-90 transition-transform duration-700 md:size-[40px]" />
                        </button>

                        <button
                            onClick={() => handleSwipe('right')}
                            className="w-20 h-20 md:w-24 md:h-24 rounded-full ios26-liquid text-green-400 border border-white/20 flex items-center justify-center shadow-2xl active:scale-90 hover:scale-110 transition-all group overflow-hidden"
                            title="Acknowledge Frequency"
                        >
                            <div className="absolute inset-0 bg-green-500/0 group-hover:bg-green-500/10 transition-colors" />
                            <Heart size={32} strokeWidth={1} fill="none" className="relative z-10 group-hover:scale-125 transition-transform duration-700 md:size-[40px]" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiscoveryDeck;
