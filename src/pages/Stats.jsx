import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Loader2, Music, User, Clock, TrendingUp, Disc, X, Heart, CheckCircle, PlaySquare, Users, Zap, Calendar, Sparkles, Mic, Activity, Layers, Volume2, Flame, Trophy, Upload, Database, Infinity } from 'lucide-react';
import { addTracksToDb, getLifetimeStats, formatApiTrack, formatJsonTrack, clearDb } from '../utils/db';

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
    const [lifetimeStats, setLifetimeStats] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState(null);

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

    useEffect(() => {
        // Auto-sync recent tracks to DB on mount
        const syncRecentToDb = async () => {
            try {
                const recentData = await spotifyFetch('/me/player/recently-played?limit=50');
                if (recentData && recentData.items) {
                    const formatted = recentData.items.map(formatApiTrack);
                    await addTracksToDb(formatted);
                    // Refresh lifetime stats after sync
                    loadLifetimeStats();
                }
            } catch (err) {
                console.error('Auto-sync failed:', err);
            }
        };
        syncRecentToDb();
        loadLifetimeStats();
    }, []);

    const loadLifetimeStats = async () => {
        try {
            const stats = await getLifetimeStats();
            setLifetimeStats(stats);
        } catch (err) {
            console.error('Failed to load lifetime stats:', err);
        }
    };

    const handleFileUpload = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsImporting(true);
        setImportStatus('Parsing files...');

        let totalAdded = 0;

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const text = await file.text();
                const json = JSON.parse(text);

                if (Array.isArray(json)) {
                    // Filter for valid history items (must have endTime and artistName)
                    // Spotify has changed formats: sometimes 'endTime', sometimes 'ts'
                    // We support standard 'StreamingHistory' format
                    const validItems = json.filter(item => item.endTime && item.artistName);
                    const formatted = validItems.map(formatJsonTrack);

                    const added = await addTracksToDb(formatted);
                    totalAdded += added;
                }
            }
            setImportStatus(`Successfully imported ${totalAdded.toLocaleString()} new streams!`);
            await loadLifetimeStats();
        } catch (err) {
            console.error(err);
            setImportStatus('Error importing files. Ensure they are valid Spotify StreamingHistory.json files.');
        } finally {
            setIsImporting(false);
            // Clear status after 3 seconds
            setTimeout(() => setImportStatus(null), 3000);
        }
    };


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

                        <div className="flex bg-[#121212] p-1.5 rounded-xl border border-neutral-800 shadow-inner overflow-x-auto max-w-full">
                            {['short_term', 'medium_term', 'long_term'].map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-4 md:px-5 py-2.5 rounded-lg text-sm font-black transition-all whitespace-nowrap ${timeRange === range
                                        ? 'bg-[#282828] text-white shadow-xl scale-[1.02]'
                                        : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                >
                                    {range === 'short_term' ? 'Last Month' : range === 'medium_term' ? '6 Months' : 'All Time'}
                                </button>
                            ))}
                        </div>
                    </header>

                    {/* Listening Stats Summary */}
                    {listeningStats && (
                        <div className="mb-8 hidden md:grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6 rounded-2xl border border-green-500/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <Clock className="text-green-500" size={24} />
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Avg Minutes/Day</div>
                                </div>
                                <div className="text-4xl font-black text-green-500">{listeningStats.avgMinutesPerDay}</div>
                                <div className="text-xs text-gray-500 mt-1">≈ {(listeningStats.avgMinutesPerDay / 60).toFixed(1)} hours/day</div>
                            </div>

                            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-6 rounded-2xl border border-blue-500/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <TrendingUp className="text-blue-500" size={24} />
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Avg Streams/Day</div>
                                </div>
                                <div className="text-4xl font-black text-blue-500">{listeningStats.avgStreamsPerDay}</div>
                                <div className="text-xs text-gray-500 mt-1">over {listeningStats.daysCovered} days</div>
                            </div>

                            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 rounded-2xl border border-purple-500/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <Music className="text-purple-500" size={24} />
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Streams</div>
                                </div>
                                <div className="text-4xl font-black text-purple-500">{listeningStats.totalStreams}</div>
                                <div className="text-xs text-gray-500 mt-1">in recent history</div>
                            </div>

                            <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-6 rounded-2xl border border-orange-500/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <Volume2 className="text-orange-500" size={24} />
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Time</div>
                                </div>
                                <div className="text-4xl font-black text-orange-500">{listeningStats.totalHours}h</div>
                                <div className="text-xs text-gray-500 mt-1">{listeningStats.totalMinutes} minutes</div>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-10 border-b border-neutral-800 pb-4">
                        {[
                            { id: 'artists', label: 'Top Artists', icon: User },
                            { id: 'tracks', label: 'Top Songs', icon: Music },
                            { id: 'albums', label: 'Top Albums', icon: Disc },
                            { id: 'recent', label: 'History', icon: Clock },
                            { id: 'playlists', label: 'Playlists', icon: PlaySquare },
                            { id: 'insights', label: 'Insights', icon: Activity },
                            { id: 'insights', label: 'Insights', icon: Activity },
                            { id: 'rediscover', label: 'Rediscover', icon: Sparkles },
                            { id: 'lifetime', label: 'Lifetime', icon: Infinity }
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

                </div>

                <div className="min-h-[400px]">
                    {activeTab === 'lifetime' && (
                        <section className="animate-fade-in space-y-8">
                            <div className="bg-[#181818] p-8 rounded-3xl border border-neutral-800 text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-red-500"></div>
                                <h2 className="text-3xl font-black mb-4">Your Lifetime Database</h2>
                                <p className="text-gray-400 max-w-2xl mx-auto mb-8">
                                    Import your Spotify <code>StreamingHistory.json</code> files to unlock all-time stats.
                                    Statsify also automatically saves your recent plays to this local database every time you visit.
                                </p>

                                <div className="flex flex-col items-center justify-center gap-4">
                                    <label className="cursor-pointer bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform flex items-center gap-2">
                                        <Upload size={20} />
                                        {isImporting ? 'Importing...' : 'Upload Data Files'}
                                        <input type="file" multiple accept=".json" onChange={handleFileUpload} className="hidden" disabled={isImporting} />
                                    </label>
                                    {importStatus && (
                                        <p className={`text-sm font-bold ${importStatus.includes('Error') ? 'text-red-500' : 'text-green-500'} animate-fade-in`}>
                                            {importStatus}
                                        </p>
                                    )}
                                    <button
                                        onClick={async () => {
                                            if (confirm('Are you sure you want to delete all lifetime data? This cannot be undone.')) {
                                                await clearDb();
                                                loadLifetimeStats();
                                            }
                                        }}
                                        className="text-xs text-red-500 hover:text-red-400 mt-4 underline"
                                    >
                                        Clear Database
                                    </button>
                                </div>
                            </div>

                            {lifetimeStats && lifetimeStats.totalStreams > 0 ? (
                                <>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-[#121212] p-6 rounded-2xl border border-neutral-800">
                                            <div className="text-gray-500 text-xs font-black uppercase tracking-widest mb-2">Total Time</div>
                                            <div className="text-3xl font-black text-white">{lifetimeStats.totalHours.toLocaleString()}h</div>
                                            <div className="text-gray-600 text-xs mt-1">{(lifetimeStats.totalHours / 24).toFixed(1)} days nonstop</div>
                                        </div>
                                        <div className="bg-[#121212] p-6 rounded-2xl border border-neutral-800">
                                            <div className="text-gray-500 text-xs font-black uppercase tracking-widest mb-2">Total Streams</div>
                                            <div className="text-3xl font-black text-green-500">{lifetimeStats.totalStreams.toLocaleString()}</div>
                                        </div>
                                        <div className="bg-[#121212] p-6 rounded-2xl border border-neutral-800">
                                            <div className="text-gray-500 text-xs font-black uppercase tracking-widest mb-2">First Record</div>
                                            <div className="text-xl font-bold text-white">{lifetimeStats.firstDate?.toLocaleDateString()}</div>
                                        </div>
                                        <div className="bg-[#121212] p-6 rounded-2xl border border-neutral-800">
                                            <div className="text-gray-500 text-xs font-black uppercase tracking-widest mb-2">Unique Artists</div>
                                            <div className="text-xl font-bold text-white">{lifetimeStats.topArtists.length.toLocaleString()}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="bg-[#181818] p-6 rounded-3xl border border-neutral-800">
                                            <h3 className="text-xl font-black mb-6 flex items-center gap-2"><Trophy className="text-yellow-500" /> Top Artists (All Time)</h3>
                                            <div className="space-y-4">
                                                {lifetimeStats.topArtists.slice(0, 10).map((artist, i) => (
                                                    <div key={artist.name} className="flex items-center gap-4">
                                                        <div className="font-mono text-gray-500 w-6 text-right font-bold text-lg">{i + 1}</div>
                                                        <div className="flex-1">
                                                            <div className="font-bold text-white">{artist.name}</div>
                                                            <div className="bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
                                                                <div className="bg-yellow-500 h-full" style={{ width: `${(artist.ms / lifetimeStats.topArtists[0].ms) * 100}%` }}></div>
                                                            </div>
                                                        </div>
                                                        <div className="text-xs font-bold text-gray-400">{(artist.ms / 3600000).toFixed(1)}h</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-[#181818] p-6 rounded-3xl border border-neutral-800">
                                            <h3 className="text-xl font-black mb-6 flex items-center gap-2"><Disc className="text-blue-500" /> Top Songs (All Time)</h3>
                                            <div className="space-y-4">
                                                {lifetimeStats.topTracks.slice(0, 10).map((track, i) => (
                                                    <div key={track.name} className="flex items-center gap-4">
                                                        <div className="font-mono text-gray-500 w-6 text-right font-bold text-lg">{i + 1}</div>
                                                        <div className="flex-1">
                                                            <div className="font-bold text-white truncate">{track.name}</div>
                                                            <div className="text-xs text-gray-500 truncate">{track.artist}</div>
                                                        </div>
                                                        <div className="text-xs font-bold text-gray-400">{track.count} plays</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12 text-gray-600">
                                    <Database size={48} className="mx-auto mb-4 opacity-20" />
                                    <p>No lifetime data yet. Upload your files or listen to music to start building your database.</p>
                                </div>
                            )}
                        </section>
                    )}
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

                    {/* Playlists Tab */}
                    {activeTab === 'playlists' && (
                        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 animate-fade-in">
                            {playlists.map((playlist) => (
                                <div
                                    key={playlist.id}
                                    onClick={() => navigate(`/recommendations/${playlist.id}`)}
                                    className="group cursor-pointer"
                                >
                                    <div className="relative aspect-square mb-4 shadow-2xl overflow-hidden rounded-2xl border border-neutral-800 group-hover:border-green-500/50 transition-all">
                                        {playlist.images?.[0]?.url ? (
                                            <img src={playlist.images[0].url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                        ) : (
                                            <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                                                <Music className="w-12 h-12 text-gray-600" />
                                            </div>
                                        )}
                                    </div>
                                    <h4 className="font-black text-sm truncate mb-1 group-hover:text-green-500 transition-colors">{playlist.name}</h4>
                                    <p className="text-xs text-gray-500 truncate font-medium">{playlist.tracks.total} tracks</p>
                                </div>
                            ))}
                        </section>
                    )}

                    {/* Insights Tab */}
                    {activeTab === 'insights' && (
                        <section className="space-y-12 animate-fade-in">
                            {/* Music Taste Gravity */}
                            <div className="bg-[#181818] p-8 rounded-3xl border border-neutral-800">
                                <div className="flex items-center gap-3 mb-6">
                                    <Flame className="text-orange-500" size={28} />
                                    <div>
                                        <h3 className="text-2xl font-black">Music Taste Gravity</h3>
                                        <p className="text-sm text-gray-400">Genres you always drift back to</p>
                                    </div>
                                </div>

                                {tasteGravity.coreGenres?.length > 0 ? (
                                    <>
                                        <div className="mb-8 p-6 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl border border-orange-500/20">
                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Your Core Sound</div>
                                            <div className="flex flex-wrap gap-2">
                                                {tasteGravity.coreGenres.map((item, i) => (
                                                    <div key={item.genre} className="bg-orange-500/20 border border-orange-500/30 px-4 py-2 rounded-full">
                                                        <span className="text-orange-400 font-black text-sm uppercase">{item.genre}</span>
                                                        <span className="text-gray-400 text-xs ml-2">{item.percentage}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {tasteGravity.genres?.map((item, i) => (
                                                <div key={item.genre} className="bg-[#121212] p-4 rounded-2xl border border-neutral-800 hover:border-orange-500/30 transition-all">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-bold text-sm uppercase tracking-tight">{item.genre}</span>
                                                        <span className="text-orange-500 font-black text-lg">{item.percentage}%</span>
                                                    </div>
                                                    <div className="w-full bg-black h-2 rounded-full overflow-hidden">
                                                        <div className="bg-gradient-to-r from-orange-500 to-red-500 h-full transition-all duration-1000" style={{ width: `${item.percentage}%` }} />
                                                    </div>
                                                    <div className="text-[10px] text-gray-600 mt-1 uppercase font-bold">
                                                        Gravity: {(item.gravity * 100).toFixed(0)}% of artists
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        <p>Not enough data to calculate taste gravity yet.</p>
                                    </div>
                                )}
                            </div>

                            {/* Song Lifespan Tracker */}
                            <div className="bg-[#181818] p-8 rounded-3xl border border-neutral-800">
                                <div className="flex items-center gap-3 mb-6">
                                    <Clock className="text-blue-500" size={28} />
                                    <div>
                                        <h3 className="text-2xl font-black">Song Lifespan Tracker</h3>
                                        <p className="text-sm text-gray-400">How long songs stay in your rotation</p>
                                    </div>
                                </div>

                                {lifespanData.length > 0 ? (
                                    <div className="space-y-3">
                                        {lifespanData.slice(0, 10).map((item) => (
                                            <div key={item.track.id} className="bg-[#121212] p-4 rounded-2xl border border-neutral-800 hover:bg-[#1a1a1a] transition-all">
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

                    {/* Rediscover Tab */}
                    {activeTab === 'rediscover' && (
                        <section className="animate-fade-in">
                            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-8 rounded-3xl border border-purple-500/30 mb-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <Sparkles className="text-purple-400" size={32} />
                                    <div>
                                        <h3 className="text-3xl font-black">Rediscover Your Favorites</h3>
                                        <p className="text-gray-400">Songs you loved but haven't played in months</p>
                                    </div>
                                </div>
                            </div>

                            {rediscoverTracks.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {rediscoverTracks.map((track) => (
                                        <div
                                            key={track.id}
                                            onClick={() => fetchTrackInsights(track)}
                                            className="bg-[#181818] p-4 rounded-2xl border border-neutral-800 hover:border-purple-500/50 hover:bg-[#222] transition-all cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-4 mb-3">
                                                <img src={track.album.images[2]?.url} className="w-16 h-16 rounded-xl shadow-lg" alt="" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-sm truncate group-hover:text-purple-400 transition-colors">{track.name}</div>
                                                    <div className="text-xs text-gray-400 truncate">{track.artists[0].name}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase font-black">
                                                <span>Added {track.monthsSinceAdded} months ago</span>
                                                <Sparkles size={12} className="text-purple-400" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-[#181818] rounded-3xl border border-neutral-800">
                                    <Sparkles className="mx-auto mb-4 text-gray-600" size={48} />
                                    <p className="text-gray-500 text-lg font-bold">No forgotten favorites found!</p>
                                    <p className="text-gray-600 text-sm mt-2">You're doing a great job keeping your library fresh.</p>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </div>

            {/* Artist Detail Modal */ }
    {
        selectedArtist && (
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
                            <div className="flex items-center gap-3 mb-2">
                                {artistDetails?.tier && (
                                    <span className="bg-green-500 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-green-500/20">
                                        {artistDetails.tier}
                                    </span>
                                )}
                                <span className="bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black border border-white/10 uppercase tracking-widest text-gray-300">
                                    Verified Artist
                                </span>
                            </div>
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

                    <div className="p-10 md:p-12 overflow-y-auto custom-scrollbar flex-1 leading-none">
                        {artistDetailsError && (
                            <div className="mb-6 bg-red-500/10 p-4 rounded-2xl border border-red-500/20 flex items-center justify-between">
                                <p className="text-sm font-bold text-gray-300">{artistDetailsError}</p>
                                <button
                                    onClick={() => fetchArtistInsights(selectedArtist)}
                                    className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-black uppercase tracking-widest rounded-full transition-all border border-neutral-700 hover:border-neutral-600"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                            <div className="bg-[#181818] p-6 rounded-[2rem] border border-neutral-800 text-center group hover:border-red-500/30 transition-all">
                                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                                    <Heart size={12} className="text-red-500" fill={artistDetails?.likedCount > 0 ? "currentColor" : "none"} /> Your Likes
                                </div>
                                <div className="text-3xl font-black text-white">{artistDetails?.likedCount || 0}</div>
                                <div className="text-[10px] font-bold text-gray-600 mt-1 uppercase">Saves</div>
                            </div>
                            <div className="bg-[#181818] p-6 rounded-[2rem] border border-neutral-800 text-center group hover:border-green-500/30 transition-all">
                                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                                    <TrendingUp size={12} className="text-green-500" /> In Rotation
                                </div>
                                <div className="text-3xl font-black text-white">{artistDetails?.topTracksOccurrences?.length || 0}</div>
                                <div className="text-[10px] font-bold text-gray-600 mt-1 uppercase">Top Charts</div>
                            </div>
                            <div className="bg-[#181818] p-6 rounded-[2rem] border border-neutral-800 text-center group hover:border-blue-500/30 transition-all">
                                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                                    <Users size={12} className="text-blue-500" /> Crew
                                </div>
                                <div className="text-3xl font-black text-white">
                                    {selectedArtist.followers?.total >= 1000000
                                        ? (selectedArtist.followers.total / 1000000).toFixed(1) + 'M'
                                        : selectedArtist.followers?.total >= 1000
                                            ? (selectedArtist.followers.total / 1000).toFixed(0) + 'K'
                                            : selectedArtist.followers?.total || 0}
                                </div>
                                <div className="text-[10px] font-bold text-gray-600 mt-1 uppercase">Followers</div>
                            </div>
                            <div className="bg-[#181818] p-6 rounded-[2rem] border border-neutral-800 text-center group hover:border-yellow-500/30 transition-all">
                                <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                                    < Zap size={12} className="text-yellow-500" /> Pop Index
                                </div>
                                <div className="text-3xl font-black text-white">{selectedArtist.popularity || 0}%</div>
                                <div className="text-[10px] font-bold text-gray-600 mt-1 uppercase">Global Heat</div>
                            </div>
                        </div>

                        <div className="space-y-12">
                            <section>
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                                    <span>Artist Spotlight</span>
                                    <span className="text-green-500 flex items-center gap-1"><Trophy size={10} /> Global Hits</span>
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(artistDetails?.globalTopTracks || []).map((t, i) => (
                                        <div
                                            key={t.id}
                                            onClick={() => fetchTrackInsights(t)}
                                            className="group flex items-center gap-4 p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-green-500/30 transition-all cursor-pointer"
                                        >
                                            <span className="text-[10px] font-mono text-gray-600 w-4">{i + 1}</span>
                                            <img src={t.album.images[2]?.url} className="w-12 h-12 rounded-xl shadow-lg" alt="" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold truncate group-hover:text-green-500 transition-colors uppercase tracking-tight">{t.name}</div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{t.popularity || 0}% Global Heat</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
                                {artistDetails?.topTracksOccurrences?.length > 0 && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                                            <Sparkles size={14} className="text-blue-400" /> Personal Hall of Fame
                                        </h4>
                                        <div className="space-y-3">
                                            {artistDetails.topTracksOccurrences.slice(0, 5).map(t => (
                                                <div
                                                    key={t.id}
                                                    onClick={() => fetchTrackInsights(t)}
                                                    className="bg-[#181818] p-4 rounded-2xl flex items-center gap-4 border border-neutral-800 hover:border-green-500/50 hover:bg-[#282828] transition-all cursor-pointer group/track"
                                                >
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                                    <span className="font-bold text-sm group-hover/track:text-green-500 transition-colors uppercase tracking-tight truncate flex-1">{t.name}</span>
                                                    <ArrowLeft className="rotate-180 text-gray-700 group-hover/track:text-green-500 transition-colors" size={12} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {artistDetails?.relatedArtists?.length > 0 && (
                                    <div>
                                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                                            <Disc size={14} className="text-purple-400" /> Sonic Relatives
                                        </h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            {artistDetails.relatedArtists.map(rel => (
                                                <div
                                                    key={rel.id}
                                                    onClick={() => fetchArtistInsights(rel)}
                                                    className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-purple-500/30 transition-all group cursor-pointer"
                                                >
                                                    <img src={rel.images[2]?.url} className="w-10 h-10 rounded-full grayscale group-hover:grayscale-0 transition-all border border-neutral-800 group-hover:border-purple-500 shadow-lg" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-bold text-gray-400 group-hover:text-white transition-colors truncate">{rel.name}</div>
                                                        <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{rel.popularity}% Pop.</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    {/* Album Detail Modal */ }
    {
        selectedAlbum && (
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
        )
    }

    {/* Track Detail Modal */ }
    {
        selectedTrack && (
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
                                            {selectedTrack.popularity || selectedAlbum?.popularity || 0}% Popular
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

                        <div className="space-y-8">
                            <section>
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                                    <span>Artist Spotlight</span>
                                    <span className="text-green-500 flex items-center gap-1"><Trophy size={10} /> Global Hits</span>
                                </h3>

                                {trackInsightsLoading ? (
                                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-green-500" /></div>
                                ) : (
                                    <div className="space-y-2">
                                        {artistSpotlight.slice(0, 3).map((t, i) => (
                                            <div
                                                key={t.id}
                                                onClick={(e) => { e.stopPropagation(); fetchTrackInsights(t); }}
                                                className="group flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-green-500/30 transition-all cursor-pointer"
                                            >
                                                <span className="text-[10px] font-mono text-gray-600 w-4">{i + 1}</span>
                                                <img src={t.album.images[2]?.url} className="w-10 h-10 rounded-lg shadow-lg" alt="" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold truncate group-hover:text-green-500 transition-colors uppercase tracking-tight">{t.name}</div>
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{Math.round(t.popularity)}% Pop.</div>
                                                </div>
                                                <div className="w-16 h-1 bg-black rounded-full overflow-hidden border border-white/5">
                                                    <div className="bg-green-500 h-full" style={{ width: `${t.popularity}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                        {artistSpotlight.length === 0 && !trackInsightsLoading && (
                                            <div className="text-center p-6 text-gray-500 text-[10px] font-black uppercase tracking-widest bg-white/5 rounded-2xl border border-white/5">Data unavailable</div>
                                        )}
                                    </div>
                                )}
                            </section>

                            <section>
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Discovery Metrics</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-[#181818] p-5 rounded-3xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-1">
                                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Track Power</div>
                                        <div className="text-4xl font-black text-blue-500">{selectedTrack.popularity || 0}%</div>
                                        <div className="text-[10px] text-gray-600 font-bold uppercase mt-1">Global Weight</div>
                                    </div>
                                    <div className="bg-[#181818] p-5 rounded-3xl border border-neutral-800 text-center flex flex-col items-center justify-center gap-1">
                                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Momentum</div>
                                        <div className="text-4xl font-black text-yellow-500">
                                            {artistSpotlight.length > 0 && artistSpotlight[0].popularity > 0
                                                ? Math.round(((selectedTrack.popularity || 0) / artistSpotlight[0].popularity) * 100)
                                                : 0}%
                                        </div>
                                        <div className="text-[10px] text-gray-600 font-bold uppercase mt-1">vs. Artist Peak</div>
                                    </div>
                                </div>
                            </section>

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
        )
    }
        </div >
    );
};

export default Stats;
