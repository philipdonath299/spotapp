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
        <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 relative">
            <div className="py-12  max-w-6xl mx-auto px-4">
                <header className="mb-20">
                    <button onClick={() => navigate('/dashboard')} className="mb-10 flex items-center text-blue-500 font-black text-[10px] uppercase tracking-widest hover:text-blue-400 transition-colors">
                        <ArrowLeft size={16} className="mr-2" /> Dashboard
                    </button>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 ml-1">Music Insights</p>
                            <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-white">
                                Stats
                            </h1>
                        </div>

                        <div className="ios26-tabs flex p-1.5 shadow-2xl">
                            {[
                                { id: 'short_term', label: 'MONTH' },
                                { id: 'medium_term', label: '6 MONTHS' },
                                { id: 'long_term', label: 'TOTAL' }
                            ].map((range) => (
                                <button
                                    key={range.id}
                                    onClick={() => setTimeRange(range.id)}
                                    className={`px-6 py-2 rounded-[18px] text-[10px] font-black transition-all duration-500 tracking-widest ${timeRange === range.id
                                        ? 'bg-white text-black scale-105 shadow-xl'
                                        : 'text-white/40 hover:text-white/80'
                                        }`}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {/* iOS 26 Stats Grid */}
                {listeningStats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-20">
                        <div className="ios26-card p-5 md:p-8 group relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 blur-[50px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
                            <div className="flex items-center gap-3 mb-6">
                                <Clock size={18} className="text-blue-500" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 group-hover:text-blue-500 transition-colors">Activity</span>
                            </div>
                            <div className="text-4xl md:text-5xl font-black tracking-tighter text-white">{listeningStats.avgMinutesPerDay}m</div>
                            <div className="text-[9px] text-white/10 font-black tracking-widest mt-2 uppercase">Daily Listening</div>
                        </div>

                        <div className="ios26-card p-5 md:p-8 group relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-24 h-24 bg-green-500/10 blur-[50px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
                            <div className="flex items-center gap-3 mb-6">
                                <Activity size={18} className="text-green-500" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 group-hover:text-green-500 transition-colors">Daily</span>
                            </div>
                            <div className="text-4xl md:text-5xl font-black tracking-tighter text-white">{listeningStats.avgStreamsPerDay}</div>
                            <div className="text-[9px] text-white/10 font-black tracking-widest mt-2 uppercase">Songs per Day</div>
                        </div>

                        <div className="ios26-card p-5 md:p-8 group relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/10 blur-[50px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
                            <div className="flex items-center gap-3 mb-6">
                                <Music size={18} className="text-purple-500" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 group-hover:text-purple-500 transition-colors">Volume</span>
                            </div>
                            <div className="text-4xl md:text-5xl font-black tracking-tighter text-white">{listeningStats.totalStreams}</div>
                            <div className="text-[9px] text-white/10 font-black tracking-widest mt-2 uppercase">Total Songs</div>
                        </div>

                        <div className="ios26-card p-5 md:p-8 group relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-24 h-24 bg-orange-500/10 blur-[50px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
                            <div className="flex items-center gap-3 mb-6">
                                <Volume2 size={18} className="text-orange-500" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 group-hover:text-orange-500 transition-colors">Index</span>
                            </div>
                            <div className="text-4xl md:text-5xl font-black tracking-tighter text-white">{listeningStats.totalHours}h</div>
                            <div className="text-[9px] text-white/10 font-black tracking-widest mt-2 uppercase">Total Listening</div>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-center gap-2 mb-16 overflow-x-auto pb-4 no-scrollbar">
                    <div className="ios26-tabs flex p-1.5 shadow-2xl">
                        {[
                            { id: 'artists', label: 'ARTISTS', icon: User },
                            { id: 'tracks', label: 'SONGS', icon: Music },
                            { id: 'albums', label: 'ALBUMS', icon: Disc },
                            { id: 'insights', label: 'SELF', icon: Activity },
                            { id: 'recent', label: 'PAST', icon: Clock }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-1.5 px-4 md:px-6 py-2 rounded-[16px] md:rounded-[18px] text-[9px] md:text-[10px] font-black transition-all duration-500 tracking-widest whitespace-nowrap ios26-haptic-light ${activeTab === tab.id
                                    ? 'bg-white text-black scale-105 shadow-xl'
                                    : 'text-white/30 hover:text-white/80'
                                    }`}
                            >
                                <tab.icon size={14} className={activeTab === tab.id ? 'text-black' : 'text-white/40'} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="min-h-[400px]">
                    {activeTab === 'recent' && (
                        <section className="">
                            <div className="ios26-card p-10 mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden">
                                <div className="absolute inset-0 bg-blue-500/5 blur-[100px] -z-10" />
                                <div>
                                    <h3 className="text-4xl font-black tracking-tighter uppercase mb-2">History</h3>
                                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Recent playback analytics</p>
                                </div>
                                <div className="ios26-liquid px-8 py-5 rounded-[32px] border border-white/10 shadow-2xl">
                                    <div className="text-[9px] text-white/40 uppercase font-black tracking-widest mb-1">Rotation Time</div>
                                    <div className="text-3xl font-black text-blue-500 tracking-tighter">{getTotalRecentTime()}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {recentTracks.map((item, index) => (
                                    <div
                                        key={item.played_at + index}
                                        onClick={() => fetchTrackInsights(item.track)}
                                        className="ios26-card-interactive p-4 flex items-center gap-5"
                                    >
                                        <div className="w-16 h-16 rounded-[22px] overflow-hidden shadow-2xl ring-1 ring-white/10">
                                            <img src={item.track.album.images[1]?.url} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-700" alt="" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-black truncate text-sm tracking-tighter uppercase group-hover:text-blue-500 transition-colors">{item.track.name}</div>
                                            <div className="text-[10px] text-white/30 font-black uppercase tracking-widest truncate">{item.track.artists?.[0]?.name || 'Unknown Artist'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {activeTab === 'artists' && (
                        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ">
                            {topArtists.map((artist) => (
                                <div
                                    key={artist.id}
                                    onClick={() => fetchArtistInsights(artist)}
                                    className="ios26-card-interactive p-6 flex items-center gap-6"
                                >
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-0 group-hover:scale-100 transition-transform duration-700" />
                                        <img src={artist.images[1]?.url} className="w-20 h-20 rounded-full object-cover shadow-2xl relative z-10 border-2 border-white/5 group-hover:border-blue-500/50 transition-all duration-700" alt="" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xl font-black truncate tracking-tighter uppercase mb-1">{artist.name}</h3>
                                        <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-4">{artist.genres.slice(0, 1).join('')}</p>
                                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                            <div className="bg-blue-500 h-full transition-all duration-1000 group-hover:bg-blue-400" style={{ width: `${artist.popularity}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {activeTab === 'tracks' && (
                        <section className="space-y-3 ">
                            {topTracks.map((track) => (
                                <div
                                    key={track.id}
                                    onClick={() => fetchTrackInsights(track)}
                                    className="ios26-card-interactive p-4 flex items-center gap-6 group"
                                >
                                    <div className="w-16 h-16 rounded-[24px] overflow-hidden shadow-2xl ring-1 ring-white/10 group-hover:scale-110 transition-transform duration-700">
                                        <img src={track.album.images[1]?.url} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" alt="" />
                                    </div>
                                    <div className="flex-1 min-w-0 transition-transform duration-500 group-hover:translate-x-1">
                                        <div className="text-lg font-black truncate tracking-tighter uppercase group-hover:text-blue-500 transition-colors">{track.name}</div>
                                        <div className="text-[10px] text-white/30 font-black uppercase tracking-widest">{track.artists?.[0]?.name || 'Unknown Artist'}</div>
                                    </div>
                                    <div className="text-[10px] font-black tracking-widest text-white/20 group-hover:text-blue-500 transition-colors uppercase border border-white/5 group-hover:border-blue-500/30 px-3 py-1.5 rounded-full">{formatDuration(track.duration_ms)}</div>
                                </div>
                            ))}
                        </section>
                    )}

                    {activeTab === 'albums' && (
                        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 ">
                            {topAlbums.map((album) => (
                                <div
                                    key={album.id}
                                    onClick={() => fetchAlbumInsights(album)}
                                    className="group cursor-pointer"
                                >
                                    <div className="relative aspect-square mb-5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden rounded-[40px] border border-white/5 active:scale-95 transition-all duration-700">
                                        <img src={album.images[0]?.url} className="w-full h-full object-cover grayscale-[0.4] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt="" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                    </div>
                                    <div className="px-2 transition-transform duration-500 group-hover:translate-x-1">
                                        <h4 className="font-black text-sm truncate mb-1 tracking-tighter uppercase group-hover:text-blue-500 transition-colors">{album.name}</h4>
                                        <p className="text-[9px] text-white/30 font-black uppercase tracking-widest truncate">{album.artists[0].name}</p>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {/* Playlists Tab */}
                    {activeTab === 'playlists' && (
                        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 ">
                            {playlists.map((playlist) => (
                                <div
                                    key={playlist.id}
                                    onClick={() => navigate(`/recommendations/${playlist.id}`)}
                                    className="group cursor-pointer"
                                >
                                    <div className="relative aspect-square mb-5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] overflow-hidden rounded-[56px] border border-white/5 group-active:scale-95 transition-all duration-700">
                                        {playlist.images?.[0]?.url ? (
                                            <img src={playlist.images[0].url} className="w-full h-full object-cover grayscale-[0.4] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt="" />
                                        ) : (
                                            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                                <Music className="w-10 h-10 text-white/10" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all duration-700 flex items-center justify-center backdrop-blur-md">
                                            <div className="w-16 h-16 rounded-full ios26-liquid flex items-center justify-center border border-white/20 shadow-2xl scale-50 group-hover:scale-100 transition-transform duration-700">
                                                <PlaySquare fill="white" size={24} className="ml-0.5" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-2 transition-transform duration-500 group-hover:translate-x-1">
                                        <h4 className="font-black text-sm truncate mb-1 tracking-tighter uppercase group-hover:text-blue-500 transition-colors">{playlist.name}</h4>
                                        <p className="text-[9px] text-white/30 font-black uppercase tracking-widest truncate">{playlist.tracks.total} units</p>
                                    </div>
                                </div>
                            ))}
                        </section>
                    )}

                    {/* Insights Tab */}
                    {activeTab === 'insights' && (
                        <section className="space-y-12 ">
                            {/* Music Taste Gravity */}
                            <div className="ios26-card p-12 relative overflow-hidden">
                                <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full -z-10" />
                                <div className="flex items-center gap-4 mb-12">
                                    <div className="w-12 h-12 rounded-2xl ios26-liquid flex items-center justify-center">
                                        <Activity className="text-blue-500" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-4xl font-black tracking-tighter uppercase mb-2">Neural Profile</h3>
                                        <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Acoustic frequency and sonic consistency</p>
                                    </div>
                                </div>

                                {tasteGravity.coreGenres?.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                                        <div className="lg:col-span-1 space-y-4">
                                            <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 border-b border-white/5 pb-2">Core Frequencies</div>
                                            <div className="space-y-3">
                                                {tasteGravity.coreGenres.map((item, i) => (
                                                    <div key={item.genre} className="flex justify-between items-center ios26-glass px-6 py-4 rounded-2xl group hover:bg-white/10 transition-all duration-500">
                                                        <span className="text-white font-black text-xs uppercase tracking-tight">{item.genre}</span>
                                                        <span className="text-blue-500 font-black text-sm tracking-tighter">{item.percentage}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="lg:col-span-2">
                                            <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-6 border-b border-white/5 pb-2">Atmospheric Density</div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {tasteGravity.genres?.map((item, i) => (
                                                    <div key={item.genre} className="ios26-glass p-5 rounded-3xl hover:bg-white/[0.04] transition-all duration-500 group">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <span className="font-black text-[9px] uppercase tracking-[0.2em] text-white/40 group-hover:text-white/60 transition-colors">{item.genre}</span>
                                                            <span className="text-blue-500 font-black text-xs tracking-tighter">{item.percentage}%</span>
                                                        </div>
                                                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                                            <div className="bg-blue-500 h-full transition-all duration-1000 group-hover:bg-blue-400 group-hover:scale-x-105 origin-left" style={{ width: `${item.percentage}%` }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-24 ios26-glass rounded-3xl">
                                        <p className="text-white/20 font-black uppercase tracking-[0.3em] text-[10px]">Awaiting further telemetry...</p>
                                    </div>
                                )}
                            </div>

                            {/* Song Lifespan Tracker */}
                            <div className="ios26-card p-12 relative overflow-hidden">
                                <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full -z-10" />
                                <div className="flex items-center gap-4 mb-12">
                                    <div className="w-12 h-12 rounded-2xl ios26-liquid flex items-center justify-center">
                                        <Clock className="text-purple-500" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-4xl font-black tracking-tighter uppercase mb-2">Sonic Aging</h3>
                                        <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Telemetric analysis of track retention</p>
                                    </div>
                                </div>

                                {lifespanData.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {lifespanData.slice(0, 10).map((item) => (
                                            <div key={item.track.id} className="ios26-glass p-5 rounded-3xl flex items-center gap-6 group hover:bg-white/[0.04] transition-all duration-500">
                                                <div className="w-16 h-16 rounded-[22px] overflow-hidden shadow-2xl ring-1 ring-white/10 group-hover:scale-110 transition-all duration-700">
                                                    <img src={item.track.album.images[1]?.url} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all" alt="" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-black text-sm truncate tracking-tighter uppercase group-hover:text-purple-500 transition-colors">{item.track.name}</div>
                                                    <div className="text-[9px] text-white/30 font-black uppercase tracking-widest truncate">{item.track.artists[0].name}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[8px] text-white/20 uppercase font-black tracking-widest mb-1">Index</div>
                                                    <div className="text-xl font-black text-purple-500 tracking-tighter group-hover:scale-110 transition-transform">{item.age}d</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-24 ios26-glass rounded-3xl">
                                        <p className="text-white/20 font-black uppercase tracking-[0.3em] text-[10px]">Processing temporal data...</p>
                                    </div>
                                )}
                            </div>

                            {/* Overplayed Warning */}
                            {overplayedTracks.length > 0 && (
                                <div className="ios26-card p-10 relative overflow-hidden group border-red-500/20">
                                    <div className="absolute -top-20 -right-20 w-80 h-80 bg-red-500/5 blur-[100px] rounded-full -z-10 group-hover:scale-110 transition-transform duration-1000" />
                                    <div className="flex items-center gap-4 mb-10">
                                        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                            <Flame className="text-red-500" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-4xl font-black tracking-tighter uppercase text-red-500 mb-1">Rotation Decay</h3>
                                            <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Acoustic saturation threshold exceeded</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {overplayedTracks.map((item) => (
                                            <div key={item.track.id} className="ios26-glass p-5 rounded-3xl border border-red-500/10 hover:border-red-500/30 transition-all duration-500 group">
                                                <div className="flex items-center gap-6">
                                                    <div className="w-16 h-16 rounded-[22px] overflow-hidden shadow-2xl ring-1 ring-white/10 group-hover:scale-110 transition-all duration-700">
                                                        <img src={item.track.album.images[1]?.url} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all" alt="" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-black text-sm truncate tracking-tighter uppercase text-white group-hover:text-red-500 transition-colors">{item.track.name}</div>
                                                        <div className="text-[9px] text-white/30 font-black uppercase tracking-widest truncate">{item.track.artists[0].name}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[8px] text-red-500/40 uppercase font-black tracking-widest mb-1">Density</div>
                                                        <div className="text-2xl font-black text-red-500 tracking-tighter">{item.count}</div>
                                                        <div className="text-[9px] text-white/10 uppercase font-black tracking-widest">Cycles / 72h</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Underground Radar */}
                            {undergroundArtists.length > 0 && (
                                <div className="ios26-card p-10 relative overflow-hidden group border-indigo-500/20">
                                    <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-500/5 blur-[100px] rounded-full -z-10 group-hover:scale-110 transition-transform duration-1000" />
                                    <div className="flex items-center gap-4 mb-10">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                            <Sparkles className="text-indigo-400" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-4xl font-black tracking-tighter uppercase text-indigo-400 mb-1">Underground</h3>
                                            <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Low-frequency high-potential signals</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {undergroundArtists.map((artist) => (
                                            <div
                                                key={artist.id}
                                                onClick={() => fetchArtistInsights(artist)}
                                                className="ios26-glass p-5 rounded-3xl border border-indigo-500/10 hover:border-indigo-500/30 transition-all duration-500 cursor-pointer group"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <img src={artist.images[1]?.url} className="w-16 h-16 rounded-full object-cover shadow-2xl border border-white/5 opacity-80 group-hover:opacity-100 transition-all group-hover:scale-105" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-black text-sm truncate tracking-tighter uppercase text-white group-hover:text-indigo-400 transition-colors">
                                                            {artist.name}
                                                            {artist.isHiddenGem && <span className="ml-2">💎</span>}
                                                        </div>
                                                        <div className="text-[9px] text-white/30 font-black uppercase tracking-widest truncate">{artist.genres.slice(0, 1).join('')}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[8px] text-indigo-400/40 uppercase font-black tracking-widest mb-1">Impact</div>
                                                        <div className="text-xl font-black text-indigo-300 tracking-tighter">
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
                                <div className="ios26-card p-10 relative overflow-hidden group border-cyan-500/20">
                                    <div className="absolute inset-0 bg-cyan-500/[0.02] -z-10" />
                                    <div className="flex items-center gap-4 mb-10">
                                        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                                            <Activity className="text-cyan-500" size={24} />
                                        </div>
                                        <div>
                                            <h3 className="text-4xl font-black tracking-tighter uppercase text-white mb-1">Integrity</h3>
                                            <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Systemic efficiency and signal diversity</p>
                                        </div>
                                    </div>

                                    {/* Overall Score */}
                                    <div className="mb-12 p-10 ios26-liquid rounded-[40px] border border-white/10 text-center shadow-2xl relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-cyan-500/[0.03] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                        <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em] mb-6 relative z-10">Total Efficiency Score</div>
                                        <div className={`text-7xl md:text-9xl font-black mb-4 tracking-tighter relative z-10 drop-shadow-2xl transition-transform duration-1000 group-hover:scale-105 ${libraryHealth.statusColor === 'green' ? 'text-green-500' :
                                            libraryHealth.statusColor === 'blue' ? 'text-cyan-500' :
                                                libraryHealth.statusColor === 'yellow' ? 'text-yellow-500' :
                                                    'text-red-500'
                                            }`}>
                                            {libraryHealth.score}
                                        </div>
                                        <div className={`text-xl font-black uppercase tracking-[0.3em] relative z-10 ${libraryHealth.statusColor === 'green' ? 'text-green-400' :
                                            libraryHealth.statusColor === 'blue' ? 'text-cyan-400' :
                                                libraryHealth.statusColor === 'yellow' ? 'text-yellow-400' :
                                                    'text-red-400'
                                            }`}>
                                            {libraryHealth.status}
                                        </div>
                                    </div>

                                    {/* Diversity Metrics */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                        <div className="ios26-glass p-8 rounded-[32px] border border-white/5 hover:bg-white/[0.04] transition-all duration-500">
                                            <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Artist Frequency</div>
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-4xl font-black text-cyan-500 tracking-tighter">{libraryHealth.artistDiversity}%</span>
                                                <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">{libraryHealth.uniqueArtists} / {libraryHealth.totalTracks}</span>
                                            </div>
                                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-1000 scale-x-105 origin-left" style={{ width: `${libraryHealth.artistDiversity}%` }} />
                                            </div>
                                        </div>

                                        <div className="ios26-glass p-8 rounded-[32px] border border-white/5 hover:bg-white/[0.04] transition-all duration-500">
                                            <div className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Album Density</div>
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-4xl font-black text-purple-500 tracking-tighter">{libraryHealth.albumDiversity}%</span>
                                                <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">{libraryHealth.uniqueAlbums} / {libraryHealth.totalTracks}</span>
                                            </div>
                                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                                                <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-1000 scale-x-105 origin-left" style={{ width: `${libraryHealth.albumDiversity}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Repeated Artists Warning */}
                                    {libraryHealth.repeatedArtists.length > 0 && (
                                        <div className="ios26-glass p-8 rounded-[32px] border border-yellow-500/20 bg-yellow-500/[0.02]">
                                            <div className="flex items-center gap-3 mb-6">
                                                <Flame className="text-yellow-500" size={20} />
                                                <h4 className="font-black text-[10px] text-yellow-500 uppercase tracking-[0.3em]">Redundancy Detected</h4>
                                            </div>
                                            <div className="space-y-3">
                                                {libraryHealth.repeatedArtists.map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between ios26-glass px-5 py-3 rounded-2xl">
                                                        <span className="text-white font-black text-xs uppercase tracking-tight">{item.artist}</span>
                                                        <span className="text-yellow-500 font-black text-sm tracking-tighter">{item.count} units</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-[9px] text-white/20 font-black uppercase tracking-widest mt-6 text-center">Protocol: Increase sonic variation</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}

                </div>

                {/* Rediscover Tab */}
                {activeTab === 'rediscover' && (
                    <section className="">
                        <div className="ios26-card p-12 rounded-[56px] mb-10 flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-purple-500/5 blur-[100px] -z-10" />
                            <div className="w-20 h-20 ios26-liquid rounded-[28px] flex items-center justify-center mb-8 border border-white/20 shadow-2xl">
                                <Sparkles className="text-purple-400" size={32} />
                            </div>
                            <h3 className="text-4xl font-black tracking-tighter uppercase mb-2 text-white">Archives</h3>
                            <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">Resonant frequencies from your temporal history</p>
                        </div>

                        {rediscoverTracks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {rediscoverTracks.map((track) => (
                                    <div
                                        key={track.id}
                                        onClick={() => fetchTrackInsights(track)}
                                        className="ios26-card-interactive p-4 flex items-center gap-6"
                                    >
                                        <div className="w-16 h-16 rounded-[24px] overflow-hidden shadow-2xl ring-1 ring-white/10 group-hover:scale-110 transition-transform duration-700">
                                            <img src={track.album.images[1]?.url} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" alt="" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-black text-sm truncate tracking-tighter uppercase group-hover:text-purple-500 transition-colors">{track.name}</div>
                                            <div className="text-[9px] text-white/30 font-black uppercase tracking-widest mt-1">
                                                Active {track.monthsSinceAdded}m ago
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-24 text-center ios26-glass rounded-[56px] border border-white/5">
                                <p className="text-white/20 font-black uppercase tracking-[0.3em] text-[10px]">No dormant signals detected...</p>
                            </div>
                        )}
                    </section>
                )}
            </div>

            {/* Modals - Spatial iOS 26 Redesign */}
            {selectedArtist && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-3xl" onClick={() => setSelectedArtist(null)}>
                    <div
                        className="ios26-liquid w-full max-w-2xl max-h-[90vh] rounded-[48px] border border-white/20 overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,1)]  flex flex-col relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="relative h-80 shrink-0">
                            <img src={selectedArtist.images[0]?.url} className="w-full h-full object-cover grayscale-[0.2]" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/20 to-transparent" />
                            <button onClick={() => setSelectedArtist(null)} className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/10 backdrop-blur-2xl flex items-center justify-center text-white/80 hover:text-white transition-all border border-white/20 hover:scale-110 active:scale-95 shadow-2xl">
                                <X size={24} />
                            </button>
                            <div className="absolute bottom-10 left-10 right-10">
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 mb-3 ml-1">Artist Profile</p>
                                <h2 className="text-5xl md:text-6xl font-black tracking-tighter mb-4 text-white leading-none">{selectedArtist.name}</h2>
                                <div className="flex flex-wrap gap-3">
                                    <span className="bg-white/10 text-white font-black px-4 py-1.5 rounded-full text-[9px] uppercase tracking-widest border border-white/10 backdrop-blur-xl">
                                        {selectedArtist.genres[0]}
                                    </span>
                                    <span className="bg-blue-500 text-white font-black px-4 py-1.5 rounded-full text-[9px] uppercase tracking-widest border border-blue-400/30">
                                        Verified
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-10 overflow-y-auto no-scrollbar flex-1 space-y-12">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Followers', value: `${(selectedArtist.followers.total / 1000000).toFixed(1)}M`, color: 'text-white' },
                                    { label: 'Popularity', value: `${selectedArtist.popularity}%`, color: 'text-blue-500' },
                                    { label: 'Liked', value: artistDetails?.likedCount || 0, color: 'text-white' },
                                    { label: 'Tier', value: artistDetails?.tier?.split(' ')[0] || 'Unranked', color: 'text-blue-500' }
                                ].map((stat) => (
                                    <div key={stat.label} className="ios26-glass p-6 rounded-3xl text-center border border-white/5">
                                        <div className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-1.5">{stat.label}</div>
                                        <div className={`text-2xl font-black tracking-tighter ${stat.color}`}>{stat.value}</div>
                                    </div>
                                ))}
                            </div>

                            <section>
                                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Global Rotation</h3>
                                    <Activity size={14} className="text-blue-500" />
                                </div>
                                <div className="space-y-3">
                                    {artistDetails?.globalTopTracks?.map((t, i) => (
                                        <div key={t.id} onClick={() => fetchTrackInsights(t)} className="ios26-card-interactive p-3 px-5 flex items-center gap-5 text-left group">
                                            <span className="text-[10px] font-black text-white/20 w-4">{i + 1}</span>
                                            <img src={t.album.images[2]?.url} className="w-12 h-12 rounded-[14px] shadow-lg grayscale-[0.3] group-hover:grayscale-0 transition-all" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-black truncate tracking-tighter uppercase text-white group-hover:text-blue-500 transition-colors">{t.name}</div>
                                                <div className="text-[9px] text-white/30 font-black uppercase tracking-widest">Index: {t.popularity}%</div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500">
                                                <ArrowLeft size={14} className="rotate-180 text-blue-500" />
                                            </div>
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-3xl" onClick={() => setSelectedAlbum(null)}>
                    <div
                        className="ios26-liquid w-full max-w-4xl max-h-[85vh] rounded-[56px] border border-white/20 overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,1)]  flex flex-col md:flex-row relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-full md:w-[45%] relative h-80 md:h-auto overflow-hidden">
                            <img src={selectedAlbum.images[0]?.url} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#050505] to-transparent" />
                            <div className="absolute bottom-12 left-12 right-12">
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 mb-4 ml-1">Discography</p>
                                <h2 className="text-5xl font-black tracking-tighter mb-4 leading-none text-white">{selectedAlbum.name}</h2>
                                <p className="text-white font-black text-lg tracking-tight mb-8 uppercase opacity-80">{selectedAlbum.artists[0].name}</p>
                                <div className="flex gap-6 text-[10px] font-black text-white/30 uppercase tracking-widest">
                                    <span className="flex items-center gap-2"><Calendar size={12} /> {new Date(selectedAlbum.release_date).getFullYear()}</span>
                                    <span className="flex items-center gap-2"><Disc size={12} /> {albumDetails?.tracks?.length} UNITS</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 p-12 flex flex-col min-h-0 bg-[#050505]/40 relative">
                            <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Track Telemetry</h3>
                                <button onClick={() => setSelectedAlbum(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all border border-white/5 shadow-xl hover:scale-110">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-2">
                                {albumDetailsLoading ? (
                                    <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
                                ) : (
                                    albumDetails?.tracks?.map((t, i) => (
                                        <div key={t.id} onClick={() => fetchTrackInsights(t)} className="flex items-center gap-6 p-4 rounded-2xl hover:bg-white/[0.04] transition-all group cursor-pointer border border-transparent hover:border-white/5">
                                            <span className="text-[9px] font-black text-white/20 w-4">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-black truncate uppercase tracking-tighter ${t.isTopTrack ? 'text-blue-500' : 'text-white'} group-hover:text-blue-400 transition-colors`}>{t.name}</div>
                                            </div>
                                            <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">{formatDuration(t.duration_ms)}</span>
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-3xl" onClick={() => setSelectedTrack(null)}>
                    <div
                        className="ios26-liquid w-full max-w-xl rounded-[64px] border border-white/20 overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] "
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-12">
                            <div className="flex flex-col items-center text-center mb-12">
                                <div className="relative group mb-10">
                                    <div className="absolute inset-0 bg-blue-500/30 blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-1000 scale-110" />
                                    <img
                                        src={selectedTrack.album?.images[0]?.url || selectedAlbum?.images[0]?.url}
                                        className="w-56 h-56 rounded-[48px] shadow-[0_30px_60px_-15px_rgba(0,0,0,1)] group-active:scale-95 transition-all duration-700 cursor-pointer relative z-10 border border-white/10"
                                        alt=""
                                    />
                                </div>
                                <div className="w-full">
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500 mb-4">Frequency Insight</p>
                                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-2 truncate uppercase text-white">{selectedTrack.name}</h2>
                                    <p className="text-xl text-white/40 font-black mb-8 uppercase tracking-tight">{selectedTrack.artists?.[0]?.name || 'Unknown Artist'}</p>

                                    <div className="flex gap-4 justify-center">
                                        <div className="ios26-glass flex-1 p-6 rounded-[32px] border border-white/5 group hover:bg-white/[0.04] transition-all">
                                            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 block">Population Index</span>
                                            <span className="text-3xl font-black text-white tracking-tighter">{selectedTrack.popularity}%</span>
                                        </div>
                                        {isTrackLiked && (
                                            <div className="ios26-glass p-6 rounded-[32px] border border-white/5 flex items-center justify-center group hover:bg-white/[0.04] transition-all">
                                                <Heart size={28} className="text-pink-500" fill="currentColor" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-10">
                                <section>
                                    <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Telemetry Analysis</h3>
                                        <Activity size={14} className="text-blue-500" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="ios26-glass p-6 rounded-[28px] text-center border border-white/5 group hover:bg-white/[0.04] transition-all">
                                            <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1.5 opacity-60">Sonic Power</div>
                                            <div className="text-4xl font-black text-blue-500 tracking-tighter group-hover:scale-110 transition-transform">{selectedTrack.popularity}%</div>
                                        </div>
                                        <div className="ios26-glass p-6 rounded-[28px] text-center border border-white/5 group hover:bg-white/[0.04] transition-all">
                                            <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1.5 opacity-60">Reach Index</div>
                                            <div className="text-4xl font-black text-green-500 tracking-tighter group-hover:scale-110 transition-transform">{(selectedTrack.popularity * 0.8).toFixed(0)}</div>
                                        </div>
                                    </div>
                                </section>

                                <button
                                    onClick={() => setSelectedTrack(null)}
                                    className="w-full py-5 bg-white text-black font-black uppercase tracking-[0.2em] text-xs rounded-3xl hover:bg-gray-200 transition-all active:scale-[0.98] shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)] mt-4"
                                >
                                    Eject Segment
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
