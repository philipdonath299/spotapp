import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Save, Loader2, Music2, Filter, Tag, Calendar, TrendingUp } from 'lucide-react';

const MoodMix = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [tracks, setTracks] = useState([]);
    const [filteredTracks, setFilteredTracks] = useState([]);
    const [status, setStatus] = useState('');
    const [availableGenres, setAvailableGenres] = useState([]);

    // Filters
    const [selectedGenre, setSelectedGenre] = useState('All');
    const [yearRange, setYearRange] = useState('All'); // All, 2020s, 2010s, 2000s, Classics
    const [popularity, setPopularity] = useState('All'); // All, Top Hits, Deep Cuts

    useEffect(() => {
        fetchLikedSongs();
    }, []);

    useEffect(() => {
        if (tracks.length > 0) {
            applyFilters();
        }
    }, [selectedGenre, yearRange, popularity, tracks]);

    const fetchLikedSongs = async () => {
        setLoading(true);
        setStatus('Fetching your liked songs...');
        try {
            // 1. Fetch last 200 liked songs
            let allTracks = [];
            for (let offset of [0, 50, 100, 150]) {
                try {
                    const res = await spotifyFetch(`/me/tracks?limit=50&offset=${offset}`);
                    if (res?.items) {
                        allTracks = [...allTracks, ...res.items];
                    }
                } catch (e) {
                    console.warn(`Failed to fetch offset ${offset}`, e);
                }
            }

            if (allTracks.length === 0) {
                throw new Error("No songs found.");
            }

            // 2. Extract Artist IDs to fetch Genres
            // Filter local tracks
            const validTracks = allTracks.filter(t => t.track && !t.track.is_local && t.track.artists.length > 0);
            const artistIds = [...new Set(validTracks.map(t => t.track.artists[0].id))]; // Primary artist only

            setStatus(`Fetching genres for ${artistIds.length} artists...`);
            setAnalyzing(true);

            const artistMap = {};

            // Batch fetch artists (50 limit)
            for (let i = 0; i < artistIds.length; i += 50) {
                try {
                    const chunk = artistIds.slice(i, i + 50);
                    const res = await spotifyFetch(`/artists?ids=${chunk.join(',')}`);
                    if (res?.artists) {
                        res.artists.forEach(a => {
                            if (a) artistMap[a.id] = a;
                        });
                    }
                } catch (e) {
                    console.error("Artist fetch failed", e);
                }
            }

            // 3. Enrich Tracks with Artist Data (Genres)
            const enrichedTracks = validTracks.map(item => {
                const artist = artistMap[item.track.artists[0].id];
                return {
                    ...item,
                    genre: artist?.genres || [],
                    year: parseInt(item.track.album.release_date.substring(0, 4)) || 0,
                    popularity: item.track.popularity
                };
            });

            // 4. Extract Top Genres
            const genreCounts = {};
            enrichedTracks.forEach(t => {
                t.genre.forEach(g => {
                    // Simplify genres (e.g., "dance pop" -> "pop")
                    let key = g;
                    if (g.includes('pop')) key = 'Pop';
                    else if (g.includes('rap') || g.includes('hip hop')) key = 'Hip Hop';
                    else if (g.includes('rock') || g.includes('metal')) key = 'Rock';
                    else if (g.includes('house') || g.includes('edm') || g.includes('dance')) key = 'Electronic';
                    else if (g.includes('indie')) key = 'Indie';
                    else if (g.includes('r&b') || g.includes('soul')) key = 'R&B';

                    genreCounts[key] = (genreCounts[key] || 0) + 1;
                });
            });

            const topGenres = Object.entries(genreCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8) // Top 8 genres
                .map(([g]) => g);

            setAvailableGenres(['All', ...topGenres]);
            setTracks(enrichedTracks);
            setStatus('');

        } catch (err) {
            console.error(err);
            setStatus(`Error: ${err.message}`);
        } finally {
            setLoading(false);
            setAnalyzing(false);
        }
    };

    const applyFilters = () => {
        let filtered = tracks;

        // Genre Filter
        if (selectedGenre !== 'All') {
            filtered = filtered.filter(t => {
                // Check if any of the artist's genres match our loose category
                const g = t.genre.join(' ').toLowerCase();
                const target = selectedGenre.toLowerCase();
                if (target === 'pop') return g.includes('pop');
                if (target === 'hip hop') return g.includes('rap') || g.includes('hip hop');
                if (target === 'rock') return g.includes('rock') || g.includes('metal');
                if (target === 'electronic') return g.includes('house') || g.includes('edm') || g.includes('dance') || g.includes('electronic');
                if (target === 'indie') return g.includes('indie');
                if (target === 'r&b') return g.includes('r&b') || g.includes('soul');
                return g.includes(target);
            });
        }

        // Year Filter
        if (yearRange !== 'All') {
            filtered = filtered.filter(t => {
                if (yearRange === '2020s') return t.year >= 2020;
                if (yearRange === '2010s') return t.year >= 2010 && t.year < 2020;
                if (yearRange === '2000s') return t.year >= 2000 && t.year < 2010;
                if (yearRange === 'Classics') return t.year < 2000;
                return true;
            });
        }

        // Popularity Filter
        if (popularity !== 'All') {
            filtered = filtered.filter(t => {
                if (popularity === 'Top Hits') return t.popularity >= 70;
                if (popularity === 'Deep Cuts') return t.popularity < 50;
                return true;
            });
        }

        setFilteredTracks(filtered);
    };

    const handleCreatePlaylist = async () => {
        if (filteredTracks.length === 0) return;
        setLoading(true);
        setStatus('Creating playlist...');
        try {
            const me = await spotifyFetch('/me');
            const name = `Mood Mix: ${selectedGenre !== 'All' ? selectedGenre : 'My Mix'} ${yearRange !== 'All' ? yearRange : ''}`;

            const playlist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                name: name,
                description: `Generated mix. Genre: ${selectedGenre}, Year: ${yearRange}, Popularity: ${popularity}.`,
                public: false
            });

            const uris = filteredTracks.map(t => t.track.uri);

            // Add in chunks
            for (let i = 0; i < uris.length; i += 100) {
                await spotifyFetch(`/playlists/${playlist.id}/tracks`, 'POST', {
                    uris: uris.slice(i, i + 100)
                });
            }

            setStatus('Playlist saved! Check Spotify.');
            setTimeout(() => setStatus(''), 3000);
        } catch (err) {
            console.error(err);
            setStatus('Failed to save playlist.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 animate-fade-in pb-32">
            <button
                onClick={() => navigate('/dashboard')}
                className="hidden md:flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft className="mr-2" size={20} /> Back to Dashboard
            </button>

            <header className="mb-12 text-center md:text-left">
                <h1 className="text-4xl font-bold mb-4 flex items-center justify-center md:justify-start gap-3">
                    <Filter className="text-purple-500" /> Vibe Filter
                </h1>
                <p className="text-gray-400">Filter your liked songs by Genre, Year, and Popularity.</p>
            </header>

            {loading && !tracks.length ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-purple-500 mb-4" size={48} />
                    <p className="text-xl font-bold">{status}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Controls */}
                    <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800 h-fit">
                        <h2 className="text-xl font-bold mb-6">Filter Options</h2>

                        <div className="space-y-6">

                            {/* Genre */}
                            <div>
                                <label className="font-bold flex items-center gap-2 mb-3">
                                    <Tag size={18} className="text-pink-500" /> Genre
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {availableGenres.map(g => (
                                        <button
                                            key={g}
                                            onClick={() => setSelectedGenre(g)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${selectedGenre === g ? 'bg-pink-600 border-pink-600 text-white' : 'bg-transparent border-neutral-700 text-gray-400 hover:border-white'}`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Year */}
                            <div>
                                <label className="font-bold flex items-center gap-2 mb-3">
                                    <Calendar size={18} className="text-blue-500" /> Release Year
                                </label>
                                <select
                                    value={yearRange}
                                    onChange={(e) => setYearRange(e.target.value)}
                                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                                >
                                    <option value="All">Any Time</option>
                                    <option value="2020s">2020s (New)</option>
                                    <option value="2010s">2010s</option>
                                    <option value="2000s">2000s</option>
                                    <option value="Classics">Pre-2000s (Classics)</option>
                                </select>
                            </div>

                            {/* Popularity */}
                            <div>
                                <label className="font-bold flex items-center gap-2 mb-3">
                                    <TrendingUp size={18} className="text-green-500" /> Popularity
                                </label>
                                <div className="flex gap-2 bg-neutral-800 p-1 rounded-lg">
                                    {['All', 'Top Hits', 'Deep Cuts'].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPopularity(p)}
                                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${popularity === p ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                        </div>

                        <div className="mt-8">
                            <div className="text-center mb-4">
                                <span className="text-4xl font-bold">{filteredTracks.length}</span>
                                <p className="text-gray-400 text-sm">matches found</p>
                            </div>

                            <button
                                onClick={handleCreatePlaylist}
                                disabled={loading || filteredTracks.length === 0}
                                className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <Save />}
                                {loading ? 'Saving...' : 'Save as Playlist'}
                            </button>
                            {status && <p className="text-center mt-3 text-sm text-green-400 animate-pulse">{status}</p>}
                        </div>
                    </div>

                    {/* Results List */}
                    <div className="lg:col-span-2">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            Filtered Collection
                        </h3>

                        {filteredTracks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filteredTracks.slice(0, 50).map((item, i) => (
                                    <div key={i} className="bg-white/5 p-3 rounded-lg flex items-center gap-3 hover:bg-white/10 transition-colors">
                                        {item.track.album.images[2] && (
                                            <img src={item.track.album.images[2].url} className="w-12 h-12 rounded" alt="" />
                                        )}
                                        <div className="overflow-hidden">
                                            <p className="font-bold truncate">{item.track.name}</p>
                                            <p className="text-xs text-gray-400 truncate">{item.track.artists[0].name}</p>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300">{item.year}</span>
                                                {item.genre[0] && <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-300 truncate max-w-[80px]">{item.genre[0]}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {filteredTracks.length > 50 && (
                                    <div className="flex items-center justify-center text-gray-500 text-sm">
                                        + {filteredTracks.length - 50} more...
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-neutral-800 rounded-2xl text-gray-500">
                                <Music2 size={48} className="mb-4 opacity-50" />
                                <p>No songs match these filters.</p>
                                <p className="text-sm">Try selecting "All" for some options to widen the search.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MoodMix;
