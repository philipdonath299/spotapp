import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Radio, Heart, Activity, Loader2, PlayCircle, PlusCircle, CheckCircle } from 'lucide-react';

const Automation = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('radar'); // 'radar' | 'health'

    // Release Radar State
    const [releases, setReleases] = useState([]);
    const [radarLoading, setRadarLoading] = useState(false);
    const [radarStatus, setRadarStatus] = useState('');

    // Health State
    const [healthStats, setHealthStats] = useState(null);
    const [healthLoading, setHealthLoading] = useState(false);

    const handleCheckRadar = async () => {
        setRadarLoading(true);
        setRadarStatus('Locating Followed Nodes...');
        setReleases([]);

        try {
            const artistsData = await spotifyFetch('/me/following?type=artist&limit=50');
            const artists = artistsData.artists.items;

            setRadarStatus(`Scanning ${artists.length} Frequency Streams...`);

            const newReleases = [];
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

            const promises = artists.map(async (artist) => {
                try {
                    const albumsData = await spotifyFetch(`/artists/${artist.id}/albums?include_groups=album,single&limit=5`);
                    if (albumsData?.items) {
                        albumsData.items.forEach(album => {
                            const releaseDate = new Date(album.release_date);
                            if (releaseDate >= twoWeeksAgo) {
                                newReleases.push({
                                    ...album,
                                    artistMsg: `New Signal from ${artist.name}`
                                });
                            }
                        });
                    }
                } catch (e) { }
            });

            await Promise.all(promises);
            newReleases.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
            const uniqueReleases = Array.from(new Map(newReleases.map(item => [item.id, item])).values());

            setReleases(uniqueReleases);
            setRadarStatus(uniqueReleases.length > 0 ? `Detected ${uniqueReleases.length} New Signals` : 'No Recent Spectral Changes');

        } catch (err) {
            console.error(err);
            setRadarStatus('SYSTEM SCAN FAILED');
        } finally {
            setRadarLoading(false);
        }
    };

    const addToLibrary = async (id) => {
        try {
            await spotifyFetch('/me/albums', 'PUT', { ids: [id] });
            alert('Committed to Library.');
        } catch (e) {
            alert('Commit failed.');
        }
    };

    const handleHealthCheck = async () => {
        setHealthLoading(true);
        try {
            const [profile, playlists, tracks] = await Promise.all([
                spotifyFetch('/me'),
                spotifyFetch('/me/playlists?limit=50'),
                spotifyFetch('/me/tracks?limit=50')
            ]);

            setHealthStats({
                followers: profile.followers?.total || 0,
                playlists: playlists?.total || 0,
                likedTracks: tracks?.total || 0,
                explicitContent: profile.explicit_content?.filter_enabled ? 'Filtered' : 'Open',
                product: profile.product || 'Standard'
            });

        } catch (err) {
            console.error(err);
        } finally {
            setHealthLoading(false);
        }
    };

    return (
        <div className="py-20 animate-ios26-in max-w-6xl mx-auto px-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full -z-10 animate-ios26-float" />

            <header className="mb-24">
                <button onClick={() => navigate('/dashboard')} className="mb-10 flex items-center text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Index
                </button>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 ml-1">Smart Automation</p>
                        <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-white">
                            Stats Hub
                        </h1>
                    </div>
                </div>
            </header>

            <div className="ios26-tabs p-1.5 flex gap-2 mb-20 max-w-md mx-auto md:mx-0">
                <button
                    onClick={() => setActiveTab('radar')}
                    className={`flex-1 py-4 rounded-[18px] text-[10px] font-black transition-all uppercase tracking-[0.2em] ${activeTab === 'radar' ? 'bg-white text-black shadow-2xl scale-105' : 'text-white/30 hover:text-white'}`}
                >
                    New Releases
                </button>
                <button
                    onClick={() => setActiveTab('health')}
                    className={`flex-1 py-4 rounded-[18px] text-[10px] font-black transition-all uppercase tracking-[0.2em] ${activeTab === 'health' ? 'bg-white text-black shadow-2xl scale-105' : 'text-white/30 hover:text-white'}`}
                >
                    Library Health
                </button>
            </div>

            {activeTab === 'radar' && (
                <div className="animate-ios26-in">
                    <div className="ios26-card p-8 md:p-16 text-center flex flex-col items-center relative overflow-hidden group mb-16">
                        <div className="absolute inset-0 bg-blue-500/[0.02] -z-10 group-hover:scale-110 transition-transform duration-1000" />
                        <div className="w-24 h-24 ios26-liquid rounded-[36px] flex items-center justify-center mb-10 border border-white/20 shadow-2xl">
                            <Radio size={44} className="text-blue-500" strokeWidth={1} />
                        </div>
                        <h2 className="text-5xl font-black mb-4 tracking-tighter uppercase text-white">Release Scan</h2>
                        <p className="text-[10px] text-white/30 mb-12 max-w-sm font-black uppercase tracking-[0.3em] leading-relaxed">Scan followed artists for new releases from the last 14 days.</p>
                        <button
                            onClick={handleCheckRadar}
                            disabled={radarLoading}
                            className="ios26-liquid px-16 py-6 font-black uppercase tracking-[0.3em] text-[10px] text-white border border-white/20 shadow-2xl hover:scale-105 active:scale-95 transition-all"
                        >
                            {radarLoading ? <Loader2 className="animate-spin" size={20} /> : 'Start Scan'}
                        </button>
                        {radarStatus && <p className="mt-8 text-[9px] font-black text-blue-500 uppercase tracking-[0.4em] animate-pulse">{radarStatus}</p>}
                    </div>

                    {releases.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-32">
                            {releases.map(album => (
                                <div key={album.id} className="ios26-card-interactive p-5 group">
                                    <div className="relative mb-6 rounded-[28px] overflow-hidden shadow-2xl ring-1 ring-white/10">
                                        <img src={album.images[0]?.url} className="w-full aspect-square object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-[2000ms]" alt="" />
                                        <div className="absolute top-4 right-4 ios26-glass text-white text-[9px] font-black px-4 py-2 rounded-xl border border-white/20 uppercase tracking-[0.2em] shadow-2xl">
                                            {album.album_type}
                                        </div>
                                    </div>
                                    <div className="px-2">
                                        <h3 className="font-black text-lg truncate mb-1 tracking-tighter uppercase text-white group-hover:text-blue-500 transition-colors leading-none">{album.name}</h3>
                                        <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mt-2">{album.artistMsg}</p>
                                        <div className="flex gap-3 mt-8">
                                            <a
                                                href={album.external_urls.spotify}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex-1 ios26-glass text-white text-center py-4 rounded-[18px] font-black border border-white/10 hover:bg-white/10 transition-all uppercase tracking-[0.2em] text-[9px]"
                                            >
                                                Stream
                                            </a>
                                            <button
                                                onClick={() => addToLibrary(album.id)}
                                                className="w-12 h-12 ios26-liquid flex items-center justify-center border border-white/20 rounded-full hover:scale-110 transition-all text-white shadow-2xl"
                                            >
                                                <PlusCircle size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'health' && (
                <div className="animate-ios26-in">
                    <div className="ios26-card p-16 text-center flex flex-col items-center relative overflow-hidden group mb-16">
                        <div className="absolute inset-0 bg-pink-500/[0.02] -z-10 group-hover:scale-110 transition-transform duration-1000" />
                        <div className="w-24 h-24 ios26-liquid rounded-[36px] flex items-center justify-center mb-10 border border-pink-500/20 shadow-2xl">
                            <Activity size={44} className="text-pink-500" strokeWidth={1} />
                        </div>
                        <h2 className="text-5xl font-black mb-4 tracking-tighter uppercase text-white">Library Insights</h2>
                        <p className="text-[10px] text-white/30 mb-12 max-w-sm font-black uppercase tracking-[0.3em] leading-relaxed">Run a diagnostic of your music library and listening habits.</p>
                        {!healthStats && (
                            <button
                                onClick={handleHealthCheck}
                                disabled={healthLoading}
                                className="ios26-liquid px-16 py-6 font-black uppercase tracking-[0.3em] text-[10px] text-white border border-pink-500/20 shadow-2xl hover:scale-105 active:scale-95 transition-all"
                            >
                                {healthLoading ? <Loader2 className="animate-spin" size={20} /> : 'Analyze Library'}
                            </button>
                        )}
                    </div>

                    {healthStats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-32">
                            {[
                                { label: 'Playlists', value: healthStats.playlists, color: 'text-white' },
                                { label: 'Liked Tracks', value: `${healthStats.likedTracks}`, color: 'text-blue-500' },
                                { label: 'Network', value: healthStats.followers, color: 'text-pink-500' },
                                { label: 'Protocol', value: healthStats.product, color: 'text-purple-400' }
                            ].map((stat, i) => (
                                <div key={i} className="ios26-card p-10 text-center border-white/5 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-white/[0.01] -z-10" />
                                    <h3 className="text-white/20 text-[9px] font-black uppercase tracking-[0.4em] mb-6">{stat.label}</h3>
                                    <p className={`text-6xl font-black tracking-tighter uppercase ${stat.color} group-hover:scale-110 transition-transform duration-700`}>{stat.value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Automation;
