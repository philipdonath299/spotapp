import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Play, Plus } from 'lucide-react';

const Recommendations = () => {
    const { playlistId } = useParams();
    const navigate = useNavigate();
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState("Analyzing your playlist...");
    const [playlistName, setPlaylistName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchRecommendations = async () => {
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
                    .slice(0, 2)
                    .map(entry => entry[0]);

                // 4. Perform Search Discovery (Mix of Genres and specific Artists)
                setStatusMessage(`Finding tracks similar to ${playlistName}...`);
                let searchTracks = [];

                // Search by Top Genres
                for (const genre of topGenres) {
                    const data = await spotifyFetch(`/search?q=genre:"${genre}"&type=track&limit=30`);
                    if (data && data.tracks) searchTracks = [...searchTracks, ...data.tracks.items];
                }

                // Search by specific Artists from the playlist for better matching (Allows for "same artist but new song")
                for (const name of artistNames) {
                    const data = await spotifyFetch(`/search?q=artist:"${name}"&type=track&limit=10`);
                    if (data && data.tracks) searchTracks = [...searchTracks, ...data.tracks.items];
                }

                // Remove duplicates
                const uniqueCandidates = searchTracks.filter((track, index, self) =>
                    index === self.findIndex((t) => t.id === track.id)
                );

                // 5. Filter out Saved Tracks and tracks already in this playlist
                setStatusMessage(`Filtering for final results...`);
                const ids = uniqueCandidates.map(t => t.id);
                const checks = [];
                for (let i = 0; i < ids.length; i += 50) {
                    const chunk = ids.slice(i, i + 50);
                    const res = await spotifyFetch(`/me/tracks/contains?ids=${chunk.join(',')}`);
                    if (Array.isArray(res)) checks.push(...res);
                }

                const discoveryTracks = uniqueCandidates.filter((track, index) => {
                    const isSaved = checks[index];
                    const isAlreadyInPlaylist = sourceTrackIds.has(track.id);
                    return !isSaved && !isAlreadyInPlaylist;
                });

                if (discoveryTracks.length === 0) {
                    setStatusMessage("No new tracks found. Try adding more variety to your playlist!");
                } else {
                    setStatusMessage(`Found ${discoveryTracks.length} tracks you might love!`);
                }

                // Shuffle results for a fresh mix every time
                setRecommendations(discoveryTracks.sort(() => Math.random() - 0.5));
                setLoading(false);

            } catch (error) {
                console.error("Discovery Error:", error);
                setStatusMessage("Discovery failed. Please try again.");
                setLoading(false);
            }
        };

        if (playlistId) fetchRecommendations();
    }, [playlistId]);

    const saveToPlaylist = async () => {
        if (recommendations.length === 0) return;
        setIsSaving(true);
        try {
            const me = await spotifyFetch('/me');
            if (!me || !me.id) throw new Error("Could not fetch user profile.");

            const newPlaylist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                name: `Discover: ${playlistName}`,
                description: `Fresh mix generated from your ${playlistName} playlist.`,
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
        <div className="min-h-screen bg-black text-white p-8 animate-fade-in">
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
                            {isSaving ? (
                                <div className="w-5 h-5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <Plus size={20} />
                            )}
                            {isSaving ? 'Creating...' : 'Save All as Playlist'}
                        </button>
                    )}
                </div>

                <header className="mb-12">
                    <h1 className="text-5xl md:text-6xl font-extrabold mb-4 tracking-tight leading-tight">
                        Discovery Mix
                    </h1>
                    <p className="text-neutral-400 text-xl md:text-2xl font-medium max-w-2xl">
                        A fresh mix inspired by <span className="text-green-400 underline decoration-green-500/30 underline-offset-4">{playlistName}</span>
                    </p>
                </header>

                {recommendations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-neutral-900/30 rounded-3xl border border-neutral-800/50 backdrop-blur-sm">
                        <p className="text-neutral-500 text-2xl mb-8 font-medium">No new songs found right now.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-10 py-4 bg-neutral-800 rounded-full hover:bg-neutral-700 font-bold transition-all border border-neutral-700"
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
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
