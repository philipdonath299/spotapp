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
                const likedSongs = {
                    id: 'liked-songs',
                    name: 'Liked Signals',
                    images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.png' }],
                    tracks: { total: 'Library Stream' },
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
            setAnalysisStatus('DECOMPILING STREAM...');
            let allTracks = [];
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
                setAnalysisStatus('SCANNING ENTROPY...');
                const trackMap = new Map();
                const dupeList = [];
                allTracks.forEach((item, index) => {
                    if (!item.track || item.is_local) return;
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
                setAnalysisStatus('VERIFYING NODE INTEGRITY...');
                const unavailable = [];
                allTracks.forEach((item, index) => {
                    if (!item.track) return;
                    if (item.track.is_playable === false) {
                        unavailable.push({
                            track: item.track,
                            uri: item.track.uri,
                            id: item.track.id,
                            position: index,
                            reason: 'Region Locked'
                        });
                    }
                });
                setUnavailableTracks(unavailable);
            }

        } catch (err) {
            console.error("Analysis failed:", err);
            alert("Analysis failed.");
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
                const idsToRemove = itemsToRemove.map(item => item.id);
                for (let i = 0; i < idsToRemove.length; i += 50) {
                    const chunk = idsToRemove.slice(i, i + 50);
                    await spotifyFetch('/me/tracks', 'DELETE', { ids: chunk });
                }
            } else {
                const sortedItems = [...itemsToRemove].sort((a, b) => b.position - a.position);
                for (let i = 0; i < sortedItems.length; i += 100) {
                    const chunk = sortedItems.slice(i, i + 100);
                    const tracksToDelete = chunk.reduce((acc, item) => {
                        const uri = item.uri;
                        if (!acc[uri]) acc[uri] = [];
                        acc[uri].push(item.position);
                        return acc;
                    }, {});
                    const apiBody = Object.entries(tracksToDelete).map(([uri, positions]) => ({ uri, positions }));
                    await spotifyFetch(`/playlists/${selectedPlaylist.id}/tracks`, 'DELETE', {
                        tracks: apiBody,
                        snapshot_id: selectedPlaylist.snapshot_id
                    });
                }
            }
            setDuplicates([]);
            setUnavailableTracks([]);
            alert('Wiped.');
            setTimeout(() => { analyzePlaylist(selectedPlaylist); }, 1000);
        } catch (err) {
            console.error(err);
            alert('Wipe failed.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="py-20  max-w-6xl mx-auto px-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/5 blur-[120px] rounded-full -z-10 animate-ios26-float" />

            <header className="mb-24">
                <button onClick={() => navigate('/dashboard')} className="mb-10 flex items-center text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Dashboard
                </button>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 ml-1">Library Management</p>
                        <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-white">
                            Cleanup
                        </h1>
                    </div>
                </div>
            </header>

            <div className="ios26-tabs p-1.5 flex gap-2 mb-20 max-w-md mx-auto md:mx-0">
                <button
                    onClick={() => { setCleanupMode('duplicates'); setSelectedPlaylist(null); }}
                    className={`flex-1 py-4 rounded-[18px] text-[10px] font-black transition-all uppercase tracking-[0.2em] ${cleanupMode === 'duplicates' ? 'bg-white text-black shadow-2xl scale-105' : 'text-white/30 hover:text-white'}`}
                >
                    Duplicates
                </button>
                <button
                    onClick={() => { setCleanupMode('unavailable'); setSelectedPlaylist(null); }}
                    className={`flex-1 py-4 rounded-[18px] text-[10px] font-black transition-all uppercase tracking-[0.2em] ${cleanupMode === 'unavailable' ? 'bg-white text-black shadow-2xl scale-105' : 'text-white/30 hover:text-white'}`}
                >
                    Clean
                </button>
            </div>

            {!selectedPlaylist ? (
                <div className="space-y-12 ">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-3 ml-1">Select Playlist to Scan</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {playlists.map(playlist => (
                            <div
                                key={playlist.id}
                                onClick={() => analyzePlaylist(playlist)}
                                className="ios26-card-interactive p-5 md:p-6 group"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-[24px] overflow-hidden shadow-2xl ring-1 ring-white/10 group-hover:scale-110 transition-all duration-700">
                                        {playlist.images?.[0]?.url ? (
                                            <img src={playlist.images[0].url} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" alt="" />
                                        ) : (
                                            <div className="w-full h-full bg-white/5 flex items-center justify-center">
                                                <span className="text-white/20 font-black uppercase text-[10px]">?</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="truncate flex-1">
                                        <div className="font-black truncate text-sm tracking-tighter uppercase text-white group-hover:text-red-500 transition-colors mb-1">{playlist.name}</div>
                                        <div className="text-[9px] text-white/30 font-black uppercase tracking-widest opacity-80 truncate">{playlist.tracks.total} Units</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="">
                    <button
                        onClick={() => setSelectedPlaylist(null)}
                        className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white mb-10 transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft size={14} /> Re-Select Stream
                    </button>

                    <div className="ios26-card p-12 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-red-500/[0.01] -z-10" />

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-16 gap-8 text-center md:text-left">
                            <div>
                                <h2 className="text-5xl font-black tracking-tighter uppercase text-white leading-none">{selectedPlaylist.name}</h2>
                                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] mt-3">{cleanupMode === 'duplicates' ? 'Spectral Entropy' : 'Node integrity'} Report</p>
                            </div>
                            {loading && (
                                <div className="ios26-liquid px-8 py-3 rounded-full flex items-center gap-4 border border-white/20 shadow-2xl">
                                    <Loader2 className="animate-spin text-white" size={16} />
                                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white">{analysisStatus}</span>
                                </div>
                            )}
                        </div>

                        {!loading && (
                            <div className="">
                                {cleanupMode === 'duplicates' && (
                                    duplicates.length > 0 ? (
                                        <div className="space-y-10">
                                            <div className="flex items-center gap-4 p-8 ios26-glass border border-red-500/20 text-red-500 rounded-[32px] shadow-2xl">
                                                <AlertTriangle size={24} />
                                                <span className="text-sm font-black uppercase tracking-[0.2em]">{duplicates.length} Redundant Units Detected</span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                                                {duplicates.map((d, i) => (
                                                    <div key={i} className="ios26-card bg-black/40 p-5 flex items-center gap-6 group hover:border-red-500/30 transition-all border-white/5">
                                                        <div className="w-12 h-12 rounded-[16px] overflow-hidden shadow-2xl">
                                                            <img src={d.duplicate.track.album?.images?.[2]?.url} className="w-full h-full object-cover" alt="" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-black text-white uppercase text-[10px] truncate mb-1">{d.duplicate.track.name}</div>
                                                            <div className="text-[8px] text-white/20 font-black uppercase tracking-[0.2em] truncate">{d.duplicate.track.artists[0].name}</div>
                                                        </div>
                                                        <span className="text-[8px] font-black uppercase text-red-500/40">DUPE</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => removeTracks(duplicates)}
                                                disabled={processing}
                                                className="w-full py-6 ios26-liquid bg-red-600 text-white font-black rounded-[28px] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 shadow-2xl border border-red-500/30 uppercase tracking-[0.3em] text-[10px]"
                                            >
                                                {processing ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                                {processing ? 'PURGING STREAM' : `WIPE ${duplicates.length} UNITS`}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-24 ios26-glass rounded-[48px] border border-white/5">
                                            <div className="w-20 h-20 ios26-liquid rounded-full mx-auto flex items-center justify-center mb-10 border border-green-500/20 shadow-2xl">
                                                <CheckCircle className="text-green-500" size={32} />
                                            </div>
                                            <h3 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">Entropy Neutralized</h3>
                                            <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.3em]">Stream is optimized for performance.</p>
                                        </div>
                                    )
                                )}

                                {cleanupMode === 'unavailable' && (
                                    unavailableTracks.length > 0 ? (
                                        <div className="space-y-10">
                                            <div className="flex items-center gap-4 p-8 ios26-glass border border-orange-500/20 text-orange-500 rounded-[32px] shadow-2xl">
                                                <AlertTriangle size={24} />
                                                <span className="text-sm font-black uppercase tracking-[0.2em]">{unavailableTracks.length} Dead Nodes Detected</span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                                                {unavailableTracks.map((d, i) => (
                                                    <div key={i} className="ios26-card bg-black/40 p-5 flex items-center gap-6 group hover:border-orange-500/30 transition-all border-white/5 opacity-60">
                                                        <div className="w-12 h-12 rounded-[16px] overflow-hidden shadow-2xl grayscale">
                                                            {d.track.album?.images[2]?.url ? (
                                                                <img src={d.track.album.images[2].url} className="w-full h-full object-cover" alt="" />
                                                            ) : (
                                                                <div className="w-full h-full bg-white/5" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-black text-white uppercase text-[10px] truncate mb-1">{d.track.name}</div>
                                                            <div className="text-[8px] text-white/20 font-black uppercase tracking-[0.2em] truncate">{d.track.artists[0]?.name}</div>
                                                        </div>
                                                        <span className="text-[8px] font-black uppercase text-orange-500/40">DEAD</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => removeTracks(unavailableTracks)}
                                                disabled={processing}
                                                className="w-full py-6 ios26-liquid bg-orange-600 text-white font-black rounded-[28px] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 shadow-2xl border border-orange-500/30 uppercase tracking-[0.3em] text-[10px]"
                                            >
                                                {processing ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                                                {processing ? 'DELETING NODES' : `WIPE ${unavailableTracks.length} ISSUES`}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-24 ios26-glass rounded-[48px] border border-white/5">
                                            <div className="w-20 h-20 ios26-liquid rounded-full mx-auto flex items-center justify-center mb-10 border border-green-500/20 shadow-2xl">
                                                <CheckCircle className="text-green-500" size={32} />
                                            </div>
                                            <h3 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">Integrity Verified</h3>
                                            <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.3em]">All stream nodes are active and available.</p>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LibraryCleanup;
