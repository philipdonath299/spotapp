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
    const [yearRange, setYearRange] = useState('All');
    const [popularity, setPopularity] = useState('All');

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
        setStatus('Scanning Liked Signals...');
        try {
            let allTracks = [];
            for (let offset of [0, 50, 100, 150]) {
                const res = await spotifyFetch(`/me/tracks?limit=50&offset=${offset}`);
                if (res?.items) allTracks = [...allTracks, ...res.items];
            }

            if (allTracks.length === 0) throw new Error("No signals detected.");

            const validTracks = allTracks.filter(t => t.track && !t.track.is_local && t.track.artists.length > 0);
            const artistIds = [...new Set(validTracks.map(t => t.track.artists[0].id))];

            setStatus(`Processing metadata for ${artistIds.length} entities...`);
            setAnalyzing(true);

            const artistMap = {};
            for (let i = 0; i < artistIds.length; i += 50) {
                const chunk = artistIds.slice(i, i + 50);
                setStatus(`Decompiling: ${Math.round((i / artistIds.length) * 100)}%`);
                const res = await spotifyFetch(`/artists?ids=${chunk.join(',')}`);
                if (res?.artists) {
                    res.artists.forEach(a => { if (a) artistMap[a.id] = a; });
                }
            }

            const enrichedTracks = validTracks.map(item => {
                const artist = artistMap[item.track.artists[0].id];
                return {
                    ...item,
                    genre: artist?.genres || [],
                    year: parseInt(item.track.album?.release_date?.substring(0, 4)) || 0,
                    popularity: item.track.popularity
                };
            });

            const genreCounts = {};
            enrichedTracks.forEach(t => {
                t.genre.forEach(g => {
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
                .slice(0, 10)
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
        if (selectedGenre !== 'All') {
            filtered = filtered.filter(t => {
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
        if (yearRange !== 'All') {
            filtered = filtered.filter(t => {
                if (yearRange === '2020s') return t.year >= 2020;
                if (yearRange === '2010s') return t.year >= 2010 && t.year < 2020;
                if (yearRange === '2000s') return t.year >= 2000 && t.year < 2010;
                if (yearRange === 'Classics') return t.year < 2000;
                return true;
            });
        }
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
        setStatus('Creating Playlist...');
        try {
            const me = await spotifyFetch('/me');
            const name = `MIX: ${selectedGenre !== 'All' ? selectedGenre : 'NEURAL'} ${yearRange !== 'All' ? yearRange : ''}`;
            const playlist = await spotifyFetch(`/users/${me.id}/playlists`, 'POST', {
                name: name,
                description: `Created with Statsify. G:${selectedGenre} Y:${yearRange} P:${popularity}.`,
                public: false
            });
            const uris = filteredTracks.map(t => t.track.uri);
            for (let i = 0; i < uris.length; i += 100) {
                await spotifyFetch(`/playlists/${playlist.id}/tracks`, 'POST', { uris: uris.slice(i, i + 100) });
            }
            setStatus('SAVED TO LIBRARY');
            setTimeout(() => setStatus(''), 3000);
        } catch (err) {
            console.error(err);
            setStatus('RENDER FAILED');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="py-20  max-w-6xl mx-auto px-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full -z-10 animate-ios26-float" />

            <header className="mb-24">
                <button onClick={() => navigate('/dashboard')} className="mb-10 flex items-center text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Dashboard
                </button>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 ml-1">Frequency Control</p>
                        <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-white">
                            Mood Mix
                        </h1>
                    </div>

                    {!loading && tracks.length > 0 && (
                        <button
                            onClick={fetchLikedSongs}
                            className="w-16 h-16 rounded-[24px] ios26-glass flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/10 group shadow-2xl"
                        >
                            <RefreshCw size={24} className="group-hover:rotate-180 transition-transform duration-700" />
                        </button>
                    )}
                </div>
            </header>

            {!tracks.length && !loading ? (
                <div className="ios26-card p-20 text-center flex flex-col items-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-blue-500/[0.02] -z-10 group-hover:scale-110 transition-transform duration-1000" />
                    <div className="w-24 h-24 ios26-liquid rounded-[36px] flex items-center justify-center mb-10 border border-white/20 shadow-2xl">
                        <Filter size={44} className="text-blue-500" strokeWidth={1} />
                    </div>
                    <h2 className="text-5xl font-black mb-4 tracking-tighter uppercase text-white">Initialize Mix</h2>
                    <p className="text-[10px] text-white/30 mb-12 max-w-xs font-black uppercase tracking-[0.3em] leading-relaxed">Decompile liked signals to engineer your perfect audio environment.</p>
                    <button
                        onClick={fetchLikedSongs}
                        className="ios26-liquid px-16 py-6 font-black uppercase tracking-[0.3em] text-[10px] text-white border border-white/20 shadow-2xl hover:scale-105 active:scale-95 transition-all"
                    >
                        Scan Signals
                    </button>
                    {status && <p className="mt-8 text-[9px] text-blue-500 font-black animate-pulse tracking-[0.4em] uppercase">{status}</p>}
                </div>
            ) : (
                <div className="space-y-12">
                    {/* iOS 26 Filter Matrix */}
                    <section className="ios26-card p-12 space-y-16 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent -z-10" />

                        <div>
                            <div className="flex items-center gap-4 mb-10">
                                <Music2 size={18} className="text-purple-500" />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Genre Mapping</h3>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {availableGenres.map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setSelectedGenre(g)}
                                        className={`px-8 py-4 rounded-[22px] text-[10px] font-black transition-all border uppercase tracking-[0.2em] shadow-lg ${selectedGenre === g
                                            ? 'ios26-liquid text-white border-white/30 scale-105'
                                            : 'ios26-glass bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                            <div>
                                <div className="flex items-center gap-4 mb-10">
                                    <Tag size={18} className="text-orange-500" />
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Temporal Window</h3>
                                </div>
                                <div className="ios26-tabs p-1.5 flex gap-2">
                                    {['All', '2020s', '2010s', 'Classics'].map(y => (
                                        <button
                                            key={y}
                                            onClick={() => setYearRange(y)}
                                            className={`flex-1 py-3.5 rounded-[18px] text-[9px] font-black transition-all uppercase tracking-widest ${yearRange === y ? 'bg-white text-black shadow-xl scale-105' : 'text-white/30 hover:text-white'
                                                }`}
                                        >
                                            {y}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-4 mb-10">
                                    <TrendingUp size={18} className="text-green-500" />
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Density Level</h3>
                                </div>
                                <div className="ios26-tabs p-1.5 flex gap-2">
                                    {['All', 'Top Hits', 'Deep Cuts'].map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setPopularity(p)}
                                            className={`flex-1 py-3.5 rounded-[18px] text-[9px] font-black transition-all uppercase tracking-widest ${popularity === p ? 'bg-white text-black shadow-xl scale-105' : 'text-white/30 hover:text-white'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* iOS 26 Results Grid */}
                    <section className="">
                        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-8">
                            <div>
                                <h3 className="text-4xl font-black tracking-tighter uppercase text-white leading-none">Logic Render</h3>
                                <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-2">{filteredTracks.length} Units Matching Signature</p>
                            </div>
                            {filteredTracks.length > 0 && (
                                <button
                                    onClick={handleCreatePlaylist}
                                    disabled={loading}
                                    className="ios26-liquid px-12 py-5 text-[10px] uppercase tracking-[0.3em] font-black text-white border border-white/20 shadow-2xl hover:scale-105 active:scale-95 transition-all w-full md:w-auto"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={18} /> : 'Commit to Spotify'}
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {filteredTracks.slice(0, 50).map(t => (
                                <div key={t.track.id} className="ios26-card-interactive p-5 flex items-center gap-6 group">
                                    <div className="w-16 h-16 rounded-[24px] overflow-hidden relative shadow-2xl ring-1 ring-white/10 group-hover:scale-110 transition-all duration-700">
                                        <img src={t.track.album.images[0]?.url} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" alt="" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-black truncate tracking-tighter uppercase text-white group-hover:text-blue-500 transition-colors">{t.track.name}</h4>
                                        <p className="text-[9px] text-white/30 font-black uppercase tracking-widest truncate mt-1">{t.track.artists[0].name}</p>
                                    </div>
                                    <div className="translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500">
                                        <div className="w-10 h-10 rounded-full ios26-liquid flex items-center justify-center border border-white/20 shadow-2xl">
                                            <ArrowLeft className="rotate-180 text-white" size={14} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {filteredTracks.length === 0 && (
                            <div className="py-32 text-center ios26-glass rounded-[48px] border border-white/5 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-white/[0.01] -z-10" />
                                <p className="text-white/40 font-black text-2xl tracking-tighter uppercase mb-2">No Signature Match</p>
                                <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.3em]">Adjust frequency filters to resume mapping.</p>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {loading && status.includes('Scanning') && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-3xl z-[100] flex flex-col items-center justify-center ">
                    <div className="ios26-liquid w-24 h-24 rounded-[32px] flex items-center justify-center mb-10 border border-white/20 shadow-[0_40px_80px_-20px_rgba(0,0,0,1)]">
                        <Loader2 className="animate-spin text-blue-500" size={40} />
                    </div>
                    <div className="text-center">
                        <h2 className="text-3xl font-black tracking-tighter uppercase text-white mb-2">Analyzing Library</h2>
                        <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.4em] animate-pulse">{status}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MoodMix;
