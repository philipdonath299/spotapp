import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Save, Loader2, Music2, Filter, Tag, Calendar, TrendingUp, RefreshCw } from 'lucide-react';

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
                    setStatus(`Analyzing artists: ${Math.round((i / artistIds.length) * 100)}%`);
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
                    // Simplify/Group common genres
                    let key = g;
                    const l = g.toLowerCase();
                    if (l.includes('pop')) key = 'Pop';
                    else if (l.includes('rap') || l.includes('hip hop') || l.includes('trap')) key = 'Hip Hop';
                    else if (l.includes('rock') || l.includes('metal') || l.includes('punk')) key = 'Rock';
                    else if (l.includes('house') || l.includes('edm') || l.includes('techno') || l.includes('dance')) key = 'Electronic';
                    else if (l.includes('indie') || l.includes('alternative')) key = 'Indie/Alt';
                    else if (l.includes('r&b') || l.includes('soul') || l.includes('funk')) key = 'R&B/Soul';
                    else if (l.includes('jazz')) key = 'Jazz';
                    else if (l.includes('country')) key = 'Country';
                    else if (l.includes('folk')) key = 'Folk';
                    else if (l.includes('latino') || l.includes('reggaeton')) key = 'Latino';

                    genreCounts[key] = (genreCounts[key] || 0) + 1;
                });
            });

            const topGenres = Object.entries(genreCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10) // Top 10 genres
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
                if (target.includes('hip hop')) return g.includes('rap') || g.includes('hip hop') || g.includes('trap');
                if (target === 'rock') return g.includes('rock') || g.includes('metal') || g.includes('punk');
                if (target === 'electronic') return g.includes('house') || g.includes('edm') || g.includes('dance') || g.includes('electronic') || g.includes('techno');
                if (target.includes('indie')) return g.includes('indie') || g.includes('alternative');
                if (target.includes('r&b')) return g.includes('r&b') || g.includes('soul') || g.includes('funk');
                if (target === 'latino') return g.includes('latino') || g.includes('reggaeton');
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
        <div className="py-8 animate-apple-in max-w-4xl mx-auto">
            <header className="mb-14 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <button onClick={() => navigate('/dashboard')} className="mb-6 flex items-center text-blue-500 font-bold text-sm bg-blue-500/10 px-5 py-2 rounded-full hover:bg-blue-500/20 transition-all w-fit uppercase tracking-widest">
                        <ArrowLeft size={16} className="mr-2" /> Dashboard
                    </button>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none">Mood Mix</h1>
                    <p className="text-gray-400 text-xl font-bold mt-2 tracking-tight">Engineer your perfect audio environment.</p>
                </div>
                {!loading && tracks.length > 0 && (
                    <button
                        onClick={fetchLikedSongs}
                        className="p-4 rounded-full apple-glass shadow-2xl hover:bg-white/10 transition-all border border-white/15 active:scale-90 group"
                        title="Rescan library"
                    >
                        <RefreshCw size={24} className="text-gray-400 group-hover:text-white transition-colors" />
                    </button>
                )}
            </header>

            {!tracks.length && !loading ? (
                <div className="apple-card p-16 text-center flex flex-col items-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
                    <div className="w-24 h-24 bg-blue-500/10 rounded-[32px] flex items-center justify-center mb-10 border border-blue-500/20 shadow-2xl">
                        <Sliders size={48} className="text-blue-500" strokeWidth={1.5} />
                    </div>
                    <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase">Ready to Mix?</h2>
                    <p className="text-gray-400 mb-10 max-w-sm font-bold text-lg tracking-tight">We'll analyze your liked songs to create perfect metadata-based filters for you.</p>
                    <button onClick={fetchLikedSongs} className="apple-button-primary px-12 py-5 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] text-lg uppercase tracking-widest font-black">
                        Scan Liked Songs
                    </button>
                    {status && <p className="mt-8 text-sm text-blue-400 font-black animate-pulse tracking-[0.2em]">{status}</p>}
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Filter Section */}
                    <section className="apple-glass rounded-[48px] p-10 space-y-12 border border-white/15 shadow-2xl">
                        <div>
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-2 bg-purple-500/10 rounded-xl">
                                    <Music2 size={24} className="text-purple-500" />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Genre Frequency</h3>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {availableGenres.map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setSelectedGenre(g)}
                                        className={`px-6 py-3 rounded-2xl text-sm font-black transition-all border uppercase tracking-widest ${selectedGenre === g
                                            ? 'bg-blue-500 border-blue-400 text-white shadow-[0_12px_24px_-4px_rgba(59,130,246,0.6)]'
                                            : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10 hover:text-gray-300'
                                            }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-2 bg-orange-500/10 rounded-xl">
                                        <Disc size={24} className="text-orange-500" />
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Release Era</h3>
                                </div>
                                <div className="flex gap-2 p-1.5 bg-black/60 rounded-[24px] border border-white/10 shadow-inner">
                                    {['All', '2020s', '2010s', 'Classics'].map(y => (
                                        <button
                                            key={y}
                                            onClick={() => setYearRange(y)}
                                            className={`flex-1 py-3.5 rounded-[18px] text-[11px] font-black transition-all uppercase tracking-widest ${yearRange === y ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                                                }`}
                                        >
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-2 bg-green-500/10 rounded-xl">
                                        <Activity size={24} className="text-green-500" />
                                    </div>
                                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Popularity</h3>
                                </div>
                                <div className="flex gap-2 p-1.5 bg-black/60 rounded-[24px] border border-white/10 shadow-inner">
                                    {['All', 'Top Hits', 'Deep Cuts'].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPopularity(p)}
                                            className={`flex-1 py-3.5 rounded-[18px] text-[11px] font-black transition-all uppercase tracking-widest ${popularity === p ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Results Section */}
                    <section className="animate-apple-in">
                        <div className="flex items-center justify-between mb-8 px-4">
                            <div>
                                <h3 className="text-3xl font-black tracking-tighter uppercase leading-none">Your Mix</h3>
                                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mt-1">{filteredTracks.length} tracks matching criteria</p>
                            </div>
                            {filteredTracks.length > 0 && (
                                <button
                                    onClick={handleCreatePlaylist}
                                    disabled={loading}
                                    className="apple-button-primary py-3 px-8 text-sm uppercase tracking-widest font-black"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Save Mix'}
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredTracks.slice(0, 50).map(t => (
                                <div key={t.track.id} className="apple-card-interactive p-4 flex items-center gap-5 group shadow-lg">
                                    <div className="w-16 h-16 rounded-[20px] overflow-hidden relative shadow-2xl border border-white/10">
                                        <img src={t.track.album.images[0]?.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-lg font-black truncate tracking-tighter uppercase group-hover:text-blue-400 transition-colors leading-[1.1]">{t.track.name}</h4>
                                        <p className="text-xs text-gray-500 font-bold truncate tracking-tight mt-1 opacity-80">{t.track.artists[0].name}</p>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100">
                                        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-2xl">
                                            <Play fill="white" size={18} className="ml-1" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {filteredTracks.length === 0 && (
                            <div className="py-24 text-center apple-glass rounded-[48px] border border-white/15 shadow-2xl">
                                <p className="text-gray-400 font-black text-2xl tracking-tighter uppercase mb-2">No matches found</p>
                                <p className="text-sm text-gray-600 font-bold uppercase tracking-widest">Try loosening your frequency filters.</p>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {loading && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-fade-in">
                    <div className="apple-glass p-12 rounded-[40px] flex flex-col items-center max-w-sm text-center">
                        <Loader2 className="animate-spin text-blue-500 mb-6" size={48} />
                        <h2 className="text-2xl font-bold tracking-tight mb-2">Analyzing Library</h2>
                        <p className="text-gray-500 font-medium text-sm mb-6">{status}</p>
                        {analyzing && (
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: '40%' }} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MoodMix;
