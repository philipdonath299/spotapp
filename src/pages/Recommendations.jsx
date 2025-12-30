import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Play, Plus, Sliders, RefreshCw } from 'lucide-react';

const Recommendations = () => {
    const { playlistId } = useParams();
    const navigate = useNavigate();
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState("Analyzing your playlist...");
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
            if (!playlistData || playlistData.error) throw new Error("Playlist fetch failed.");

            setPlaylistName(playlistData.name);

            // 2. Extract Data (Handling Pagination to find ALL duplicates)
            let allSourceTracks = [];
            let nextUrl = `/playlists/${playlistId}/tracks?limit=100`;

            setStatusMessage("Analyzing entire playlist...");
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
                setStatusMessage("Playlist is empty.");
                setLoading(false);
                return;
            }

            const sourceTrackIds = new Set(allSourceTracks.map(t => t.id));
            const uniqueArtistsInPlaylist = [...new Set(allSourceTracks.flatMap(t => t.artists.map(a => a.id)))];
            const artistNames = [...new Set(allSourceTracks.flatMap(t => t.artists.map(a => a.name)))].slice(0, 5);

            // 3. Fetch Artist Details for Genres
            setStatusMessage("Analyzing your taste...");
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
            setStatusMessage(`Digging for gems similar to ${playlistName}...`);
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
            setStatusMessage(`Filtering by popularity (< ${maxPopularity})...`);

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
                setStatusMessage("No tracks found matching this deep dive. Try lowering obscurity.");
            } else {
                setStatusMessage(`Found ${discoveryTracks.length} deep cuts!`);
            }

            // Shuffle
            setRecommendations(discoveryTracks.sort(() => Math.random() - 0.5));
            setLoading(false);

        } catch (error) {
            console.error("Discovery Error:", error);
            setStatusMessage("Discovery failed. Please try again.");
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
                name: `Discover: ${playlistName} (${obscurity > 50 ? 'Deep Cuts' : 'Mix'})`,
                description: `Fresh mix generated from your ${playlistName} playlist with ${obscurity}% obscurity filter.`,
                public: false
            });

            if (!newPlaylist || !newPlaylist.id) throw new Error("Playlist creation failed.");

            const trackUris = recommendations.map(t => t.uri);
            for (let i = 0; i < trackUris.length; i += 100) {
                const chunk = trackUris.slice(i, i + 100);
                await spotifyFetch(`/playlists/${newPlaylist.id}/tracks`, 'POST', { uris: chunk });
            }

            alert(`Successfully created "${newPlaylist.name}" in your library!`);
        } catch (error) {
            console.error("Save error:", error);
            alert(`Error saving playlist: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 animate-apple-in">
                <div className="w-20 h-20 bg-blue-500/10 rounded-[40px] flex items-center justify-center mb-10 border border-blue-500/20 shadow-2xl relative">
                    <div className="absolute inset-0 rounded-[40px] border-2 border-blue-500 border-t-transparent animate-spin" />
                    <RefreshCw className="text-blue-500 animate-pulse" size={32} strokeWidth={1.5} />
                </div>
                <p className="text-2xl font-black text-white tracking-tighter uppercase mb-2 leading-none">{statusMessage}</p>
                <p className="text-gray-500 font-bold text-sm tracking-widest uppercase opacity-80 italic">Simulating taste clusters...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 animate-fade-in">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6">
                    <button
                        onClick={() => navigate('/playlists')}
                        className="flex items-center text-blue-500 font-black text-xs bg-blue-500/10 px-6 py-2.5 rounded-full hover:bg-blue-500/20 transition-all uppercase tracking-widest"
                    >
                        <ArrowLeft className="mr-2" size={16} strokeWidth={3} /> Playlists
                    </button>

                    {recommendations.length > 0 && (
                        <button
                            onClick={saveToPlaylist}
                            disabled={isSaving}
                            className={`flex items-center gap-3 px-10 py-5 rounded-3xl font-black transition-all shadow-[0_24px_48px_-12px_rgba(59,130,246,0.3)] uppercase tracking-widest text-sm border-2 ${isSaving
                                ? 'bg-white/5 text-gray-600 cursor-not-allowed border-white/5'
                                : 'bg-white text-black hover:bg-gray-200 hover:scale-[1.02] active:scale-95 border-transparent'
                                }`}
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={24} /> : <Plus size={24} strokeWidth={3} />}
                            {isSaving ? 'Synching...' : 'Deploy to Library'}
                        </button>
                    )}
                </div>

                <header className="mb-14">
                    <h1 className="text-5xl md:text-8xl font-black mb-4 tracking-tighter leading-none uppercase">Deep Discovery</h1>
                    <p className="text-gray-400 text-xl font-bold tracking-tight max-w-2xl px-1">
                        Synthesizing new sonic terrains from <span className="text-blue-500 underline decoration-2 underline-offset-8">{playlistName}</span>
                    </p>
                </header>

                {/* Obscurity Filter UI */}
                <div className="apple-glass p-10 rounded-[48px] border border-white/15 mb-16 flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-purple-500/10 text-purple-500 rounded-[28px] border border-purple-500/20 shadow-2xl">
                            <Sliders size={32} strokeWidth={1.5} />
                        </div>
                        <div>
                            <h3 className="font-black text-2xl tracking-tighter uppercase leading-none mb-1">Crate Depth</h3>
                            <p className="text-gray-500 text-sm font-bold tracking-tight uppercase tracking-widest opacity-80">Mainstream ⇄ Underground</p>
                        </div>
                    </div>

                    <div className="flex-1 w-full max-w-md flex flex-col gap-4">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={obscurity}
                            onChange={(e) => setObscurity(Number(e.target.value))}
                            className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 shadow-inner"
                        />
                        <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                            <span>Popular</span>
                            <span className="text-blue-500 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">{obscurity}% Obscuration</span>
                            <span>Obscure</span>
                        </div>
                    </div>

                    <button
                        onClick={fetchRecommendations}
                        className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-[24px] font-black transition-all flex items-center gap-3 border border-white/10 uppercase tracking-widest text-xs"
                    >
                        <RefreshCw size={18} strokeWidth={2.5} /> Refresh Logic
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 pb-32">
                        {recommendations.map((track, index) => (
                            <div
                                key={track.id}
                                className="apple-card-interactive p-5 group shadow-2xl animate-apple-in"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="relative aspect-square w-full mb-6 rounded-[32px] overflow-hidden shadow-2xl border border-white/10">
                                    <img
                                        src={track.album.images[0]?.url}
                                        alt={track.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms]"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center p-4">
                                        <button
                                            onClick={() => window.open(track.uri, '_blank')}
                                            className="bg-white text-black w-14 h-14 rounded-full hover:scale-110 transition-transform active:scale-90 shadow-2xl flex items-center justify-center"
                                        >
                                            <Play fill="black" size={24} className="ml-1" />
                                        </button>
                                    </div>
                                    <div className="absolute top-4 right-4 apple-glass rounded-xl text-[10px] font-black px-3 py-1.5 border border-white/20 uppercase tracking-widest">
                                        P: {track.popularity}
                                    </div>
                                </div>

                                <div className="px-1 text-center">
                                    <h3 className="font-black text-lg truncate mb-1 text-white tracking-tighter uppercase leading-[1.1]" title={track.name}>
                                        {track.name}
                                    </h3>
                                    <p className="text-gray-500 text-[11px] truncate font-bold uppercase tracking-widest opacity-80 group-hover:text-blue-400 transition-colors">
                                        {track.artists.map(a => a.name).join(', ')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Recommendations;
