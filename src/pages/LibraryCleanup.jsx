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
                // Add "Liked Songs" as a virtual playlist option
                const likedSongs = {
                    id: 'liked-songs',
                    name: 'Liked Songs',
                    images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.png' }], // Standard Spotify liked songs art or similar
                    tracks: { total: 'Your Library' },
                    isVirtual: true
                };
                setPlaylists([likedSongs, ...data.items]);
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

            // Handle Liked Songs vs Regular Playlists
            let nextUrl;
            if (playlist.id === 'liked-songs') {
                nextUrl = `/me/tracks?limit=50&market=from_token`;
            } else {
                nextUrl = `/playlists/${playlist.id}/tracks?limit=100&market=from_token`;
            }

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

                    // Key based on Name + Artist
                    const key = `${item.track.name.toLowerCase()}-${item.track.artists[0]?.name.toLowerCase()}`;

                    if (trackMap.has(key)) {
                        const original = trackMap.get(key);
                        dupeList.push({
                            original: original,
                            duplicate: item,
                            uri: item.track.uri,
                            id: item.track.id,
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

                    if (item.track.is_playable === false) {
                        unavailable.push({
                            track: item.track,
                            uri: item.track.uri,
                            id: item.track.id,
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
            if (selectedPlaylist.id === 'liked-songs') {
                // DELETE /me/tracks expects body: { ids: ["id1", "id2"] }
                // Batch by 50
                const idsToRemove = itemsToRemove.map(item => item.id);

                for (let i = 0; i < idsToRemove.length; i += 50) {
                    const chunk = idsToRemove.slice(i, i + 50);
                    await spotifyFetch('/me/tracks', 'DELETE', { ids: chunk });
                }

            } else {
                // Regular playlist deletion - Handle carefully to avoid index shifts
                // 1. Flatten all removal items into a single array
                // 2. Sort by position DESCENDING so we delete from the end first
                //    This ensures that deleting an item at index 100 doesn't shift the item at index 10.

                const sortedItems = [...itemsToRemove].sort((a, b) => b.position - a.position);

                // 3. Process in chunks of 100
                for (let i = 0; i < sortedItems.length; i += 100) {
                    const chunk = sortedItems.slice(i, i + 100);

                    // 4. Group by URI within this chunk for the API call
                    // The API expects: { uri: "...", positions: [1, 2, 3] }
                    const tracksToDelete = chunk.reduce((acc, item) => {
                        const uri = item.uri;
                        if (!acc[uri]) acc[uri] = [];
                        acc[uri].push(item.position);
                        return acc;
                    }, {});

                    const apiBody = Object.entries(tracksToDelete).map(([uri, positions]) => ({
                        uri,
                        positions
                    }));

                    // 5. Send DELETE request for this chunk
                    await spotifyFetch(`/playlists/${selectedPlaylist.id}/tracks`, 'DELETE', {
                        tracks: apiBody,
                        snapshot_id: selectedPlaylist.snapshot_id // Best effort consistency
                    });
                }
            }

            setDuplicates([]);
            setUnavailableTracks([]);
            alert('Tracks removed!');

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
            <header className="mb-14 px-4">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="mb-8 flex items-center text-blue-500 font-bold text-sm bg-blue-500/10 px-5 py-2 rounded-full hover:bg-blue-500/20 transition-all w-fit uppercase tracking-widest"
                >
                    <ArrowLeft size={16} className="mr-2" /> Dashboard
                </button>
                <div className="flex items-center gap-6">
                    <div className="p-5 bg-red-500/10 rounded-[32px] border border-red-500/20 shadow-2xl">
                        <Trash2 className="text-red-500" size={48} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none uppercase">Cleanup</h1>
                        <p className="text-gray-400 text-xl font-bold mt-2 tracking-tight">Keep your library fresh by detecting duplicates and managing tracks.</p>
                    </div>
                </div>
            </header>

            <div className="flex gap-4 mb-14 px-4">
                <button
                    onClick={() => { setCleanupMode('duplicates'); setSelectedPlaylist(null); }}
                    className={`px-8 py-3 rounded-2xl font-black transition-all uppercase tracking-widest text-xs border ${cleanupMode === 'duplicates'
                        ? 'bg-red-500 text-white border-red-400 shadow-[0_12px_24px_-4px_rgba(239,68,68,0.4)]'
                        : 'bg-white/5 text-gray-500 hover:text-gray-300 border-white/10 hover:bg-white/10'}`}
                >
                    Duplicates
                </button>
                <button
                    onClick={() => { setCleanupMode('unavailable'); setSelectedPlaylist(null); }}
                    className={`px-8 py-3 rounded-2xl font-black transition-all uppercase tracking-widest text-xs border ${cleanupMode === 'unavailable'
                        ? 'bg-red-500 text-white border-red-400 shadow-[0_12px_24px_-4px_rgba(239,68,68,0.4)]'
                        : 'bg-white/5 text-gray-500 hover:text-gray-300 border-white/10 hover:bg-white/10'}`}
                >
                    Unavailable
                </button>
            </div>

            {!selectedPlaylist ? (
                <div className="space-y-8 px-4">
                    <h2 className="text-2xl font-black tracking-tighter uppercase leading-none px-2">Select a Playlist</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {playlists.map(playlist => (
                            <div
                                key={playlist.id}
                                onClick={() => analyzePlaylist(playlist)}
                                className={`p-6 rounded-[32px] border cursor-pointer transition-all flex items-center gap-5 shadow-lg group apple-card-interactive ${playlist.id === 'liked-songs'
                                    ? 'bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-blue-500/30'
                                    : 'bg-white/5 border-white/10'
                                    }`}
                            >
                                {playlist.images?.[0]?.url ? (
                                    <img src={playlist.images[0].url} className="w-14 h-14 rounded-2xl shadow-2xl group-hover:scale-110 transition-transform duration-500" alt="" />
                                ) : (
                                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                                        {playlist.id === 'liked-songs' ? '❤️' : '?'}
                                    </div>
                                )}
                                <div className="truncate">
                                    <div className="font-black truncate text-lg tracking-tighter uppercase group-hover:text-red-400 transition-colors leading-none mb-1">{playlist.name}</div>
                                    <div className="text-[11px] text-gray-500 font-bold uppercase tracking-widest opacity-80">{playlist.tracks.total} {playlist.id === 'liked-songs' ? 'Tracks' : 'tracks'}</div>
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

                    <div className="apple-glass p-10 rounded-[48px] border border-white/15 shadow-2xl mb-12">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6">
                            <div>
                                <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">{selectedPlaylist.name}</h2>
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-2">Analysis Results</p>
                            </div>
                            {loading && (
                                <div className="flex items-center gap-3 text-red-500 bg-red-500/10 px-5 py-2 rounded-full animate-pulse border border-red-500/20">
                                    <Loader2 className="animate-spin" size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">{analysisStatus}</span>
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
                                                            <img src={d.duplicate.track.album?.images?.[2]?.url} className="w-10 h-10 rounded" alt="" />
                                                            <div>
                                                                <div className="font-bold text-sm truncate max-w-[200px]">{d.duplicate.track.name}</div>
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
                                                className="w-full py-5 bg-red-600 hover:bg-red-500 text-white font-black rounded-[24px] shadow-[0_20px_40px_-10px_rgba(239,68,68,0.4)] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                                            >
                                                {processing ? <Loader2 className="animate-spin" size={24} /> : <Trash2 size={24} />}
                                                {processing ? 'Clearing Duplicates...' : `WIPE ${duplicates.length} DUPLICATES`}
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
                                                                <div className="font-bold text-sm truncate max-w-[200px]">{d.track.name}</div>
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
    );
};

export default LibraryCleanup;
