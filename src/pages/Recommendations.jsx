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
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xl text-green-400 animate-pulse font-medium">{statusMessage}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 animate-fade-in">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center text-neutral-400 hover:text-white transition-colors group"
                    >
                        <ArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform" size={20} /> Back to Playlists
                    </button>

                    {recommendations.length > 0 && (
                        <button
                            onClick={saveToPlaylist}
                            disabled={isSaving}
                            className={`flex items-center gap-2 px-8 py-3.5 rounded-full font-bold transition-all shadow-2xl ${isSaving
                                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                                : 'bg-green-500 hover:bg-green-400 text-black hover:scale-105 active:scale-95 shadow-green-500/20'
                                }`}
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                            {isSaving ? 'Creating...' : 'Save All as Playlist'}
                        </button>
                    )}
                </div>

                <header className="mb-8">
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold mb-4 tracking-tight leading-tight">
                        Deep Discovery
                    </h1>
                    <p className="text-neutral-400 text-xl md:text-2xl font-medium max-w-2xl">
                        Inspired by <span className="text-green-400">{playlistName}</span>
                    </p>
                </header>

                {/* Obscurity Filter UI */}
                <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800 mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
                            <Sliders size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">Discovery Depth</h3>
                            <p className="text-zinc-400 text-sm">Find mainstream hits or crate-digger deep cuts.</p>
                        </div>
                    </div>

                    <div className="flex-1 w-full max-w-md flex flex-col gap-2">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={obscurity}
                            onChange={(e) => setObscurity(Number(e.target.value))}
                            className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <div className="flex justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider">
                            <span>Mainstream</span>
                            <span className="text-purple-400">{obscurity}% Obscure</span>
                            <span>Underground</span>
                        </div>
                    </div>

                    <button
                        onClick={fetchRecommendations}
                        className="px-6 py-3 bg-neutral-700 hover:bg-neutral-600 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={18} /> Refresh Mix
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-8">
                        {recommendations.map((track, index) => (
                            <div
                                key={track.id}
                                className="bg-neutral-900/40 rounded-2xl p-4 hover:bg-neutral-800/60 transition-all group border border-neutral-800/50 hover:border-neutral-700 shadow-sm animate-fade-in"
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <div className="relative aspect-square w-full mb-5 rounded-xl overflow-hidden shadow-lg group-hover:shadow-green-500/20 transition-all duration-500">
                                    <img
                                        src={track.album.images[0]?.url}
                                        alt={track.name}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                                    />
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            onClick={() => window.open(track.uri, '_blank')}
                                            className="bg-green-500 text-black p-4 rounded-full hover:scale-110 transition-transform active:scale-90 shadow-2xl"
                                            title="Play on Spotify"
                                        >
                                            <Play fill="currentColor" size={28} />
                                        </button>
                                    </div>
                                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10">
                                        POP: {track.popularity}
                                    </div>
                                </div>

                                <div className="px-1">
                                    <h3 className="font-bold text-lg truncate mb-1 text-neutral-100" title={track.name}>
                                        {track.name}
                                    </h3>
                                    <p className="text-neutral-400 text-sm truncate font-medium group-hover:text-neutral-300 transition-colors">
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
