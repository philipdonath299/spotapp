import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Loader2, Music, User, Clock, TrendingUp, Disc, X, Heart, CheckCircle, PlaySquare, Users, Zap, Calendar, Sparkles, Mic, Activity, Layers, Volume2, Flame, Trophy } from 'lucide-react';

const Stats = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [topArtists, setTopArtists] = useState([]);
    const [topTracks, setTopTracks] = useState([]);
    const [topAlbums, setTopAlbums] = useState([]);
    const [recentTracks, setRecentTracks] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [savedTracks, setSavedTracks] = useState([]);
    const [timeRange, setTimeRange] = useState('medium_term');
    const [activeTab, setActiveTab] = useState('artists');

    // New feature states
    const [lifespanData, setLifespanData] = useState([]);
    const [overplayedTracks, setOverplayedTracks] = useState([]);
    const [rediscoverTracks, setRediscoverTracks] = useState([]);
    const [tasteGravity, setTasteGravity] = useState({});
    const [undergroundArtists, setUndergroundArtists] = useState([]);
    const [libraryHealth, setLibraryHealth] = useState(null);
    const [listeningStats, setListeningStats] = useState(null);

    // Modal States
    const [selectedArtist, setSelectedArtist] = useState(null);
    const [artistDetails, setArtistDetails] = useState(null);
    const [artistDetailsLoading, setArtistDetailsLoading] = useState(false);
    const [artistDetailsError, setArtistDetailsError] = useState(null);

    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [albumDetails, setAlbumDetails] = useState(null);
    const [albumDetailsLoading, setAlbumDetailsLoading] = useState(false);

    const [selectedTrack, setSelectedTrack] = useState(null);
    const [artistSpotlight, setArtistSpotlight] = useState([]);
    const [trackInsightsLoading, setTrackInsightsLoading] = useState(false);
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
            const [artistsData, tracksData, recentData, playlistsData, savedTracksData] = await Promise.all([
                spotifyFetch(`/me/top/artists?limit=50&time_range=${timeRange}`),
                spotifyFetch(`/me/top/tracks?limit=50&time_range=${timeRange}`),
                spotifyFetch(`/me/player/recently-played?limit=50`),
                spotifyFetch(`/me/playlists?limit=50`),
                spotifyFetch(`/me/tracks?limit=50`)
            ]);

            setTopArtists(artistsData.items || []);
            setTopTracks(tracksData.items || []);
            setRecentTracks(recentData.items || []);
            setPlaylists(playlistsData.items || []);
            setSavedTracks(savedTracksData.items || []);

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

            // Calculate insights
            calculateLifespan(recentData.items || []);
            calculateOverplayed(recentData.items || []);
            calculateRediscover(savedTracksData.items || [], recentData.items || []);
            calculateTasteGravity(artistsData.items || []);
            calculateUnderground(artistsData.items || []);
            calculateLibraryHealth(recentData.items || [], tracksData.items || []);
            calculateListeningStats(recentData.items || []);

        } catch (err) {
            console.error(err);
            setError('Failed to load stats. Please reconnect if permission was denied.');
        } finally {
            setLoading(false);
        }
    };

    const calculateLifespan = (recentItems) => {
        const trackPlayDates = {};

        recentItems.forEach(item => {
            const trackId = item.track.id;
            const playedAt = new Date(item.played_at);

            if (!trackPlayDates[trackId]) {
                trackPlayDates[trackId] = {
                    track: item.track,
                    firstPlay: playedAt,
                    lastPlay: playedAt,
                    playCount: 1
                };
            } else {
                trackPlayDates[trackId].playCount++;
                if (playedAt < trackPlayDates[trackId].firstPlay) {
                    trackPlayDates[trackId].firstPlay = playedAt;
                }
                if (playedAt > trackPlayDates[trackId].lastPlay) {
                    trackPlayDates[trackId].lastPlay = playedAt;
                }
            }
        });

        const lifespanArray = Object.values(trackPlayDates).map(data => {
            const lifespan = Math.floor((data.lastPlay - data.firstPlay) / (1000 * 60 * 60 * 24));
            const age = Math.floor((new Date() - data.firstPlay) / (1000 * 60 * 60 * 24));
            return {
                ...data,
                lifespan,
                age,
                isActive: lifespan > 0 && data.playCount > 2
            };
        }).filter(item => item.playCount > 1).sort((a, b) => b.playCount - a.playCount);

        setLifespanData(lifespanArray);
    };

    const calculateOverplayed = (recentItems) => {
        const now = new Date();
        const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000);

        const recentPlays = {};
        recentItems.forEach(item => {
            const playedAt = new Date(item.played_at);
            if (playedAt >= threeDaysAgo) {
                const trackId = item.track.id;
                if (!recentPlays[trackId]) {
                    recentPlays[trackId] = {
                        track: item.track,
                        count: 0
                    };
                }
                recentPlays[trackId].count++;
            }
        });

        const overplayed = Object.values(recentPlays)
            .filter(item => item.count >= 10) // 10+ plays in 3 days
            .sort((a, b) => b.count - a.count);

        setOverplayedTracks(overplayed);
    };

    const calculateRediscover = (savedItems, recentItems) => {
        const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const recentTrackIds = new Set(recentItems.map(item => item.track.id));

        const forgotten = savedItems
            .filter(item => {
                const addedAt = new Date(item.added_at);
                const isOld = addedAt < twoMonthsAgo;
                const notRecentlyPlayed = !recentTrackIds.has(item.track.id);
                return isOld && notRecentlyPlayed;
            })
            .map(item => ({
                ...item.track,
                addedAt: item.added_at,
                monthsSinceAdded: Math.floor((Date.now() - new Date(item.added_at)) / (30 * 24 * 60 * 60 * 1000))
            }))
            .slice(0, 20);

        setRediscoverTracks(forgotten);
    };

    const calculateTasteGravity = (artists) => {
        const genreCounts = {};
        let totalGenres = 0;

        artists.forEach(artist => {
            artist.genres.forEach(genre => {
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                totalGenres++;
            });
        });

        const genreData = Object.entries(genreCounts)
            .map(([genre, count]) => ({
                genre,
                count,
                percentage: ((count / totalGenres) * 100).toFixed(1),
                gravity: count / artists.length
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        setTasteGravity({
            genres: genreData,
            coreGenres: genreData.slice(0, 3),
            totalGenres: Object.keys(genreCounts).length
        });
    };

    const calculateUnderground = (artists) => {
        // Find artists with less than 100k monthly listeners
        const LISTENER_THRESHOLD = 100000;

        const underground = artists
            .filter(artist => artist.followers?.total < LISTENER_THRESHOLD)
            .map(artist => ({
                ...artist,
                listenerCount: artist.followers?.total || 0,
                isHiddenGem: artist.followers?.total < 50000
            }))
            .sort((a, b) => b.popularity - a.popularity)
            .slice(0, 10);

        setUndergroundArtists(underground);
    };

    const calculateLibraryHealth = (recentItems, topTracks) => {
        // Analyze track diversity
        const uniqueArtists = new Set(topTracks.map(t => t.artists[0].id));
        const uniqueAlbums = new Set(topTracks.map(t => t.album.id));

        // Calculate diversity score (0-100)
        const artistDiversity = (uniqueArtists.size / topTracks.length) * 100;
        const albumDiversity = (uniqueAlbums.size / topTracks.length) * 100;

        // Analyze for similar tracks (same artist appearing multiple times)
        const artistCounts = {};
        topTracks.forEach(track => {
            const artistId = track.artists[0].id;
            artistCounts[artistId] = (artistCounts[artistId] || 0) + 1;
        });

        const repeatedArtists = Object.entries(artistCounts)
            .filter(([_, count]) => count > 3)
            .map(([artistId, count]) => {
                const track = topTracks.find(t => t.artists[0].id === artistId);
                return {
                    artist: track.artists[0].name,
                    count
                };
            });

        // Calculate overall health score
        const diversityScore = (artistDiversity + albumDiversity) / 2;
        const repetitionPenalty = Math.min(repeatedArtists.length * 5, 30);
        const healthScore = Math.max(0, Math.min(100, diversityScore - repetitionPenalty));

        // Determine health status
        let status = 'Excellent';
        let statusColor = 'green';
        if (healthScore < 70) {
            status = 'Good';
            statusColor = 'blue';
        }
        if (healthScore < 50) {
            status = 'Needs Variety';
            statusColor = 'yellow';
        }
        if (healthScore < 30) {
            status = 'Too Repetitive';
            statusColor = 'red';
        }

        setLibraryHealth({
            score: Math.round(healthScore),
            status,
            statusColor,
            artistDiversity: Math.round(artistDiversity),
            albumDiversity: Math.round(albumDiversity),
            repeatedArtists,
            totalTracks: topTracks.length,
            uniqueArtists: uniqueArtists.size,
            uniqueAlbums: uniqueAlbums.size
        });
    };

    const calculateListeningStats = (recentItems) => {
        if (recentItems.length === 0) {
            setListeningStats(null);
            return;
        }

        // Get date range from recent plays
        const playDates = recentItems.map(item => new Date(item.played_at));
        const oldestPlay = new Date(Math.min(...playDates));
        const newestPlay = new Date(Math.max(...playDates));

        // Calculate days in range
        const daysDiff = Math.max(1, Math.ceil((newestPlay - oldestPlay) / (1000 * 60 * 60 * 24)));

        // Calculate total minutes (assuming average song is 3 minutes)
        const totalMinutes = recentItems.reduce((sum, item) => {
            const duration = item.track.duration_ms / 1000 / 60; // Convert to minutes
            return sum + duration;
        }, 0);

        // Calculate averages
        const avgMinutesPerDay = totalMinutes / daysDiff;
        const avgStreamsPerDay = recentItems.length / daysDiff;

        // Calculate total hours
        const totalHours = totalMinutes / 60;

        setListeningStats({
            avgMinutesPerDay: Math.round(avgMinutesPerDay),
            avgStreamsPerDay: Math.round(avgStreamsPerDay),
            totalMinutes: Math.round(totalMinutes),
            totalHours: totalHours.toFixed(1),
            totalStreams: recentItems.length,
            daysCovered: daysDiff
        });
    };


    const fetchArtistInsights = async (artist) => {
        setArtistDetailsLoading(true);
        setArtistDetailsError(null);
        setSelectedArtist(artist);
        setArtistDetails(null); // Clear stale data

        // Timeout wrapper to prevent hanging
        const fetchWithTimeout = (promise, timeoutMs = 10000) => {
            return Promise.race([
                promise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
                )
            ]);
        };

        try {
            const results = await Promise.allSettled([
                fetchWithTimeout(spotifyFetch(`/me/following/contains?type=artist&ids=${artist.id}`)),
                fetchWithTimeout(spotifyFetch(`/me/tracks?limit=50`)),
                fetchWithTimeout(spotifyFetch(`/me/tracks?limit=50&offset=50`)),
                fetchWithTimeout(spotifyFetch(`/artists/${artist.id}/related-artists`)),
                fetchWithTimeout(spotifyFetch(`/artists/${artist.id}/top-tracks?market=from_token`))
            ]);

            const followingData = results[0].status === 'fulfilled' ? results[0].value : [false];
            const likedPart1 = results[1].status === 'fulfilled' ? results[1].value : { items: [] };
            const likedPart2 = results[2].status === 'fulfilled' ? results[2].value : { items: [] };
            const relatedData = results[3].status === 'fulfilled' ? results[3].value : { artists: [] };
            const topTracksData = results[4].status === 'fulfilled' ? results[4].value : { tracks: [] };

            const allLiked = [...(likedPart1.items || []), ...(likedPart2.items || [])];
            const artistLiked = allLiked.filter(item =>
                item.track && item.track.artists.some(a => a.id === artist.id)
            );

            const inTop50 = topTracks.filter(track => {
                const artistsList = track.artists || (track.track && track.track.artists) || [];
                return artistsList.some(a => a.id === artist.id);
            });

            // Tiering logic
            let tier = "Rising Artist";
            if (artist.popularity >= 90) tier = "Global Icon";
            else if (artist.popularity >= 80) tier = "Superstar";
            else if (artist.popularity >= 60) tier = "Mainstream";

            setArtistDetails({
                isFollowing: followingData[0],
                likedCount: artistLiked.length,
                topTracksOccurrences: inTop50,
                relatedArtists: (relatedData.artists || []).slice(0, 5),
                globalTopTracks: (topTracksData.tracks || []).slice(0, 5),
                tier
            });
        } catch (err) {
            console.error("Artist insights critical failure:", err);
            // Only show error if we really crashed hard, which shouldn't happen with allSettled
            setArtistDetailsError("Could not load artist stats.");
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

            const enrichment = (tracksData.items || []).map(t => ({
                ...t,
                isTopTrack: topTracks.some(tt => tt.id === t.id),
                album: {
                    id: fullAlbum.id,
                    name: fullAlbum.name,
                    images: fullAlbum.images,
                    release_date: fullAlbum.release_date
                },
                popularity: fullAlbum.popularity
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
        setTrackInsightsLoading(true);
        setSelectedTrack(track);
        // Clear other modals for a clean transition
        setSelectedArtist(null);
        setSelectedAlbum(null);

        setArtistSpotlight([]); // Clear old data
        try {
            const artistId = track.artists[0].id;
            const cleanId = track.id.includes(':') ? track.id.split(':').pop() : track.id;

            const [topTracksData, likedData] = await Promise.all([
                spotifyFetch(`/artists/${artistId}/top-tracks?market=from_token`),
                spotifyFetch(`/me/tracks/contains?ids=${cleanId}`)
            ]);

            if (topTracksData && topTracksData.tracks) {
                setArtistSpotlight(topTracksData.tracks.slice(0, 5));
            }
            setIsTrackLiked(likedData[0]);
        } catch (err) {
            console.error("Track insights failed:", err);
        } finally {
            setTrackInsightsLoading(false);
        }
    };

    const openArtistById = async (id) => {
        try {
            const artist = await spotifyFetch(`/artists/${id}`);
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
            <div className="py-8 animate-apple-in max-w-6xl mx-auto px-4">
                <header className="mb-12">
                    <button onClick={() => navigate('/dashboard')} className="mb-6 flex items-center text-blue-500 font-bold text-sm hover:underline">
                        <ArrowLeft size={16} className="mr-1" /> Dashboard
                    </button>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div>
                            <h1 className="text-5xl font-extrabold tracking-tighter">Your Frequency</h1>
                            <p className="text-gray-500 text-xl font-medium mt-1">Listening health and patterns.</p>
                        </div>

                        <div className="flex gap-1 p-1 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-xl">
                            {[
                                { id: 'short_term', label: 'Month' },
                                { id: 'medium_term', label: '6 Months' },
                                { id: 'long_term', label: 'All Time' }
                            ].map((range) => (
                                <button
                                    key={range.id}
                                    onClick={() => setTimeRange(range.id)}
                                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${timeRange === range.id
                                        ? 'bg-white/10 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {/* Core Stats Overview */}
                {listeningStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                        <div className="apple-card p-6 border-l-4 border-l-blue-500">
                            <div className="flex items-center gap-2 mb-3 text-blue-500">
                                <Clock size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Activity</span>
                            </div>
                            <div className="text-3xl font-black tracking-tighter">{listeningStats.avgMinutesPerDay}m</div>
                            <div className="text-[10px] text-gray-500 font-bold mt-1">DAILY AVERAGE</div>
                        </div>

                        <div className="apple-card p-6 border-l-4 border-l-green-500">
                            <div className="flex items-center gap-2 mb-3 text-green-500">
                                <Activity size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Focus</span>
                            </div>
                            <div className="text-3xl font-black tracking-tighter">{listeningStats.avgStreamsPerDay}</div>
                            <div className="text-[10px] text-gray-500 font-bold mt-1">STREAMS / DAY</div>
                        </div>

                        <div className="apple-card p-6 border-l-4 border-l-purple-500">
                            <div className="flex items-center gap-2 mb-3 text-purple-500">
                                <Music size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Volume</span>
                            </div>
                            <div className="text-3xl font-black tracking-tighter">{listeningStats.totalStreams}</div>
                            <div className="text-[10px] text-gray-500 font-bold mt-1">TOTAL TRACKS</div>
                        </div>

                        <div className="apple-card p-6 border-l-4 border-l-orange-500">
                            <div className="flex items-center gap-2 mb-3 text-orange-500">
                                <Volume2 size={16} />
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Endurance</span>
                            </div>
                            <div className="text-3xl font-black tracking-tighter">{listeningStats.totalHours}h</div>
                            <div className="text-[10px] text-gray-500 font-bold mt-1">LISTEN TIME</div>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide">
                    {[
                        { id: 'artists', label: 'Artists', icon: User },
                        { id: 'tracks', label: 'Songs', icon: Music },
                        { id: 'albums', label: 'Albums', icon: Disc },
                        { id: 'recent', label: 'History', icon: Clock },
                        { id: 'insights', label: 'Profile', icon: Activity },
                        { id: 'rediscover', label: 'Memories', icon: Sparkles }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-blue-500 text-white shadow-lg'
                                : 'bg-white/5 text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="min-h-[400px]">
                    {activeTab === 'recent' && (
                        <section className="animate-apple-in">
                            <div className="apple-card p-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div>
                                    <h3 className="text-2xl font-bold tracking-tight">Recent Sessions</h3>
                                    <p className="text-sm text-gray-500 font-medium">Your activity over the last 50 tracks.</p>
                                </div>
                                <div className="bg-white/5 px-6 py-4 rounded-2xl border border-white/5">
                                    <div className="text-[10px] text-gray-500 uppercase font-black mb-1">Total Listen Time</div>
                                    <div className="text-2xl font-black text-blue-500">{getTotalRecentTime()}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {recentTracks.map((item, index) => (
                                    <div
                                        key={item.played_at + index}
                                        onClick={() => fetchTrackInsights(item.track)}
                                        className="apple-card-interactive p-3 flex items-center gap-4"
                                    >
                                        <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md">
                                            <img src={item.track.album.images[2]?.url} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold truncate text-sm tracking-tight">{item.track.name}</div>
                                            <div className="text-[11px] text-gray-500 font-medium truncate italic opacity-80">{item.track.artists?.[0]?.name || 'Unknown Artist'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {activeTab === 'artists' && (
                        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-apple-in">
                            {topArtists.map((artist) => (
                                <div
                                    key={artist.id}
                                    onClick={() => fetchArtistInsights(artist)}
                                    className="apple-card-interactive p-4 flex items-center gap-5"
                                >
                                    <img src={artist.images[1]?.url} className="w-16 h-16 rounded-full object-cover shadow-lg border border-white/5" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-bold truncate tracking-tight">{artist.name}</h3>
                                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">{artist.genres.slice(0, 1).join('')}</p>
                                        <div className="w-full bg-black/40 h-1 rounded-full overflow-hidden">
                                            <div className="bg-blue-500 h-full" style={{ width: `${artist.popularity}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {activeTab === 'tracks' && (
                        <section className="space-y-2 animate-apple-in">
                            {topTracks.map((track) => (
                                <div
                                    key={track.id}
                                    onClick={() => fetchTrackInsights(track)}
                                    className="apple-card-interactive p-3 flex items-center gap-4"
                                >
                                    <img src={track.album.images[2]?.url} className="w-12 h-12 rounded-xl shadow-md" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-base font-bold truncate tracking-tight">{track.name}</div>
                                        <div className="text-xs text-gray-500 truncate font-medium">{track.artists?.[0]?.name || 'Unknown Artist'}</div>
                                    </div>
                                    <div className="text-[10px] font-mono text-gray-500 bg-white/5 py-1 px-2 rounded-lg">{formatDuration(track.duration_ms)}</div>
                                </div>
                            ))}
                        </section>
                    )}

                    {activeTab === 'albums' && (
                        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-apple-in">
                            {topAlbums.map((album) => (
                                <div
                                    key={album.id}
                                    onClick={() => fetchAlbumInsights(album)}
                                    className="group cursor-pointer"
                                >
                                    <div className="relative aspect-square mb-3 shadow-2xl overflow-hidden rounded-2xl border border-white/5 group-active:scale-95 transition-all">
                                        <img src={album.images[0]?.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <h4 className="font-bold text-xs truncate mb-0.5 tracking-tight group-hover:text-blue-400 transition-colors uppercase">{album.name}</h4>
                                    <p className="text-[10px] text-gray-500 truncate font-medium italic opacity-80">{album.artists[0].name}</p>
                                </div>
                            ))}
                        </section>
                    )}

                    {/* Playlists Tab */}
                    {activeTab === 'playlists' && (
                        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-apple-in">
                            {playlists.map((playlist) => (
                                <div
                                    key={playlist.id}
                                    onClick={() => navigate(`/recommendations/${playlist.id}`)}
                                    className="group cursor-pointer"
                                >
                                    <div className="relative aspect-square mb-3 shadow-2xl overflow-hidden rounded-[24px] border border-white/5 group-active:scale-95 transition-all">
                                        {playlist.images?.[0]?.url ? (
                                            <img src={playlist.images[0].url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                        ) : (
                                            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                                <Music className="w-10 h-10 text-gray-600" />
                                            </div>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-xs truncate mb-0.5 tracking-tight group-hover:text-blue-400 transition-colors uppercase">{playlist.name}</h4>
                                    <p className="text-[10px] text-gray-500 truncate font-medium">{playlist.tracks.total} tracks</p>
                                </div>
                            ))}
                        </section>
                    )}

                    {/* Insights Tab */}
                    {activeTab === 'insights' && (
                        <section className="space-y-8 animate-apple-in">
                            {/* Music Taste Gravity */}
                            <div className="apple-card p-8">
                                <div className="flex items-center gap-3 mb-8">
                                    <Activity className="text-blue-500" size={24} />
                                    <div>
                                        <h3 className="text-2xl font-bold tracking-tight">Audio Profile</h3>
                                        <p className="text-sm text-gray-500 font-medium">Core frequency and sonic consistency.</p>
                                    </div>
                                </div>

                                {tasteGravity.coreGenres?.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <div className="lg:col-span-1 space-y-4">
                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">Top Frequencies</div>
                                            <div className="space-y-2">
                                                {tasteGravity.coreGenres.map((item, i) => (
                                                    <div key={item.genre} className="flex justify-between items-center bg-white/5 px-4 py-3 rounded-xl">
                                                        <span className="text-white font-bold text-sm uppercase">{item.genre}</span>
                                                        <span className="text-blue-500 font-black text-sm">{item.percentage}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="lg:col-span-2">
                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Frequency Map</div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {tasteGravity.genres?.map((item, i) => (
                                                    <div key={item.genre} className="bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-all group">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="font-bold text-[11px] uppercase tracking-wider text-gray-400">{item.genre}</span>
                                                            <span className="text-blue-500 font-black text-sm">{item.percentage}%</span>
                                                        </div>
                                                        <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                                                            <div className="bg-blue-500 h-full transition-all duration-1000 group-hover:scale-x-105 origin-left" style={{ width: `${item.percentage}%` }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-20 bg-white/5 rounded-3xl">
                                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Awaiting more listening data...</p>
                                    </div>
                                )}
                            </div>

                            {/* Song Lifespan Tracker */}
                            <div className="apple-card p-8">
                                <div className="flex items-center gap-3 mb-8">
                                    <Clock className="text-purple-500" size={24} />
                                    <div>
                                        <h3 className="text-2xl font-bold tracking-tight">Sonic Lifespan</h3>
                                        <p className="text-sm text-gray-500 font-medium">Tracking how long tracks stay in your rotation.</p>
                                    </div>
                                </div>

                                {lifespanData.length > 0 ? (
                                    <div className="space-y-3">
                                        {lifespanData.slice(0, 8).map((item) => (
                                            <div key={item.track.id} className="bg-white/5 p-4 rounded-2xl flex items-center gap-4 group hover:bg-white/10 transition-all">
                                                <img src={item.track.album.images[2]?.url} className="w-14 h-14 rounded-lg shadow-lg" alt="" />
                                                <div className="flex items-center gap-4">
                                                    <img src={item.track.album.images[2]?.url} className="w-14 h-14 rounded-lg" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm truncate">{item.track.name}</div>
                                                        <div className="text-xs text-gray-400 truncate">{item.track.artists[0].name}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-gray-500 uppercase font-black mb-1">Age</div>
                                                        <div className="text-lg font-black text-blue-500">{item.age}d</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-gray-500 uppercase font-black mb-1">Plays</div>
                                                        <div className="text-lg font-black text-green-500">{item.playCount}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        <p>Not enough listening history to track lifespans yet.</p>
                                    </div>
                                )}
                            </div>

                            {/* Overplayed Warning */}
                            {overplayedTracks.length > 0 && (
                                <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 p-8 rounded-3xl border border-red-500/30">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Flame className="text-red-500" size={28} />
                                        <div>
                                            <h3 className="text-2xl font-black text-red-400">⚠️ Overplayed Warning</h3>
                                            <p className="text-sm text-gray-400">You're playing these a LOT - take a break before you ruin them!</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {overplayedTracks.map((item) => (
                                            <div key={item.track.id} className="bg-black/40 p-4 rounded-2xl border border-red-500/30 hover:border-red-500/50 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <img src={item.track.album.images[2]?.url} className="w-14 h-14 rounded-lg" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm truncate">{item.track.name}</div>
                                                        <div className="text-xs text-gray-400 truncate">{item.track.artists[0].name}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-red-400 uppercase font-black mb-1">Danger Zone</div>
                                                        <div className="text-2xl font-black text-red-500">{item.count} plays</div>
                                                        <div className="text-[10px] text-gray-500 uppercase">in 3 days</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Underground Radar */}
                            {undergroundArtists.length > 0 && (
                                <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-8 rounded-3xl border border-indigo-500/30">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Sparkles className="text-indigo-400" size={28} />
                                        <div>
                                            <h3 className="text-2xl font-black text-indigo-400">🎯 Underground Radar</h3>
                                            <p className="text-sm text-gray-400">Hidden gems with under 100K followers that match your taste</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {undergroundArtists.map((artist) => (
                                            <div
                                                key={artist.id}
                                                onClick={() => fetchArtistInsights(artist)}
                                                className="bg-black/40 p-4 rounded-2xl border border-indigo-500/30 hover:border-indigo-500/50 transition-all cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <img src={artist.images[1]?.url} className="w-16 h-16 rounded-full shadow-lg" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm truncate group-hover:text-indigo-400 transition-colors">
                                                            {artist.name}
                                                            {artist.isHiddenGem && <span className="ml-2 text-yellow-400">💎</span>}
                                                        </div>
                                                        <div className="text-xs text-gray-400 truncate">{artist.genres.slice(0, 2).join(', ')}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-indigo-400 uppercase font-black mb-1">Followers</div>
                                                        <div className="text-lg font-black text-indigo-300">
                                                            {artist.listenerCount >= 1000
                                                                ? (artist.listenerCount / 1000).toFixed(1) + 'K'
                                                                : artist.listenerCount}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Library Health Score */}
                            {libraryHealth && (
                                <div className="bg-[#181818] p-8 rounded-3xl border border-neutral-800">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Activity className="text-cyan-500" size={28} />
                                        <div>
                                            <h3 className="text-2xl font-black">📊 Library Health Score</h3>
                                            <p className="text-sm text-gray-400">Analysis of your listening diversity</p>
                                        </div>
                                    </div>

                                    {/* Overall Score */}
                                    <div className="mb-8 p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/20 text-center">
                                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Overall Health</div>
                                        <div className={`text-4xl md:text-6xl font-black mb-2 ${libraryHealth.statusColor === 'green' ? 'text-green-500' :
                                            libraryHealth.statusColor === 'blue' ? 'text-blue-500' :
                                                libraryHealth.statusColor === 'yellow' ? 'text-yellow-500' :
                                                    'text-red-500'
                                            }`}>
                                            {libraryHealth.score}
                                        </div>
                                        <div className={`text-lg font-black uppercase tracking-wider ${libraryHealth.statusColor === 'green' ? 'text-green-400' :
                                            libraryHealth.statusColor === 'blue' ? 'text-blue-400' :
                                                libraryHealth.statusColor === 'yellow' ? 'text-yellow-400' :
                                                    'text-red-400'
                                            }`}>
                                            {libraryHealth.status}
                                        </div>
                                    </div>

                                    {/* Diversity Metrics */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                        <div className="bg-[#121212] p-6 rounded-2xl border border-neutral-800">
                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Artist Diversity</div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-2xl font-black text-cyan-500">{libraryHealth.artistDiversity}%</span>
                                                <span className="text-xs text-gray-500">{libraryHealth.uniqueArtists}/{libraryHealth.totalTracks} unique</span>
                                            </div>
                                            <div className="w-full bg-black h-2 rounded-full overflow-hidden">
                                                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-1000" style={{ width: `${libraryHealth.artistDiversity}%` }} />
                                            </div>
                                        </div>

                                        <div className="bg-[#121212] p-6 rounded-2xl border border-neutral-800">
                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Album Diversity</div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-2xl font-black text-purple-500">{libraryHealth.albumDiversity}%</span>
                                                <span className="text-xs text-gray-500">{libraryHealth.uniqueAlbums}/{libraryHealth.totalTracks} unique</span>
                                            </div>
                                            <div className="w-full bg-black h-2 rounded-full overflow-hidden">
                                                <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-1000" style={{ width: `${libraryHealth.albumDiversity}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Repeated Artists Warning */}
                                    {libraryHealth.repeatedArtists.length > 0 && (
                                        <div className="bg-yellow-500/10 p-6 rounded-2xl border border-yellow-500/30">
                                            <div className="flex items-center gap-2 mb-4">
                                                <Flame className="text-yellow-500" size={20} />
                                                <h4 className="text-sm font-black text-yellow-400 uppercase tracking-wider">Too Many Similar Tracks</h4>
                                            </div>
                                            <div className="space-y-2">
                                                {libraryHealth.repeatedArtists.map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between text-sm">
                                                        <span className="text-gray-300 font-bold">{item.artist}</span>
                                                        <span className="text-yellow-500 font-black">{item.count} tracks in top 50</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-4">💡 Try exploring more artists to improve diversity!</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}

                </div>

                {/* Rediscover Tab */}
                {activeTab === 'rediscover' && (
                    <section className="animate-apple-in">
                        <div className="apple-glass p-10 rounded-[40px] mb-8 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6">
                                <Sparkles className="text-purple-400" size={32} />
                            </div>
                            <h3 className="text-3xl font-extrabold tracking-tighter mb-2">Memories</h3>
                            <p className="text-gray-500 font-medium">Rediscover the sounds that shaped your past.</p>
                        </div>

                        {rediscoverTracks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {rediscoverTracks.map((track) => (
                                    <div
                                        key={track.id}
                                        onClick={() => fetchTrackInsights(track)}
                                        className="apple-card-interactive p-4 flex items-center gap-4 group"
                                    >
                                        <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg">
                                            <img src={track.album.images[2]?.url} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm truncate tracking-tight group-hover:text-purple-400 transition-colors">{track.name}</div>
                                            <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">
                                                Added {track.monthsSinceAdded} months ago
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center apple-glass rounded-[40px]">
                                <p className="text-gray-500 font-bold">Your memory is perfect. No forgotten tracks found.</p>
                            </div>
                        )}
                    </section>
                )}
            </div>
            {/* Artist Modal */}
            {selectedArtist && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-2xl animate-fade-in" onClick={() => setSelectedArtist(null)}>
                    <div className="bg-[#1c1c1e] w-full max-w-2xl max-h-[90vh] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl animate-apple-in flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="relative h-64 shrink-0">
                            <img src={selectedArtist.images[0]?.url} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#1c1c1e] via-transparent" />
                            <button onClick={() => setSelectedArtist(null)} className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition-colors border border-white/10">
                                <X size={20} />
                            </button>
                            <div className="absolute bottom-6 left-8">
                                <h2 className="text-4xl font-bold tracking-tighter mb-2">{selectedArtist.name}</h2>
                                <div className="flex gap-2">
                                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-400/30">Verified</span>
                                    <span className="bg-white/10 text-white/70 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">{selectedArtist.genres[0]}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-10">
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Fanbase</div>
                                    <div className="text-xl font-bold">{(selectedArtist.followers.total / 1000000).toFixed(1)}M</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Pop Index</div>
                                    <div className="text-xl font-bold">{selectedArtist.popularity}%</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Saves</div>
                                    <div className="text-xl font-bold">{artistDetails?.likedCount || 0}</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl text-center border border-white/5">
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Status</div>
                                    <div className="text-xl font-bold text-blue-500">{artistDetails?.tier?.split(' ')[0]}</div>
                                </div>
                            </div>

                            <section>
                                <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-4 border-b border-white/5 pb-2">Global Spotlight</h3>
                                <div className="space-y-2">
                                    {artistDetails?.globalTopTracks?.map((t, i) => (
                                        <div key={t.id} onClick={() => fetchTrackInsights(t)} className="apple-card-interactive p-2 px-4 flex items-center gap-4 text-left">
                                            <span className="text-[10px] font-mono text-gray-500 w-4">{i + 1}</span>
                                            <img src={t.album.images[2]?.url} className="w-10 h-10 rounded-lg" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold truncate tracking-tight">{t.name}</div>
                                                <div className="text-[10px] text-gray-500 font-medium">Global Heat: {t.popularity}%</div>
                                            </div>
                                            <ArrowLeft size={14} className="rotate-180 opacity-20" />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}

            {/* Album Modal */}
            {selectedAlbum && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xl animate-fade-in" onClick={() => setSelectedAlbum(null)}>
                    <div className="bg-[#1c1c1e] w-full max-w-3xl max-h-[85vh] rounded-[40px] border border-white/10 overflow-hidden shadow-2xl animate-apple-in flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
                        <div className="w-full md:w-[45%] relative">
                            <img src={selectedAlbum.images[0]?.url} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/60 to-transparent" />
                            <div className="absolute bottom-8 left-8 right-8">
                                <h2 className="text-3xl font-bold tracking-tighter mb-1 leading-tight">{selectedAlbum.name}</h2>
                                <p className="text-blue-500 font-bold text-sm tracking-tight mb-4">{selectedAlbum.artists[0].name}</p>
                                <div className="flex gap-4 text-[10px] font-black text-white/40 uppercase tracking-widest">
                                    <span>{new Date(selectedAlbum.release_date).getFullYear()}</span>
                                    <span>{albumDetails?.tracks?.length} Tracks</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 p-8 flex flex-col min-h-0 bg-[#1c1c1e]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Tracklist</h3>
                                <button onClick={() => setSelectedAlbum(null)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                                {albumDetailsLoading ? (
                                    <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
                                ) : (
                                    albumDetails?.tracks?.map((t, i) => (
                                        <div key={t.id} onClick={() => fetchTrackInsights(t)} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all group cursor-pointer">
                                            <span className="text-[10px] font-mono text-gray-500 w-4">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-bold truncate ${t.isTopTrack ? 'text-blue-400' : 'text-gray-300'} group-hover:text-blue-400 transition-colors`}>{t.name}</div>
                                            </div>
                                            <span className="text-[10px] font-mono text-gray-500">{formatDuration(t.duration_ms)}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Track Modal */}
            {selectedTrack && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xl animate-fade-in" onClick={() => setSelectedTrack(null)}>
                    <div className="bg-[#1c1c1e] w-full max-w-xl rounded-[40px] border border-white/10 overflow-hidden shadow-2xl animate-apple-in" onClick={e => e.stopPropagation()}>
                        <div className="p-10">
                            <div className="flex items-center gap-8 mb-10">
                                <div className="relative group">
                                    <img src={selectedTrack.album?.images[0]?.url || selectedAlbum?.images[0]?.url} className="w-40 h-40 rounded-3xl shadow-2xl group-active:scale-95 transition-transform cursor-pointer" alt="" />
                                    <div className="absolute inset-0 bg-black/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-400/20 inline-block mb-4">Song Detail</div>
                                    <h2 className="text-3xl font-bold tracking-tighter mb-1 truncate">{selectedTrack.name}</h2>
                                    <p className="text-xl text-gray-400 font-bold mb-4">{selectedTrack.artists?.[0]?.name || 'Unknown Artist'}</p>
                                    <div className="flex gap-2">
                                        {isTrackLiked && <div className="p-2.5 rounded-2xl bg-white/5 text-pink-500 border border-white/10"><Heart size={20} fill="currentColor" /></div>}
                                        <div className="flex-1 bg-white/5 p-2 px-4 rounded-2xl border border-white/10 flex items-center justify-between">
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pop Status</span>
                                            <span className="text-lg font-black">{selectedTrack.popularity}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 border-b border-white/5 pb-2">Track Metrics</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white/5 p-5 rounded-3xl text-center border border-white/5">
                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 opacity-60">Global Power</div>
                                            <div className="text-3xl font-black text-blue-500">{selectedTrack.popularity}%</div>
                                        </div>
                                        <div className="bg-white/5 p-5 rounded-3xl text-center border border-white/5">
                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1 opacity-60">Reach</div>
                                            <div className="text-3xl font-black text-green-500">{(selectedTrack.popularity * 0.8).toFixed(0)}</div>
                                        </div>
                                    </div>
                                </section>

                                <button onClick={() => setSelectedTrack(null)} className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95 shadow-xl mt-4">
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Stats;
