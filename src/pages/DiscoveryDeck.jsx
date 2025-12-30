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
            <div className="py-12 animate-apple-in max-w-5xl mx-auto px-4">
                <header className="mb-16">
                    <button onClick={() => navigate('/dashboard')} className="mb-10 flex items-center text-blue-500 font-bold text-sm bg-blue-500/10 px-5 py-2 rounded-full hover:bg-blue-500/20 transition-all w-fit">
                        <ArrowLeft size={16} className="mr-2" /> Dashboard
                    </button>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 leading-none">Discovery</h1>
                    <p className="text-gray-400 text-xl font-medium tracking-tight max-w-lg">Swipe to find your new favorite frequency in the digital ocean.</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {VIBES.map(v => (
                        <button
                            key={v.id}
                            onClick={() => loadVibe(v.id)}
                            className="apple-card-interactive p-10 flex flex-col items-center text-center gap-8 group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />

                            <div className={`w-20 h-20 rounded-[32px] bg-white/5 flex items-center justify-center text-white/80 group-hover:scale-110 group-hover:bg-white/10 transition-all duration-500 shadow-2xl border border-white/10`}>
                                {React.cloneElement(v.icon, { size: 40, strokeWidth: 1.5 })}
                            </div>
                            <div>
                                <h2 className="text-3xl font-extrabold mb-2 tracking-tighter uppercase">{v.name}</h2>
                                <p className="text-gray-500 text-sm font-bold tracking-tight opacity-80">{v.desc}</p>
                            </div>
                        </button>
                    ))}
                </div>
                {errorMsg && <p className="text-red-500 mt-12 font-bold bg-red-500/10 px-8 py-5 rounded-[24px] border border-red-500/20 text-center animate-pulse">{errorMsg}</p>}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-white">
                <Loader2 className="animate-spin text-blue-500 mb-6" size={48} />
                <p className="text-lg font-bold tracking-tight text-gray-400">Curating your deck...</p>
            </div>
        );
    }

    if (!currentTrack) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-white p-6 text-center animate-apple-in">
                <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-8 border border-white/5 shadow-2xl">
                    <Music2 size={48} className="text-gray-600" />
                </div>
                <h2 className="text-4xl font-black mb-4 tracking-tighter">Deck Finished</h2>
                <p className="text-gray-500 mb-10 max-w-xs font-medium">{errorMsg || "You've explored everything in this frequency for now."}</p>
                <button onClick={() => setInitDone(false)} className="apple-button-primary px-12 py-4">
                    Try Another Vibe
                </button>
            </div>
        );
    }

    return (
        <div className="py-8 animate-apple-in min-h-[85vh] flex flex-col">
            <header className="mb-12 max-w-md mx-auto w-full px-4">
                <button onClick={() => setInitDone(false)} className="flex items-center text-blue-500 font-bold text-sm bg-blue-500/10 px-5 py-2 rounded-full hover:bg-blue-500/20 transition-all w-fit">
                    <ArrowLeft size={16} className="mr-2" /> Vibe Select
                </button>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center relative pb-20 px-4">
                <div className="relative w-full max-w-[400px] aspect-[10/14]">
                    {/* Card Underlay (Stack effect) */}
                    <div className="absolute inset-0 translate-y-6 scale-90 bg-white/5 rounded-[48px] border border-white/10 -z-10 shadow-2xl backdrop-blur-sm" />
                    <div className="absolute inset-0 translate-y-3 scale-95 bg-white/10 rounded-[48px] border border-white/10 -z-10 shadow-xl backdrop-blur-sm" />

                    <div className={`relative w-full h-full bg-[#1c1c1e] rounded-[48px] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)] border border-white/15 transition-all duration-700 cubic-bezier(0.2, 1, 0.2, 1) transform-gpu ${swipeDirection === 'left' ? '-translate-x-[150%] rotate-[-25deg] opacity-0 scale-75' : ''} ${swipeDirection === 'right' ? 'translate-x-[150%] rotate-[25deg] opacity-0 scale-75' : ''}`}>
                        {currentTrack.album.images[0] && (
                            <img src={currentTrack.album.images[0].url} className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-transform duration-[2000ms] group-hover:scale-110" alt="" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

                        <div className="absolute bottom-0 left-0 right-0 p-10 pt-40">
                            <h2 className="text-4xl md:text-5xl font-black mb-3 tracking-tighter drop-shadow-2xl leading-[0.9] text-white uppercase">{currentTrack.name}</h2>
                            <p className="text-xl text-gray-300 mb-10 font-bold tracking-tight opacity-95">{currentTrack.artists[0].name}</p>

                            <button
                                onClick={togglePreview}
                                disabled={!currentTrack.preview_url}
                                className={`w-full py-5 rounded-[24px] flex items-center justify-center gap-4 transition-all font-black tracking-[0.1em] uppercase shadow-2xl ${currentTrack.preview_url ? 'apple-glass-light hover:bg-white/15 hover:scale-[1.02] active:scale-95 text-white border border-white/20' : 'bg-white/5 text-gray-600 cursor-not-allowed border border-white/5'}`}
                            >
                                {currentTrack.preview_url ? (
                                    <>
                                        {isPlaying ? <Pause fill="white" size={24} /> : <Play fill="white" size={24} />}
                                        {isPlaying ? 'Pause' : 'Preview'}
                                    </>
                                ) : 'Preview Unavailable'}
                            </button>
                        </div>
                    </div>

                    <div className="absolute -bottom-16 md:-bottom-24 left-0 right-0 flex items-center justify-center gap-8 translate-y-4">
                        <button onClick={() => handleSwipe('left')} className="w-20 h-20 rounded-full apple-glass-light text-red-500 border border-red-500/20 flex items-center justify-center shadow-2xl active:scale-90 hover:bg-red-500/20 transition-all group">
                            <X size={36} strokeWidth={3} className="group-hover:rotate-12 transition-transform" />
                        </button>
                        <button onClick={() => handleSwipe('right')} className="w-20 h-20 rounded-full apple-glass-light text-green-500 border border-green-500/20 flex items-center justify-center shadow-2xl active:scale-90 hover:bg-green-500/20 transition-all group">
                            <Heart size={36} fill="none" strokeWidth={2.5} className="group-hover:scale-125 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiscoveryDeck;
