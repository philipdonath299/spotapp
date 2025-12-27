import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Loader2, Music, User, Clock, TrendingUp, Disc, X, Heart, CheckCircle } from 'lucide-react';

const Stats = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [topArtists, setTopArtists] = useState([]);
    const [topTracks, setTopTracks] = useState([]);
    const [topAlbums, setTopAlbums] = useState([]);
    const [recentTracks, setRecentTracks] = useState([]);
    const [timeRange, setTimeRange] = useState('medium_term');
    const [activeTab, setActiveTab] = useState('artists');
    const [selectedArtist, setSelectedArtist] = useState(null);
    const [artistDetails, setArtistDetails] = useState(null);
    const [artistDetailsLoading, setArtistDetailsLoading] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        fetchStats();
    }, [timeRange]);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const [artistsData, tracksData, recentData] = await Promise.all([
                spotifyFetch(`/me/top/artists?limit=50&time_range=${timeRange}`),
                spotifyFetch(`/me/top/tracks?limit=50&time_range=${timeRange}`),
                spotifyFetch(`/me/player/recently-played?limit=50`)
            ]);

            setTopArtists(artistsData.items || []);
            setTopTracks(tracksData.items || []);
            setRecentTracks(recentData.items || []);

            // Derive Top Albums
            const albumMap = {};
            (tracksData.items || []).forEach(track => {
                const albumId = track.album.id;
                if (!albumMap[albumId]) {
                    albumMap[albumId] = { ...track.album, count: 0 };
                }
                albumMap[albumId].count++;
            });
            const derivedAlbums = Object.values(albumMap).sort((a, b) => b.count - a.count).slice(0, 20);
            setTopAlbums(derivedAlbums);

        } catch (err) {
            console.error(err);
            setError('Failed to load stats. Please reconnect if permission was denied.');
        } finally {
            setLoading(false);
        }
    };

    const fetchArtistInsights = async (artist) => {
        setArtistDetailsLoading(true);
        setSelectedArtist(artist);
        try {
            // 1. Check if following artist
            const followingData = await spotifyFetch(`/me/following/contains?type=artist&ids=${artist.id}`);

            // 2. Scan liked songs (last 100)
            const [likedPart1, likedPart2] = await Promise.all([
                spotifyFetch(`/me/tracks?limit=50`),
                spotifyFetch(`/me/tracks?limit=50&offset=50`)
            ]);

            const allLiked = [...(likedPart1.items || []), ...(likedPart2.items || [])];
            const artistLiked = allLiked.filter(item =>
                item.track.artists.some(a => a.id === artist.id)
            );

            // 3. Find artist songs in user's top 50
            const inTop50 = topTracks.filter(track =>
                track.artists.some(a => a.id === artist.id)
            );

            setArtistDetails({
                isFollowing: followingData[0],
                likedCount: artistLiked.length,
                likedList: artistLiked,
                topTracksOccurrences: inTop50
            });
        } catch (err) {
            console.error(err);
        } finally {
            setArtistDetailsLoading(false);
        }
    };

    const formatDuration = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m ${seconds % 60}s`;
    };

    const getTotalRecentTime = () => {
        const totalMs = recentTracks.reduce((acc, item) => acc + item.track.duration_ms, 0);
        return formatDuration(totalMs);
    };

    if (loading && !topArtists.length) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <Loader2 className="animate-spin text-green-500" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 animate-fade-in relative">
            <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors group"
            >
                <ArrowLeft className="mr-2 group-hover:-translate-x-1 transition-transform" size={20} /> Back to Dashboard
            </button>

            <div className="max-w-6xl mx-auto">
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-green-500/10 rounded-2xl border border-green-500/20 shadow-2xl shadow-green-500/10">
                            <TrendingUp className="text-green-500" size={40} />
                        </div>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">Your Vibe Stats</h1>
                            <p className="text-gray-400 font-medium tracking-wide">Deep insights into your Spotify universe.</p>
                        </div>
                    </div>

                    <div className="flex bg-[#121212] p-1.5 rounded-xl border border-neutral-800 shadow-inner">
                        {['short_term', 'medium_term', 'long_term'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-5 py-2.5 rounded-lg text-sm font-black transition-all ${timeRange === range
                                        ? 'bg-[#282828] text-white shadow-xl scale-[1.02]'
                                        : 'text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                {range === 'short_term' ? 'Last Month' : range === 'medium_term' ? '6 Months' : 'All Time'}
                            </button>
                        ))}
                    </div>
                </header>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-2xl text-red-500 mb-10 flex items-center justify-between backdrop-blur-sm">
                        <span className="font-medium">{error}</span>
                        <button
                            onClick={() => { localStorage.clear(); window.location.href = '/'; }}
                            className="bg-white text-black px-6 py-2 rounded-full text-sm font-black hover:scale-105 transition-transform"
                        >
                            Reconnect Account
                        </button>
                    </div>
                )}

                {/* Main Tabs */}
                <div className="flex flex-wrap gap-2 mb-10 border-b border-neutral-800 pb-4">
                    {[
                        { id: 'artists', label: 'Top Artists', icon: User },
                        { id: 'tracks', label: 'Top Songs', icon: Music },
                        { id: 'albums', label: 'Top Albums', icon: Disc },
                        { id: 'recent', label: 'History', icon: Clock }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-black transition-all border ${activeTab === tab.id
                                    ? 'bg-green-500 border-green-500 text-black shadow-lg shadow-green-500/30'
                                    : 'bg-[#121212] border-neutral-800 text-gray-400 hover:text-white hover:border-neutral-700'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Section */}
                <div className="min-h-[400px]">
                    {activeTab === 'recent' && (
                        <section className="animate-fade-in">
                            <div className="flex justify-between items-center mb-8 bg-neutral-900/50 p-6 rounded-2xl border border-neutral-800">
                                <div>
                                    <h3 className="text-xl font-bold mb-1">Last 50 Track History</h3>
                                    <p className="text-sm text-gray-500 font-medium">Your most recent sessions.</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Total Time Volumne</div>
                                    <div className="text-2xl font-black text-green-500">{getTotalRecentTime()}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {recentTracks.map((item, index) => (
                                    <div key={item.played_at + index} className="flex items-center gap-4 bg-[#181818] p-4 rounded-2xl border border-neutral-800/50 hover:bg-[#222] transition-all group">
                                        <img
                                            src={item.track.album.images[1]?.url || item.track.album.images[0]?.url}
                                            className="w-14 h-14 rounded-lg shadow-xl group-hover:scale-105 transition-transform"
                                            alt={item.track.name}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold truncate text-sm group-hover:text-green-500 transition-colors">{item.track.name}</div>
                                            <div className="text-xs text-gray-400 truncate mb-1">{item.track.artists.map(a => a.name).join(', ')}</div>
                                            <div className="text-[10px] text-gray-600 font-mono">
                                                {new Date(item.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {activeTab === 'artists' && (
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                            {topArtists.map((artist) => (
                                <div
                                    key={artist.id}
                                    onClick={() => fetchArtistInsights(artist)}
                                    className="flex items-center gap-6 bg-[#181818] p-5 rounded-2xl border border-neutral-800/50 hover:border-green-500/50 hover:bg-[#222] transition-all group cursor-pointer"
                                >
                                    <img
                                        src={artist.images[1]?.url || artist.images[0]?.url}
                                        className="w-20 h-20 rounded-full object-cover shadow-2xl group-hover:scale-105 transition-transform"
                                        alt={artist.name}
                                    />
                                    <div className="flex-1">
                                        <h3 className="text-xl font-black group-hover:text-green-500 transition-colors mb-1">{artist.name}</h3>
                                        <p className="text-xs text-gray-400 uppercase tracking-widest font-black mb-3">{artist.genres.slice(0, 2).join(' • ')}</p>
                                        <div className="w-full bg-black h-1.5 rounded-full overflow-hidden border border-neutral-800">
                                            <div
                                                className="bg-green-500 h-full transition-all duration-1000"
                                                style={{ width: `${artist.popularity}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-gray-600 font-bold uppercase mt-1 inline-block">Popularity: {artist.popularity}%</span>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {activeTab === 'tracks' && (
                        <section className="space-y-4 animate-fade-in">
                            {topTracks.map((track) => (
                                <div key={track.id} className="flex items-center gap-6 bg-[#181818] p-4 rounded-2xl border border-neutral-800 hover:bg-[#222] transition-all group">
                                    <img
                                        src={track.album.images[1]?.url || track.album.images[0]?.url}
                                        className="w-16 h-16 rounded-xl shadow-2xl group-hover:scale-105 transition-transform"
                                        alt={track.name}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-lg font-black truncate group-hover:text-green-500 transition-colors uppercase tracking-tight">{track.name}</div>
                                        <div className="text-sm text-gray-400 truncate font-medium">{track.artists.map(a => a.name).join(', ')}</div>
                                        <div className="mt-2 flex items-center gap-3">
                                            <div className="flex-1 max-w-[200px] bg-black h-1.5 rounded-full overflow-hidden border border-neutral-800">
                                                <div className="bg-blue-500 h-full" style={{ width: `${track.popularity}%` }} />
                                            </div>
                                            <span className="text-[10px] text-gray-500 font-bold uppercase">Popularity: {track.popularity}%</span>
                                        </div>
                                    </div>
                                    <div className="hidden md:block text-right pr-6">
                                        <div className="text-xs text-gray-600 uppercase font-black mb-1">Duration</div>
                                        <div className="text-sm font-mono text-gray-400">{Math.floor(track.duration_ms / 60000)}:{(Math.floor(track.duration_ms / 1000) % 60).toString().padStart(2, '0')}</div>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {activeTab === 'albums' && (
                        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 animate-fade-in">
                            {topAlbums.map((album) => (
                                <div key={album.id} className="group cursor-default">
                                    <div className="relative aspect-square mb-4 shadow-2xl overflow-hidden rounded-2xl border border-neutral-800 group-hover:border-neutral-600 transition-all">
                                        <img
                                            src={album.images[0]?.url}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                            alt={album.name}
                                        />
                                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black border border-white/10 uppercase">
                                            {album.count} Tracks listed
                                        </div>
                                    </div>
                                    <h4 className="font-black text-sm truncate mb-1 group-hover:text-green-500 transition-colors">{album.name}</h4>
                                    <p className="text-xs text-gray-500 truncate font-medium">{album.artists.map(a => a.name).join(', ')}</p>
                                </div>
                            ))}
                        </section>
                    )}
                </div>
            </div>

            {/* Artist Detail Modal */}
            {selectedArtist && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
                    <div className="bg-[#121212] w-full max-w-2xl rounded-3xl border border-neutral-800 overflow-hidden shadow-2xl animate-scale-up">
                        <div className="relative h-64">
                            <img
                                src={selectedArtist.images[0]?.url}
                                className="w-full h-full object-cover opacity-60"
                                alt={selectedArtist.name}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent" />
                            <button
                                onClick={() => setSelectedArtist(null)}
                                className="absolute top-6 right-6 bg-black/50 p-2 rounded-full hover:bg-black transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <div className="absolute bottom-6 left-10">
                                <h2 className="text-6xl font-black tracking-tighter mb-2">{selectedArtist.name}</h2>
                                <div className="flex gap-3">
                                    {selectedArtist.genres.slice(0, 3).map(g => (
                                        <span key={g} className="bg-green-500/20 text-green-500 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-green-500/30">
                                            {g}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-8 text-center border-t border-neutral-800">
                            {artistDetailsLoading ? (
                                <div className="col-span-3 py-12 flex flex-col items-center gap-4">
                                    <Loader2 className="animate-spin text-green-500" size={32} />
                                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Crunching your listening data...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800">
                                        <div className="flex justify-center mb-3 text-red-500">
                                            <Heart size={28} fill={artistDetails?.likedCount > 0 ? "currentColor" : "none"} />
                                        </div>
                                        <div className="text-3xl font-black mb-1">{artistDetails?.likedCount || 0}</div>
                                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Liked Songs</div>
                                    </div>

                                    <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800">
                                        <div className="flex justify-center mb-3 text-blue-500">
                                            <CheckCircle size={28} />
                                        </div>
                                        <div className="text-xl font-black mb-1">{artistDetails?.isFollowing ? 'FOLLOWING' : 'NOT FOLLOWED'}</div>
                                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-wider">Fan Status</div>
                                    </div>

                                    <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800">
                                        <div className="flex justify-center mb-3 text-green-500">
                                            <TrendingUp size={28} />
                                        </div>
                                        <div className="text-3xl font-black mb-1">{artistDetails?.topTracksOccurrences?.length || 0}</div>
                                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-wider">In Top 50</div>
                                    </div>

                                    {artistDetails?.topTracksOccurrences?.length > 0 && (
                                        <div className="col-span-3 mt-4 text-left">
                                            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Your Heavy Rotation Tracks</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {artistDetails.topTracksOccurrences.map(t => (
                                                    <div key={t.id} className="bg-[#222] px-4 py-2 rounded-xl text-sm font-bold border border-neutral-800">
                                                        {t.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Stats;
