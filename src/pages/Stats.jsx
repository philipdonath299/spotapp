import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Loader2, Music, User, Clock, TrendingUp } from 'lucide-react';

const Stats = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [topArtists, setTopArtists] = useState([]);
    const [topTracks, setTopTracks] = useState([]);
    const [recentTracks, setRecentTracks] = useState([]);
    const [timeRange, setTimeRange] = useState('medium_term'); // short_term, medium_term, long_term
    const navigate = useNavigate();

    useEffect(() => {
        fetchStats();
    }, [timeRange]);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const [artistsData, tracksData, recentData] = await Promise.all([
                spotifyFetch(`/me/top/artists?limit=10&time_range=${timeRange}`),
                spotifyFetch(`/me/top/tracks?limit=10&time_range=${timeRange}`),
                spotifyFetch(`/me/player/recently-played?limit=20`)
            ]);

            setTopArtists(artistsData.items || []);
            setTopTracks(tracksData.items || []);
            setRecentTracks(recentData.items || []);
        } catch (err) {
            console.error(err);
            setError('Failed to load your stats. You might need to log out and log back in to grant new permissions.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !topArtists.length) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <Loader2 className="animate-spin text-green-500" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 animate-fade-in">
            <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft className="mr-2" size={20} /> Back to Dashboard
            </button>

            <div className="max-w-6xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Listening Stats</h1>
                        <p className="text-gray-400">Insights into your musical journey.</p>
                    </div>

                    <div className="flex bg-[#181818] p-1 rounded-lg border border-neutral-800">
                        {[
                            { id: 'short_term', label: '4 Weeks' },
                            { id: 'medium_term', label: '6 Months' },
                            { id: 'long_term', label: 'All Time' }
                        ].map((range) => (
                            <button
                                key={range.id}
                                onClick={() => setTimeRange(range.id)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${timeRange === range.id
                                        ? 'bg-neutral-700 text-white'
                                        : 'text-gray-500 hover:text-white'
                                    }`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                </header>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-500 mb-8 flex items-center justify-between">
                        <span>{error}</span>
                        <button
                            onClick={() => { localStorage.clear(); window.location.href = '/'; }}
                            className="bg-white text-black px-4 py-1 rounded-full text-sm font-bold"
                        >
                            Reconnect
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
                    {/* Top Artists */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <TrendingUp className="text-green-500" size={24} />
                            <h2 className="text-2xl font-bold">Top Artists</h2>
                        </div>
                        <div className="space-y-3">
                            {topArtists.map((artist, index) => (
                                <div key={artist.id} className="flex items-center gap-4 bg-[#181818] p-3 rounded-xl border border-neutral-800/50 hover:border-neutral-700 transition-all group">
                                    <span className="w-8 text-center text-gray-500 font-mono">{index + 1}</span>
                                    <img
                                        src={artist.images[2]?.url || artist.images[0]?.url}
                                        className="w-12 h-12 rounded-full object-cover shadow-lg"
                                        alt={artist.name}
                                    />
                                    <div className="flex-1">
                                        <div className="font-bold group-hover:text-green-500 transition-colors">{artist.name}</div>
                                        <div className="text-xs text-gray-400 capitalize">{artist.genres.slice(0, 2).join(', ')}</div>
                                    </div>
                                    <div className="text-xs text-gray-600 font-mono">{artist.popularity}% popularity</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Top Tracks */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <Music className="text-green-500" size={24} />
                            <h2 className="text-2xl font-bold">Top Tracks</h2>
                        </div>
                        <div className="space-y-3">
                            {topTracks.map((track, index) => (
                                <div key={track.id} className="flex items-center gap-4 bg-[#181818] p-3 rounded-xl border border-neutral-800/50 hover:border-neutral-700 transition-all group">
                                    <span className="w-8 text-center text-gray-500 font-mono">{index + 1}</span>
                                    <img
                                        src={track.album.images[2]?.url || track.album.images[0]?.url}
                                        className="w-12 h-12 rounded shadow-lg"
                                        alt={track.name}
                                    />
                                    <div className="flex-1 truncate">
                                        <div className="font-bold truncate group-hover:text-green-500 transition-colors">{track.name}</div>
                                        <div className="text-xs text-gray-400 truncate">{track.artists.map(a => a.name).join(', ')}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Recently Played */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <Clock className="text-green-500" size={24} />
                        <h2 className="text-2xl font-bold">Recently Played</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recentTracks.map((item, index) => (
                            <div key={item.played_at + index} className="flex items-center gap-3 bg-[#121212] p-3 rounded-xl border border-neutral-900 hover:bg-[#181818] transition-all">
                                <img
                                    src={item.track.album.images[2]?.url || item.track.album.images[0]?.url}
                                    className="w-10 h-10 rounded shadow"
                                    alt={item.track.name}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold truncate">{item.track.name}</div>
                                    <div className="text-[10px] text-gray-500 truncate">{item.track.artists.map(a => a.name).join(', ')}</div>
                                </div>
                                <div className="text-[10px] text-gray-600 whitespace-nowrap">
                                    {new Date(item.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Stats;
