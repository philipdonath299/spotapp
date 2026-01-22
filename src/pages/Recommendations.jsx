import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Play, Plus, Sliders, RefreshCw, Loader2 } from 'lucide-react';

const Recommendations = () => {
    const { playlistId } = useParams();
    const navigate = useNavigate();
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState("Initializing Deep Scan...");
    const [playlistName, setPlaylistName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Deep Discovery State
    const [obscurity, setObscurity] = useState(20); // 0 (Mainstream/Popular) to 100 (Deep/Obscure)

    useEffect(() => {
        if (playlistId) {
            fetchRecommendations();
        }
    }, [playlistId]);

    const fetchRecommendations = async () => {
        setLoading(true);
        try {
            // 1. Get Playlist Details
            const playlistData = await spotifyFetch(`/playlists/${playlistId}`);
            if (!playlistData || playlistData.error) throw new Error("Link broken.");

            setPlaylistName(playlistData.name);

            // 2. Extract Data (Handling Pagination to find ALL duplicates)
            let allSourceTracks = [];
            let nextUrl = `/playlists/${playlistId}/tracks?limit=100`;

            setStatusMessage("Deconstructing Stream...");
            while (nextUrl) {
                const trackData = await spotifyFetch(nextUrl.replace('https://api.spotify.com/v1', ''));
                if (trackData && trackData.items) {
                    allSourceTracks = [...allSourceTracks, ...trackData.items.map(item => item.track).filter(t => t && t.id)];
                    nextUrl = trackData.next;
                } else {
                    nextUrl = null;
                }
            }

            if (allSourceTracks.length === 0) {
                setStatusMessage("Null stream detected.");
                setLoading(false);
                return;
            }

            const sourceTrackIds = new Set(allSourceTracks.map(t => t.id));
            const uniqueArtistsInPlaylist = [...new Set(allSourceTracks.flatMap(t => t.artists.map(a => a.id)))];
            const artistNames = [...new Set(allSourceTracks.flatMap(t => t.artists.map(a => a.name)))].slice(0, 5);

            // 3. Fetch Artist Details for Genres
            setStatusMessage("Mapping Acoustic Clusters...");
            const artistChunks = [];
            for (let i = 0; i < uniqueArtistsInPlaylist.slice(0, 50).length; i += 50) {
                artistChunks.push(uniqueArtistsInPlaylist.slice(0, 50).slice(i, i + 50));
            }

            let allGenres = [];
            for (const chunk of artistChunks) {
                const artistData = await spotifyFetch(`/artists?ids=${chunk.join(',')}`);
                if (artistData && artistData.artists) {
                    allGenres = [...allGenres, ...artistData.artists.flatMap(a => a.genres)];
                }
            }

            const genreCounts = allGenres.reduce((acc, g) => {
                acc[g] = (acc[g] || 0) + 1;
                return acc;
            }, {});

            const topGenres = Object.entries(genreCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(entry => entry[0]);

            // 4. Perform Search Discovery
            setStatusMessage(`Excavating Deep Signals...`);
            let searchTracks = [];

            // Add obscurity logic: if highly obscure, search specifically for "tag:new" or deeper genres
            // but Spotify search is limited. Instead, we filter results by popularity.
            // Max popularity = 100 - obscurity.
            // e.g. Obscurity 80 => Max Pop 20.
            const maxPopularity = 100 - obscurity;
            const minPopularity = obscurity > 50 ? 0 : 0; // Standard range

            // Search by Top Genres
            // We search deeper if obscurity is high by increasing limit and filtering later
            const limit = obscurity > 50 ? 50 : 20;

            for (const genre of topGenres.slice(0, 3)) {
                const data = await spotifyFetch(`/search?q=genre:"${genre}"&type=track&limit=${limit}`);
                if (data && data.tracks) searchTracks = [...searchTracks, ...data.tracks.items];
            }

            // Search by specific Artists
            for (const name of artistNames) {
                const data = await spotifyFetch(`/search?q=artist:"${name}"&type=track&limit=10`);
                if (data && data.tracks) searchTracks = [...searchTracks, ...data.tracks.items];
            }

            // Remove duplicates
            const uniqueCandidates = searchTracks.filter((track, index, self) =>
                index === self.findIndex((t) => t.id === track.id)
            );

            // 5. Filter by Popularity & Saved Status
            setStatusMessage(`Applying Spectral Filter (${maxPopularity}% Threshold)...`);

            // First filter by popularity locally (Spotify Search doesn't support range filtering well on basic plans)
            let filteredCandidates = uniqueCandidates.filter(t => t.popularity <= maxPopularity);

            // If we filtered too aggressively, relax it slightly to ensure results
            if (filteredCandidates.length < 5 && obscurity > 0) {
                filteredCandidates = uniqueCandidates.filter(t => t.popularity <= (maxPopularity + 20));
            }

            const ids = filteredCandidates.map(t => t.id).slice(0, 50); // check max 50 for speed
            const checks = [];
            if (ids.length > 0) {
                const res = await spotifyFetch(`/me/tracks/contains?ids=${ids.join(',')}`);
                if (Array.isArray(res)) checks.push(...res);
            }

            const discoveryTracks = filteredCandidates.slice(0, 50).filter((track, index) => {
                const isSaved = checks[index];
                const isAlreadyInPlaylist = sourceTrackIds.has(track.id);
                return !isSaved && !isAlreadyInPlaylist;
            });

            if (discoveryTracks.length === 0) {
                setStatusMessage("No deep signals found. Adjust Crate Depth.");
            } else {
                setStatusMessage(`${discoveryTracks.length} Deep Signals Optimized.`);
            }

            // Shuffle
            setRecommendations(discoveryTracks.sort(() => Math.random() - 0.5));
            setLoading(false);

        } catch (error) {
            console.error("Discovery Error:", error);
            setStatusMessage("Logic Failure.");
            setLoading(false);
        }
    };

    const saveToPlaylist = async () => {
        if (recommendations.length === 0) return;
        setIsSaving(true);
        try {
            const me = await spotifyFetch('/me');
            if (!me || !me.id) throw new Error("Could not fetch user profile.");

            const newPlaylist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                name: `DISCOVER: ${playlistName.toUpperCase()}`,
                description: `Artificial Logic Render. Mode: Deep Discovery. Depth: ${obscurity}%`,
                public: false
            });

            if (!newPlaylist || !newPlaylist.id) throw new Error("Playlist creation failed.");

            const trackUris = recommendations.map(t => t.uri);
            for (let i = 0; i < trackUris.length; i += 100) {
                const chunk = trackUris.slice(i, i + 100);
                await spotifyFetch(`/playlists/${newPlaylist.id}/tracks`, 'POST', { uris: chunk });
            }

            alert(`Committed to library: ${newPlaylist.name}`);
        } catch (error) {
            console.error("Save error:", error);
            alert(`Link failure.`);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6  relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 blur-[120px] rounded-full -z-10" />
                <div className="w-32 h-32 ios26-liquid rounded-[48px] flex items-center justify-center mb-12 border border-blue-500/20 shadow-2xl relative group">
                    <RefreshCw className="text-blue-500 animate-spin" size={48} strokeWidth={1} />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-2 animate-pulse">{statusMessage}</h2>
                <p className="text-white/20 font-black text-[10px] tracking-[0.4em] uppercase">Finding New Favorites</p>
            </div>
        );
    }

    return (
        <div className="py-20  max-w-7xl mx-auto px-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full -z-10 animate-ios26-float" />

            <header className="mb-24">
                <button
                    onClick={() => navigate('/playlists')}
                    className="mb-10 flex items-center text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors"
                >
                    <ArrowLeft size={16} className="mr-2" /> Archive
                </button>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 ml-1">Music Discovery</p>
                        <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-white">
                            Discovery
                        </h1>
                        <p className="mt-8 text-white/40 text-xl font-bold tracking-tight max-w-2xl px-1">
                            Finding new music based on <span className="text-blue-500 underline decoration-1 underline-offset-[12px]">{playlistName}</span>
                        </p>
                    </div>
                    {recommendations.length > 0 && (
                        <button
                            onClick={saveToPlaylist}
                            disabled={isSaving}
                            className="ios26-liquid px-12 py-6 rounded-[24px] font-black text-[10px] text-white border border-white/20 shadow-2xl hover:scale-105 active:scale-95 transition-all uppercase tracking-[0.3em] flex items-center gap-4"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                            {isSaving ? 'Synching...' : 'Commit to Library'}
                        </button>
                    )}
                </div>
            </header>

            {/* Obscurity Filter UI */}
            <div className="ios26-card p-6 md:p-12 mb-20 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 bg-white/[0.02] border-white/5 shadow-2xl overflow-visible">
                <div className="flex items-center gap-8">
                    <div className="w-16 h-16 ios26-liquid rounded-[28px] flex items-center justify-center text-purple-500 border border-white/20 shadow-2xl">
                        <Sliders size={32} strokeWidth={1} />
                    </div>
                    <div>
                        <h3 className="font-black text-3xl tracking-tighter uppercase text-white leading-none mb-2">Discovery Range</h3>
                        <p className="text-white/20 text-[9px] font-black uppercase tracking-[0.3em]">Popular Hits ⇄ Hidden Gems</p>
                    </div>
                </div>

                <div className="flex-1 w-full max-w-lg flex flex-col gap-6">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={obscurity}
                        onChange={(e) => setObscurity(Number(e.target.value))}
                        className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between items-center text-[9px] font-black text-white/20 uppercase tracking-[0.4em]">
                        <span>Mainstream</span>
                        <div className="ios26-glass px-5 py-2 rounded-full border border-white/10 text-blue-500 text-[10px] shadow-2xl">
                            {obscurity}% Depth
                        </div>
                        <span>Hidden Gems</span>
                    </div>
                </div>

                <button
                    onClick={fetchRecommendations}
                    className="ios26-glass px-8 py-5 rounded-[22px] text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all border border-white/10 shadow-2xl flex items-center gap-3"
                >
                    <RefreshCw size={16} /> Refresh Logic
                </button>
            </div>

            {recommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-neutral-900/30 rounded-3xl border border-neutral-800/50 backdrop-blur-sm">
                    <p className="text-neutral-500 text-2xl mb-8 font-medium">No new songs found for this setting.</p>
                    <button
                        onClick={fetchRecommendations}
                        className="px-10 py-4 bg-neutral-800 rounded-full hover:bg-neutral-700 font-bold transition-all border border-neutral-700"
                    >
                        Try Again
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-32">
                    {recommendations.map((track, index) => (
                        <div
                            key={track.id}
                            className="ios26-card-interactive p-5 group"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            <div className="relative aspect-square w-full mb-6 rounded-[28px] overflow-hidden shadow-2xl ring-1 ring-white/10">
                                <img
                                    src={track.album.images[0]?.url}
                                    alt={track.name}
                                    className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-[2000ms]"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center p-4">
                                    <button
                                        onClick={() => window.open(track.uri, '_blank')}
                                        className="ios26-liquid w-14 h-14 rounded-full hover:scale-110 transition-transform active:scale-90 shadow-2xl flex items-center justify-center border border-white/20"
                                    >
                                        <Play fill="white" size={20} className="ml-1 text-white" />
                                    </button>
                                </div>
                                <div className="absolute top-4 right-4 ios26-glass rounded-xl text-[9px] font-black px-3 py-1.5 border border-white/10 uppercase tracking-widest shadow-2xl">
                                    P: {track.popularity}
                                </div>
                            </div>

                            <div className="px-1 text-center">
                                <h3 className="font-black text-lg truncate mb-1 text-white tracking-tighter uppercase leading-none group-hover:text-blue-500 transition-colors" title={track.name}>
                                    {track.name}
                                </h3>
                                <p className="text-white/30 text-[9px] truncate font-black uppercase tracking-[0.2em] mt-3">
                                    {track.artists.map(a => a.name).join(', ')}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Recommendations;
