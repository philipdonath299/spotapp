import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Loader2, Music, User, Clock, TrendingUp, Disc, X, Heart, CheckCircle, PlaySquare } from 'lucide-react';

const Stats = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [topArtists, setTopArtists] = useState([]);
    const [topTracks, setTopTracks] = useState([]);
    const [topAlbums, setTopAlbums] = useState([]);
    const [recentTracks, setRecentTracks] = useState([]);
    const [timeRange, setTimeRange] = useState('medium_term');
    const [activeTab, setActiveTab] = useState('artists');

    // Modal States
    const [selectedArtist, setSelectedArtist] = useState(null);
    const [artistDetails, setArtistDetails] = useState(null);
    const [artistDetailsLoading, setArtistDetailsLoading] = useState(false);

    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [albumDetails, setAlbumDetails] = useState(null);
    const [albumDetailsLoading, setAlbumDetailsLoading] = useState(false);

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
            const [followingData, likedPart1, likedPart2] = await Promise.all([
                spotifyFetch(`/me/following/contains?type=artist&ids=${artist.id}`),
                spotifyFetch(`/me/tracks?limit=50`),
                spotifyFetch(`/me/tracks?limit=50&offset=50`)
            ]);

            const allLiked = [...(likedPart1.items || []), ...(likedPart2.items || [])];
            const artistLiked = allLiked.filter(item =>
                item.track.artists.some(a => a.id === artist.id)
            );

            const inTop50 = topTracks.filter(track =>
                track.artists.some(a => a.id === artist.id)
            );

            setArtistDetails({
                isFollowing: followingData[0],
                likedCount: artistLiked.length,
                topTracksOccurrences: inTop50
            });
        } catch (err) {
            console.error(err);
        } finally {
            setArtistDetailsLoading(false);
        }
    };

    const fetchAlbumInsights = async (album) => {
        setAlbumDetailsLoading(true);
        setSelectedAlbum(album);
        try {
            const tracksData = await spotifyFetch(`/albums/${album.id}/tracks?limit=50`);

            // Check which tracks are in user's top 50
            const enrichment = tracksData.items.map(t => ({
                ...t,
                isTopTrack: topTracks.some(tt => tt.id === t.id)
            }));

            setAlbumDetails({
                tracks: enrichment,
                releaseDate: album.release_date
            });
        } catch (err) {
            console.error(err);
        } finally {
            setAlbumDetailsLoading(false);
        }
    };

    const formatDuration = (ms) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return `${minutes}:${seconds.padStart(2, '0')}`;
    };

    const getTotalRecentTime = () => {
        const totalMs = recentTracks.reduce((acc, item) => acc + item.track.duration_ms, 0);
        const hours = Math.floor(totalMs / 3600000);
        const mins = Math.floor((totalMs % 3600000) / 60000);
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
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

                <div className="min-h-[400px]">
                    {activeTab === 'recent' && (
                        <section className="animate-fade-in">
                            <div className="flex justify-between items-center mb-8 bg-neutral-900/50 p-6 rounded-2xl border border-neutral-800">
                                <div>
                                    <h3 className="text-xl font-bold mb-1">Last 50 sessions</h3>
                                    <p className="text-sm text-gray-500">Your most recent music history.</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Volumne</div>
                                    <div className="text-2xl font-black text-green-500">{getTotalRecentTime()}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {recentTracks.map((item, index) => (
                                    <div key={item.played_at + index} className="flex items-center gap-4 bg-[#181818] p-4 rounded-2xl border border-neutral-800/50 hover:bg-[#222] transition-all group">
                                        <img src={item.track.album.images[2]?.url} className="w-14 h-14 rounded-lg" alt="" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold truncate text-sm">{item.track.name}</div>
                                            <div className="text-xs text-gray-400 truncate">{item.track.artists[0].name}</div>
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
                                    <img src={artist.images[1]?.url} className="w-20 h-20 rounded-full object-cover shadow-2xl" alt="" />
                                    <div className="flex-1">
                                        <h3 className="text-xl font-black group-hover:text-green-500 transition-colors mb-1">{artist.name}</h3>
                                        <p className="text-xs text-gray-400 uppercase tracking-widest font-black mb-3">{artist.genres.slice(0, 2).join(' • ')}</p>
                                        <div className="w-full bg-black h-1.5 rounded-full overflow-hidden border border-neutral-800">
                                            <div className="bg-green-500 h-full" style={{ width: `${artist.popularity}%` }} />
                                        </div>
                                        <span className="text-[10px] text-gray-600 font-bold uppercase mt-1 inline-block">Popularity: {artist.popularity}%</span>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {activeTab === 'tracks' && (
                        <section className="space-y-4 animate-fade-in leading-none">
                            {topTracks.map((track) => (
                                <div key={track.id} className="flex items-center gap-6 bg-[#181818] p-4 rounded-2xl border border-neutral-800 hover:bg-[#222] transition-all group">
                                    <img src={track.album.images[2]?.url} className="w-16 h-16 rounded-xl shadow-2xl" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-lg font-black truncate group-hover:text-green-500 transition-colors uppercase tracking-tight mb-2">{track.name}</div>
                                        <div className="text-sm text-gray-400 truncate font-medium">{track.artists.map(a => a.name).join(', ')}</div>
                                        <div className="mt-3 flex items-center gap-3">
                                            <div className="flex-1 max-w-[200px] bg-black h-1.5 rounded-full overflow-hidden border border-neutral-800">
                                                <div className="bg-blue-500 h-full" style={{ width: `${track.popularity}%` }} />
                                            </div>
                                            <span className="text-[10px] text-gray-500 font-bold uppercase">Popularity: {track.popularity}%</span>
                                        </div>
                                    </div>
                                    <div className="hidden md:block text-right pr-6">
                                        <div className="text-xs text-gray-600 uppercase font-black mb-1">Length</div>
                                        <div className="text-sm font-mono text-gray-400">{formatDuration(track.duration_ms)}</div>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {activeTab === 'albums' && (
                        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 animate-fade-in">
                            {topAlbums.map((album) => (
                                <div
                                    key={album.id}
                                    onClick={() => fetchAlbumInsights(album)}
                                    className="group cursor-pointer"
                                >
                                    <div className="relative aspect-square mb-4 shadow-2xl overflow-hidden rounded-2xl border border-neutral-800 group-hover:border-green-500/50 transition-all">
                                        <img src={album.images[0]?.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black border border-white/10 uppercase">
                                            {album.count} of your favorites
                                        </div>
                                    </div>
                                    <h4 className="font-black text-sm truncate mb-1 group-hover:text-green-500 transition-colors">{album.name}</h4>
                                    <p className="text-xs text-gray-500 truncate font-medium">{album.artists[0].name}</p>
                                </div>
                            ))}
                        </section>
                    )}
                </div>
            </div>

            {/* Artist Detail Modal */}
            {selectedArtist && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#121212] w-full max-w-2xl rounded-[2.5rem] border border-neutral-800 overflow-hidden shadow-[0_0_100px_rgba(34,197,94,0.15)] animate-scale-up">
                        <div className="relative h-72">
                            <img src={selectedArtist.images[0]?.url} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/30 to-transparent" />
                            <button onClick={() => setSelectedArtist(null)} className="absolute top-8 right-8 bg-black/60 p-3 rounded-full hover:bg-black transition-colors"><X size={24} /></button>
                            <div className="absolute bottom-8 left-12 right-12">
                                <h2 className="text-5xl font-black tracking-tighter mb-4 flex items-center gap-4">
                                    {selectedArtist.name}
                                    {artistDetails?.isFollowing && <CheckCircle className="text-green-500" size={32} />}
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {selectedArtist.genres.map(g => (
                                        <span key={g} className="bg-white/5 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-black border border-white/10 uppercase tracking-widest">{g}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-12">
                            <div className="grid grid-cols-2 gap-4 mb-10">
                                <div className="bg-[#181818] p-8 rounded-3xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-2">
                                    <Heart className="text-red-500 mb-1" size={32} fill={artistDetails?.likedCount > 0 ? "currentColor" : "none"} />
                                    <div className="text-4xl font-black">{artistDetails?.likedCount || 0}</div>
                                    <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Library Matches</div>
                                </div>
                                <div className="bg-[#181818] p-8 rounded-3xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-2">
                                    <TrendingUp className="text-green-500 mb-1" size={32} />
                                    <div className="text-4xl font-black">{artistDetails?.topTracksOccurrences?.length || 0}</div>
                                    <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">In your top 50</div>
                                </div>
                            </div>

                            {artistDetails?.topTracksOccurrences?.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6">Your heavy rotation tracks</h4>
                                    <div className="space-y-2">
                                        {artistDetails.topTracksOccurrences.map(t => (
                                            <div key={t.id} className="bg-[#222] p-4 rounded-2xl flex items-center gap-4 border border-neutral-800 hover:border-neutral-700 transition-all">
                                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                                <span className="font-bold text-sm">{t.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Album Detail Modal */}
            {selectedAlbum && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#121212] w-full max-w-2xl rounded-[2.5rem] border border-neutral-800 overflow-hidden shadow-2xl animate-scale-up">
                        <div className="flex flex-col md:flex-row h-[500px]">
                            <div className="w-full md:w-1/2 relative">
                                <img src={selectedAlbum.images[0]?.url} className="w-full h-full object-cover" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent hidden md:block" />
                                <div className="absolute bottom-8 left-8 right-8 md:block">
                                    <h2 className="text-3xl font-black tracking-tighter mb-2">{selectedAlbum.name}</h2>
                                    <p className="text-green-500 font-bold text-sm tracking-widest">{selectedAlbum.artists[0].name}</p>
                                    <p className="text-gray-500 text-xs mt-2 font-mono">Released: {new Date(albumDetails?.releaseDate).getFullYear()}</p>
                                </div>
                            </div>

                            <div className="w-full md:w-1/2 p-8 flex flex-col relative">
                                <button onClick={() => setSelectedAlbum(null)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"><X size={24} /></button>
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6">Full Tracklist</h3>

                                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                                    {albumDetailsLoading ? (
                                        <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-green-500" /></div>
                                    ) : (
                                        albumDetails?.tracks?.map((track, i) => (
                                            <div key={track.id} className="group flex items-center gap-4 p-3 rounded-xl hover:bg-neutral-800/50 transition-all">
                                                <span className="w-4 text-[10px] font-mono text-gray-600">{i + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-sm font-bold truncate ${track.isTopTrack ? 'text-green-500' : 'text-gray-300'}`}>{track.name}</div>
                                                </div>
                                                {track.isTopTrack && <CheckCircle size={14} className="text-green-500" />}
                                                <span className="text-[10px] font-mono text-gray-600">{formatDuration(track.duration_ms)}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="mt-6 pt-6 border-t border-neutral-800 text-[10px] text-gray-600 font-black uppercase tracking-widest flex items-center gap-2">
                                    <PlaySquare size={14} /> {albumDetails?.tracks?.length || 0} Total Tracks
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Stats;
