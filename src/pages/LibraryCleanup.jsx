import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Trash2, RefreshCw, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

const LibraryCleanup = () => {
    const navigate = useNavigate();
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [loading, setLoading] = useState(false);
    const [analysisStatus, setAnalysisStatus] = useState('');
    const [duplicates, setDuplicates] = useState([]);
    const [processing, setProcessing] = useState(false);
    const [cleanupMode, setCleanupMode] = useState('duplicates'); // 'duplicates' | 'unavailable'
    const [unavailableTracks, setUnavailableTracks] = useState([]);

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const fetchPlaylists = async () => {
        try {
            const data = await spotifyFetch('/me/playlists?limit=50');
            if (data?.items) {
                setPlaylists(data.items);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const analyzePlaylist = async (playlist) => {
        setLoading(true);
        setSelectedPlaylist(playlist);
        setDuplicates([]);
        setUnavailableTracks([]);

        try {
            setAnalysisStatus('Fetching tracks...');
            let allTracks = [];
            let nextUrl = `/playlists/${playlist.id}/tracks?limit=100&market=from_token`; // Add market param to check availability

            while (nextUrl) {
                const res = await spotifyFetch(nextUrl.replace('https://api.spotify.com/v1', ''));
                if (res?.items) {
                    allTracks = [...allTracks, ...res.items];
                    nextUrl = res.next;
                } else {
                    nextUrl = null;
                }
            }

            if (cleanupMode === 'duplicates') {
                setAnalysisStatus('Detecting duplicates...');
                const trackMap = new Map();
                const dupeList = [];

                allTracks.forEach((item, index) => {
                    if (!item.track || item.is_local) return;

                    // Key based on Name + Artist to catch different versions (e.g. Album vs Single)
                    const key = `${item.track.name.toLowerCase()}-${item.track.artists[0]?.name.toLowerCase()}`;

                    if (trackMap.has(key)) {
                        // This is a duplicate!
                        const original = trackMap.get(key);
                        dupeList.push({
                            original: original,
                            duplicate: item,
                            // We need the snapshot_id from the playlist to safely remove specific occurrences
                            uri: item.track.uri,
                            position: index
                        });
                    } else {
                        trackMap.set(key, item);
                    }
                });
                setDuplicates(dupeList);
            } else if (cleanupMode === 'unavailable') {
                setAnalysisStatus('Checking availability...');
                const unavailable = [];

                allTracks.forEach((item, index) => {
                    if (!item.track) return;

                    // Check availability
                    // A track is unavailable if:
                    // 1. is_playable is false (if provided)
                    // 2. available_markets is empty or doesn't contain user's market (harder to check without knowing user market explicitly, but is_playable covering most)
                    // item.track.is_playable is returned when 'market' param is used.

                    if (item.track.is_playable === false) {
                        unavailable.push({
                            track: item.track,
                            uri: item.track.uri,
                            position: index,
                            reason: 'Not playable in your region'
                        });
                    }
                });
                setUnavailableTracks(unavailable);
            }

        } catch (err) {
            console.error("Analysis failed:", err);
            alert("Failed to analyze playlist.");
        } finally {
            setLoading(false);
            setAnalysisStatus('');
        }
    };

    const removeTracks = async (itemsToRemove) => {
        if (itemsToRemove.length === 0) return;
        setProcessing(true);
        try {
            // Group positions by URI to batch delete efficiently
            const tracksToDelete = itemsToRemove.reduce((acc, item) => {
                const uri = item.uri;
                if (!acc[uri]) {
                    acc[uri] = [];
                }
                acc[uri].push(item.position);
                return acc;
            }, {});

            // Format for Spotify API: { uri: "...", positions: [0, 5, ...] }
            const apiBody = Object.entries(tracksToDelete).map(([uri, positions]) => ({
                uri,
                positions
            }));

            // Send in chunks of 100 items (not 100 positions, but 100 track objects)
            // Note: Spotify API limit for 'tracks' array is 100.
            for (let i = 0; i < apiBody.length; i += 100) {
                const chunk = apiBody.slice(i, i + 100);
                await spotifyFetch(`/playlists/${selectedPlaylist.id}/tracks`, 'DELETE', {
                    tracks: chunk,
                    snapshot_id: selectedPlaylist.snapshot_id // Recommended for safer deletes
                });
            }

            setDuplicates([]);
            setUnavailableTracks([]);
            alert('Tracks removed!');

            // Re-analyze
            // We need to re-fetch the playlist structure because positions have changed
            // Waiting a brief moment for Spotify backend to update is sometimes safer
            setTimeout(() => {
                analyzePlaylist(selectedPlaylist);
            }, 1000);

        } catch (err) {
            console.error(err);
            alert('Failed to remove tracks.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white p-4 md:p-8 animate-fade-in">
            <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft className="mr-2" size={20} /> Back to Dashboard
            </button>

            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold mb-4 flex items-center gap-4">
                        <Trash2 className="text-red-500" size={40} />
                        Library Cleanup
                    </h1>
                    <p className="text-gray-400">Keep your library fresh by detecting duplicates and managing your tracks.</p>
                </header>

                {/* Tabs */}
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={() => { setCleanupMode('duplicates'); setSelectedPlaylist(null); }}
                        className={`px-6 py-2 rounded-full font-bold transition-all ${cleanupMode === 'duplicates'
                            ? 'bg-red-500 text-white'
                            : 'bg-[#181818] text-gray-400 hover:text-white border border-neutral-800'}`}
                    >
                        Duplicates
                    </button>
                    <button
                        onClick={() => { setCleanupMode('unavailable'); setSelectedPlaylist(null); }}
                        className={`px-6 py-2 rounded-full font-bold transition-all ${cleanupMode === 'unavailable'
                            ? 'bg-red-500 text-white'
                            : 'bg-[#181818] text-gray-400 hover:text-white border border-neutral-800'}`}
                    >
                        Unavailable Tracks
                    </button>
                </div>

                {!selectedPlaylist ? (
                    <div className="grid gap-4">
                        <h2 className="text-xl font-bold mb-4">Select a Playlist to Check for {cleanupMode === 'duplicates' ? 'Duplicates' : 'Issues'}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {playlists.map(playlist => (
                                <div
                                    key={playlist.id}
                                    onClick={() => analyzePlaylist(playlist)}
                                    className="bg-[#181818] p-4 rounded-xl border border-neutral-800 hover:border-red-500/50 cursor-pointer transition-all flex items-center gap-4"
                                >
                                    {playlist.images?.[0]?.url ? (
                                        <img src={playlist.images[0].url} className="w-12 h-12 rounded" alt="" />
                                    ) : (
                                        <div className="w-12 h-12 bg-neutral-800 rounded flex items-center justify-center">?</div>
                                    )}
                                    <div className="truncate">
                                        <div className="font-bold truncate text-sm">{playlist.name}</div>
                                        <div className="text-xs text-gray-500">{playlist.tracks.total} tracks</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in">
                        <button
                            onClick={() => setSelectedPlaylist(null)}
                            className="text-sm text-gray-500 hover:text-white mb-6"
                        >
                            Change Playlist
                        </button>

                        <div className="bg-[#181818] p-6 rounded-2xl border border-neutral-800 mb-8">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold">{selectedPlaylist.name}</h2>
                                    <p className="text-gray-400 text-sm">Analysis Results</p>
                                </div>
                                {loading && (
                                    <div className="flex items-center gap-2 text-green-500">
                                        <Loader2 className="animate-spin" />
                                        <span>{analysisStatus}</span>
                                    </div>
                                )}
                            </div>

                            {!loading && (
                                <>
                                    {cleanupMode === 'duplicates' && (
                                        duplicates.length > 0 ? (
                                            <div>
                                                <div className="flex items-center gap-3 p-4 bg-red-500/10 text-red-400 rounded-xl mb-6 border border-red-500/20">
                                                    <AlertTriangle />
                                                    <span className="font-bold">Found {duplicates.length} duplicate tracks!</span>
                                                </div>

                                                <div className="mb-6 max-h-[400px] overflow-y-auto custom-scrollbar space-y-2">
                                                    {duplicates.map((d, i) => (
                                                        <div key={i} className="flex items-center justify-between p-3 bg-black/40 rounded-lg">
                                                            <div className="flex items-center gap-3">
                                                                <img src={d.duplicate.track.album.images[2]?.url} className="w-10 h-10 rounded" alt="" />
                                                                <div>
                                                                    <div className="font-bold text-sm">{d.duplicate.track.name}</div>
                                                                    <div className="text-xs text-gray-500">{d.duplicate.track.artists[0].name}</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-red-500 font-bold uppercase">Duplicate</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={() => removeTracks(duplicates)}
                                                    disabled={processing}
                                                    className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                                >
                                                    {processing ? <Loader2 className="animate-spin" /> : <Trash2 />}
                                                    {processing ? 'Removing...' : `Remove All ${duplicates.length} Duplicates`}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                                                <h3 className="text-xl font-bold mb-2">No Duplicates Found!</h3>
                                                <p className="text-gray-500">This playlist is super clean.</p>
                                            </div>
                                        )
                                    )}

                                    {cleanupMode === 'unavailable' && (
                                        unavailableTracks.length > 0 ? (
                                            <div>
                                                <div className="flex items-center gap-3 p-4 bg-orange-500/10 text-orange-400 rounded-xl mb-6 border border-orange-500/20">
                                                    <AlertTriangle />
                                                    <span className="font-bold">Found {unavailableTracks.length} unavailable tracks!</span>
                                                </div>

                                                <div className="mb-6 max-h-[400px] overflow-y-auto custom-scrollbar space-y-2">
                                                    {unavailableTracks.map((d, i) => (
                                                        <div key={i} className="flex items-center justify-between p-3 bg-black/40 rounded-lg opacity-75">
                                                            <div className="flex items-center gap-3">
                                                                {d.track.album?.images[2]?.url ? (
                                                                    <img src={d.track.album.images[2].url} className="w-10 h-10 rounded grayscale" alt="" />
                                                                ) : (
                                                                    <div className="w-10 h-10 bg-neutral-800 rounded"></div>
                                                                )}
                                                                <div>
                                                                    <div className="font-bold text-sm">{d.track.name}</div>
                                                                    <div className="text-xs text-gray-500">{d.track.artists[0]?.name}</div>
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-orange-500 font-bold uppercase">Unplayable</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={() => removeTracks(unavailableTracks)}
                                                    disabled={processing}
                                                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                                >
                                                    {processing ? <Loader2 className="animate-spin" /> : <Trash2 />}
                                                    {processing ? 'Removing...' : `Remove All ${unavailableTracks.length} Issues`}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                                                <h3 className="text-xl font-bold mb-2">All Clear!</h3>
                                                <p className="text-gray-500">Every track is available and playable.</p>
                                            </div>
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LibraryCleanup;
