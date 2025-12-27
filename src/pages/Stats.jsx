import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Loader2, Music, User, Clock, TrendingUp, Disc, X, Heart, CheckCircle, PlaySquare, Users, Zap, Calendar, Sparkles, Mic, Activity, Layers, Volume2, Flame } from 'lucide-react';

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

    const [selectedTrack, setSelectedTrack] = useState(null);
    const [trackFeatures, setTrackFeatures] = useState(null);
    const [trackFeaturesLoading, setTrackFeaturesLoading] = useState(false);
    const [isTrackLiked, setIsTrackLiked] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        if (selectedArtist || selectedAlbum || selectedTrack) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => { document.body.style.overflow = 'auto'; };
    }, [selectedArtist, selectedAlbum, selectedTrack]);

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
            const [followingData, likedPart1, likedPart2, relatedData] = await Promise.all([
                spotifyFetch(`/me/following/contains?type=artist&ids=${artist.id}`),
                spotifyFetch(`/me/tracks?limit=50`),
                spotifyFetch(`/me/tracks?limit=50&offset=50`),
                spotifyFetch(`/artists/${artist.id}/related-artists`)
            ]);

            const allLiked = [...(likedPart1.items || []), ...(likedPart2.items || [])];
            const artistLiked = allLiked.filter(item =>
                item.track.artists.some(a => a.id === artist.id)
            );

            const inTop50 = topTracks.filter(track => {
                // Handle different track structures (sometimes artists are flat, sometimes nested)
                const artistsList = track.artists || (track.track && track.track.artists) || [];
                return artistsList.some(a => a.id === artist.id);
            });

            setArtistDetails({
                isFollowing: followingData[0],
                likedCount: artistLiked.length,
                topTracksOccurrences: inTop50,
                relatedArtists: (relatedData.artists || []).slice(0, 5)
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
            const [tracksData, fullAlbum] = await Promise.all([
                spotifyFetch(`/albums/${album.id}/tracks?limit=50`),
                spotifyFetch(`/albums/${album.id}`)
            ]);

            // Check which tracks are in user's top 50 and inject album metadata
            const enrichment = (tracksData.items || []).map(t => ({
                ...t,
                isTopTrack: topTracks.some(tt => tt.id === t.id),
                album: {
                    id: fullAlbum.id,
                    name: fullAlbum.name,
                    images: fullAlbum.images,
                    release_date: fullAlbum.release_date
                },
                popularity: fullAlbum.popularity // Fallback popularity
            }));

            setAlbumDetails({
                tracks: enrichment,
                releaseDate: fullAlbum.release_date,
                label: fullAlbum.label,
                popularity: fullAlbum.popularity,
                totalDurationMs: (tracksData.items || []).reduce((acc, t) => acc + t.duration_ms, 0)
            });
        } catch (err) {
            console.error(err);
        } finally {
            setAlbumDetailsLoading(false);
        }
    };

    const getMusicalKey = (key, mode) => {
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        if (key === -1) return 'Unknown';
        return `${keys[key]} ${mode === 1 ? 'Major' : 'Minor'}`;
    };

    const getSongTraits = (features) => {
        const traits = [];
        if (features.energy > 0.75) traits.push({ icon: <Zap size={14} />, label: 'High Octane', color: 'text-orange-500', bg: 'bg-orange-500/10' });
        else if (features.energy < 0.3) traits.push({ icon: <Clock size={14} />, label: 'Chilled Out', color: 'text-blue-400', bg: 'bg-blue-400/10' });

        if (features.danceability > 0.75) traits.push({ icon: <Mic size={14} />, label: 'Club Ready', color: 'text-green-500', bg: 'bg-green-500/10' });

        if (features.valence > 0.7) traits.push({ icon: <Sparkles size={14} />, label: 'Euphoric', color: 'text-yellow-500', bg: 'bg-yellow-500/10' });
        else if (features.valence < 0.3) traits.push({ icon: <Volume2 size={14} />, label: 'Moody & Deep', color: 'text-purple-500', bg: 'bg-purple-500/10' });

        if (features.acousticness > 0.7) traits.push({ icon: <Music size={14} />, label: 'Deeply Acoustic', color: 'text-blue-200', bg: 'bg-blue-200/10' });

        if (features.instrumentalness > 0.5) traits.push({ icon: <Layers size={14} />, label: 'Purely Instrumental', color: 'text-gray-400', bg: 'bg-gray-400/10' });

        if (features.liveness > 0.8) traits.push({ icon: <Mic size={14} />, label: 'Live Performance', color: 'text-red-500', bg: 'bg-red-500/10' });

        return traits;
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

    const fetchTrackInsights = async (track) => {
        setTrackFeaturesLoading(true);
        setSelectedTrack(track);
        // Clear other modals for a clean transition
        setSelectedArtist(null);
        setSelectedAlbum(null);

        setTrackFeatures(null); // Clear old data
        try {
            // Ensure we have a clean 22-char Spotify ID
            let cleanId = track.id;
            if (cleanId.includes(':')) {
                cleanId = cleanId.split(':').pop();
            }
            // Trip any whitespace
            cleanId = cleanId.trim();

            const [features, likedData] = await Promise.all([
                spotifyFetch(`/audio-features/${cleanId}`),
                spotifyFetch(`/me/tracks/contains?ids=${cleanId}`)
            ]);

            if (features && features.danceability !== undefined) {
                setTrackFeatures(features);
            } else {
                setTrackFeatures(null);
            }
            setIsTrackLiked(likedData[0]);
        } catch (err) {
            console.error("Audio features failed:", err);
            setTrackFeatures(null);
        } finally {
            setTrackFeaturesLoading(false);
        }
    };

    const openArtistById = async (id) => {
        try {
            const artist = await spotifyFetch(`/artists/${id}`);
            // Clear other modals
            setSelectedTrack(null);
            setSelectedAlbum(null);
            fetchArtistInsights(artist);
        } catch (err) {
            console.error(err);
        }
    };

    const openAlbumById = async (id) => {
        try {
            const album = await spotifyFetch(`/albums/${id}`);
            // Clear other modals
            setSelectedTrack(null);
            setSelectedArtist(null);
            fetchAlbumInsights(album);
        } catch (err) {
            console.error(err);
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
        <div className="min-h-screen bg-black text-white p-4 md:p-8 relative">
            <div className="animate-fade-in">
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
                                        <div
                                            key={item.played_at + index}
                                            onClick={() => fetchTrackInsights(item.track)}
                                            className="flex items-center gap-4 bg-[#181818] p-4 rounded-2xl border border-neutral-800/50 hover:bg-[#222] transition-all group cursor-pointer"
                                        >
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
                                    <div
                                        key={track.id}
                                        onClick={() => fetchTrackInsights(track)}
                                        className="flex items-center gap-6 bg-[#181818] p-4 rounded-2xl border border-neutral-800 hover:bg-[#222] transition-all group cursor-pointer"
                                    >
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
            </div>

            {/* Artist Detail Modal */}
            {selectedArtist && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in scrollbar-hide"
                    onClick={() => setSelectedArtist(null)}
                >
                    <div
                        className="bg-[#121212] w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] border border-neutral-800 overflow-hidden shadow-[0_0_100px_rgba(34,197,94,0.15)] animate-scale-up flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative h-72 shrink-0">
                            <img src={selectedArtist.images[0]?.url} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/30 to-transparent" />
                            <button onClick={() => setSelectedArtist(null)} className="absolute top-8 right-8 bg-black/60 p-3 rounded-full hover:bg-black transition-colors z-10"><X size={24} /></button>
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

                        <div className="p-10 md:p-12 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                                <div className="bg-[#181818] p-5 rounded-3xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-1">
                                    <Heart className="text-red-500 mb-1" size={24} fill={artistDetails?.likedCount > 0 ? "currentColor" : "none"} />
                                    <div className="text-2xl font-black">{artistDetails?.likedCount || 0}</div>
                                    <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-tight">Your Likes</div>
                                </div>
                                <div className="bg-[#181818] p-5 rounded-3xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-1">
                                    <TrendingUp className="text-green-500 mb-1" size={24} />
                                    <div className="text-2xl font-black">{artistDetails?.topTracksOccurrences?.length || 0}</div>
                                    <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-tight">In Rotation</div>
                                </div>
                                <div className="bg-[#181818] p-5 rounded-3xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-1">
                                    <Users className="text-blue-500 mb-1" size={24} />
                                    <div className="text-2xl font-black">{selectedArtist.followers?.total >= 1000000 ? (selectedArtist.followers.total / 1000000).toFixed(1) + 'M' : (selectedArtist.followers?.total / 1000).toFixed(0) + 'K'}</div>
                                    <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-tight">Followers</div>
                                </div>
                                <div className="bg-[#181818] p-5 rounded-3xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-1">
                                    <Zap className="text-yellow-500 mb-1" size={24} />
                                    <div className="text-2xl font-black">{selectedArtist.popularity}%</div>
                                    <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-tight">Global Rank</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {artistDetails?.topTracksOccurrences?.length > 0 && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                            <Music size={14} /> My heavy rotation
                                        </h4>
                                        <div className="space-y-2">
                                            {artistDetails.topTracksOccurrences.map(t => (
                                                <div
                                                    key={t.id}
                                                    onClick={() => fetchTrackInsights(t)}
                                                    className="bg-[#181818] p-4 rounded-2xl flex items-center gap-4 border border-neutral-800 hover:border-green-500/50 hover:bg-[#282828] transition-all cursor-pointer group/track"
                                                >
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                    <span className="font-bold text-sm group-hover/track:text-green-500 transition-colors uppercase tracking-tight truncate flex-1">{t.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {artistDetails?.relatedArtists?.length > 0 && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                            <Disc size={14} /> Related Artists
                                        </h4>
                                        <div className="space-y-3">
                                            {artistDetails.relatedArtists.map(rel => (
                                                <div
                                                    key={rel.id}
                                                    onClick={() => fetchArtistInsights(rel)}
                                                    className="flex items-center gap-4 group cursor-pointer"
                                                >
                                                    <img src={rel.images[2]?.url} className="w-10 h-10 rounded-full grayscale group-hover:grayscale-0 transition-all border border-neutral-800 group-hover:border-green-500" alt="" />
                                                    <div className="text-sm font-bold text-gray-400 group-hover:text-white transition-colors">{rel.name}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Album Detail Modal */}
            {selectedAlbum && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in"
                    onClick={() => setSelectedAlbum(null)}
                >
                    <div
                        className="bg-[#121212] w-full max-w-2xl rounded-[2.5rem] border border-neutral-800 overflow-hidden shadow-2xl animate-scale-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col md:flex-row h-[500px]">
                            <div className="w-full md:w-1/2 relative">
                                <img src={selectedAlbum.images[0]?.url} className="w-full h-full object-cover" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent hidden md:block" />
                                <div className="absolute bottom-8 left-8 right-8 md:block">
                                    <h2 className="text-3xl font-black tracking-tighter mb-2">{selectedAlbum.name}</h2>
                                    <p className="text-green-500 font-bold text-sm tracking-widest cursor-pointer hover:underline" onClick={() => openArtistById(selectedAlbum.artists[0].id)}>
                                        {selectedAlbum.artists[0].name}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4">
                                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                                            <Calendar size={12} /> {new Date(albumDetails?.releaseDate).getFullYear()}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                                            <Clock size={12} /> {albumDetails?.totalDurationMs ? Math.floor(albumDetails.totalDurationMs / 60000) + 'm' : '--'}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                                            <Zap size={12} /> {albumDetails?.popularity}% Pop.
                                        </div>
                                    </div>
                                    <div className="mt-4 text-[10px] text-gray-600 font-bold uppercase tracking-widest bg-white/5 py-1.5 px-3 rounded-lg border border-white/5 inline-block">
                                        {albumDetails?.label}
                                    </div>
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
                                            <div
                                                key={track.id}
                                                onClick={() => fetchTrackInsights(track)}
                                                className="group flex items-center gap-4 p-3 rounded-xl hover:bg-neutral-800/80 transition-all cursor-pointer"
                                            >
                                                <span className="w-4 text-[10px] font-mono text-gray-600">{i + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-sm font-bold truncate ${track.isTopTrack ? 'text-green-500' : 'text-gray-300'} group-hover:text-green-400`}>{track.name}</div>
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

            {/* Track Detail Modal */}
            {selectedTrack && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fade-in"
                    onClick={() => setSelectedTrack(null)}
                >
                    <div
                        className="bg-[#121212] w-full max-w-xl rounded-[2.5rem] border border-neutral-800 overflow-hidden shadow-2xl animate-scale-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8">
                            <div className="flex items-center gap-6 mb-8">
                                <img
                                    src={selectedTrack.album?.images[0]?.url || selectedAlbum?.images[0]?.url}
                                    className="w-32 h-32 rounded-2xl shadow-2xl cursor-pointer hover:scale-105 transition-transform"
                                    alt=""
                                    onClick={() => selectedTrack.album && openAlbumById(selectedTrack.album.id)}
                                />
                                <div className="min-w-0">
                                    <h2 className="text-2xl font-black mb-1 truncate">{selectedTrack.name}</h2>
                                    <div className="flex flex-wrap gap-x-2 text-gray-400 font-bold mb-3">
                                        {selectedTrack.artists?.map((a, i) => (
                                            <span
                                                key={a.id}
                                                onClick={() => openArtistById(a.id)}
                                                className="hover:text-green-500 cursor-pointer transition-colors"
                                            >
                                                {a.name}{i < selectedTrack.artists.length - 1 ? ',' : ''}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-3">
                                            {isTrackLiked ? (
                                                <div className="flex items-center gap-1.5 bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/20">
                                                    <Heart size={12} fill="currentColor" /> Liked
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Not in library</div>
                                            )}
                                            <div className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
                                                {selectedTrack.popularity || selectedAlbum?.popularity}% Popular
                                            </div>
                                        </div>
                                        {(selectedTrack.album?.name || selectedAlbum?.name) && (
                                            <div
                                                onClick={() => (selectedTrack.album?.id || selectedAlbum?.id) && openAlbumById(selectedTrack.album?.id || selectedAlbum?.id)}
                                                className="text-[10px] text-gray-500 font-black uppercase tracking-widest hover:text-green-500 cursor-pointer transition-colors flex items-center gap-1.5"
                                            >
                                                <Disc size={12} /> {selectedTrack.album?.name || selectedAlbum?.name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex justify-between items-center">
                                    <span>Musical Anatomy</span>
                                    {(selectedTrack.album?.release_date || selectedAlbum?.release_date) && (
                                        <span className="text-gray-600">Released: {new Date(selectedTrack.album?.release_date || selectedAlbum?.release_date).getFullYear()}</span>
                                    )}
                                </h3>

                                {trackFeaturesLoading ? (
                                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-green-500" /></div>
                                ) : trackFeatures ? (
                                    <div className="space-y-8">
                                        <div className="flex flex-wrap gap-2">
                                            {getSongTraits(trackFeatures).map((trait, i) => (
                                                <div key={i} className={`${trait.bg} ${trait.color} px-4 py-2 rounded-full flex items-center gap-2 border border-white/5 shadow-xl animate-fade-in`}>
                                                    {trait.icon}
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{trait.label}</span>
                                                </div>
                                            ))}
                                            {getSongTraits(trackFeatures).length === 0 && (
                                                <div className="bg-white/5 text-gray-400 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5">Solid Neutral Vibe</div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-3 gap-6">
                                            <div className="bg-[#181818] p-6 rounded-[2rem] border border-neutral-800 text-center group hover:border-blue-500/30 transition-all">
                                                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                                                    <Activity size={12} className="text-blue-500" /> Tempo
                                                </div>
                                                <div className="text-3xl font-black text-white">{Math.round(trackFeatures.tempo)}</div>
                                                <div className="text-[10px] font-bold text-gray-600 mt-1 uppercase">Beats PM</div>
                                            </div>
                                            <div className="bg-[#181818] p-6 rounded-[2rem] border border-neutral-800 text-center group hover:border-purple-500/30 transition-all">
                                                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                                                    <Layers size={12} className="text-purple-500" /> Harmony
                                                </div>
                                                <div className="text-3xl font-black text-white truncate">{getMusicalKey(trackFeatures.key, trackFeatures.mode).split(' ')[0]}</div>
                                                <div className="text-[10px] font-bold text-gray-600 mt-1 uppercase">{getMusicalKey(trackFeatures.key, trackFeatures.mode).split(' ')[1]}</div>
                                            </div>
                                            <div className="bg-[#181818] p-6 rounded-[2rem] border border-neutral-800 text-center group hover:border-green-500/30 transition-all">
                                                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                                                    <Flame size={12} className="text-green-500" /> Energy
                                                </div>
                                                <div className="text-3xl font-black text-white">{Math.round(trackFeatures.energy * 100)}%</div>
                                                <div className="text-[10px] font-bold text-gray-600 mt-1 uppercase">Dynamic</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center p-8 text-gray-500 text-xs font-medium bg-white/5 rounded-3xl border border-white/5">Vibe data unavailable for this track.</div>
                                )}

                                <div className="mt-8 pt-6 border-t border-neutral-800 flex justify-between items-center">
                                    <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest">
                                        Released: {new Date(selectedTrack.album?.release_date || selectedAlbum?.release_date).getFullYear() || 'Unknown'}
                                    </div>
                                    <button
                                        onClick={() => setSelectedTrack(null)}
                                        className="text-[10px] font-black uppercase tracking-widest bg-[#222] hover:bg-[#333] px-6 py-2 rounded-full transition-all"
                                    >
                                        Close
                                    </button>
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
