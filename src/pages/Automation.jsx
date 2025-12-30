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
        setRadarStatus('Fetching followed artists...');
        setReleases([]);

        try {
            // 1. Get Followed Artists (limit 50 for speed, users might have more but let's start small)
            const artistsData = await spotifyFetch('/me/following?type=artist&limit=50');
            const artists = artistsData.artists.items;

            setRadarStatus(`Checking releases from ${artists.length} artists...`);

            const newReleases = [];
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

            // 2. Parallel fetch latest albums for each artist
            const promises = artists.map(async (artist) => {
                try {
                    const albumsData = await spotifyFetch(`/artists/${artist.id}/albums?include_groups=album,single&limit=5`);
                    if (albumsData?.items) {
                        albumsData.items.forEach(album => {
                            const releaseDate = new Date(album.release_date);
                            if (releaseDate >= twoWeeksAgo) {
                                newReleases.push({
                                    ...album,
                                    artistMsg: `New from ${artist.name}`
                                });
                            }
                        });
                    }
                } catch (e) {
                    // Ignore individual failures
                }
            });

            await Promise.all(promises);

            // Sort by date new to old
            newReleases.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

            // Deduplicate by ID
            const uniqueReleases = Array.from(new Map(newReleases.map(item => [item.id, item])).values());

            setReleases(uniqueReleases);
            setRadarStatus(uniqueReleases.length > 0 ? `Found ${uniqueReleases.length} new releases!` : 'No recent releases found.');

        } catch (err) {
            console.error(err);
            setRadarStatus('Failed to check releases.');
        } finally {
            setRadarLoading(false);
        }
    };

    const addToLibrary = async (id) => {
        try {
            await spotifyFetch('/me/albums', 'PUT', { ids: [id] });
            alert('Added to library!');
        } catch (e) {
            alert('Failed to save.');
        }
    };

    const handleHealthCheck = async () => {
        setHealthLoading(true);
        try {
            // Fetch simplified stats
            const [profile, playlists, tracks] = await Promise.all([
                spotifyFetch('/me'),
                spotifyFetch('/me/playlists?limit=50'),
                spotifyFetch('/me/tracks?limit=50')
            ]);

            setHealthStats({
                followers: profile.followers.total,
                playlists: playlists.total,
                likedTracks: tracks.total,
                explicitContent: profile.explicit_content?.filter_enabled ? 'Filtered' : 'Allowed',
                product: profile.product // 'premium'
            });

        } catch (err) {
            console.error(err);
        } finally {
            setHealthLoading(false);
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
                    <div className="p-5 bg-blue-500/10 rounded-[32px] border border-blue-500/20 shadow-2xl">
                        <Activity className="text-blue-500" size={48} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none uppercase">Hub Pro</h1>
                        <p className="text-gray-400 text-xl font-bold mt-2 tracking-tight">Manual triggers for high-precision library management.</p>
                    </div>
                </div>
            </header>

            <div className="flex gap-8 border-b border-white/10 mb-14 px-4">
                <button onClick={() => setActiveTab('radar')} className={`pb-5 px-1 font-black transition-all uppercase tracking-widest text-xs relative ${activeTab === 'radar' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
                    Release Radar
                    {activeTab === 'radar' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />}
                </button>
                <button onClick={() => setActiveTab('health')} className={`pb-5 px-1 font-black transition-all uppercase tracking-widest text-xs relative ${activeTab === 'health' ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
                    Health Report
                    {activeTab === 'health' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />}
                </button>
            </div>

            {activeTab === 'radar' && (
                <div className="animate-apple-in px-4">
                    <div className="apple-glass p-12 rounded-[48px] border border-white/15 mb-14 flex flex-col items-center text-center shadow-2xl">
                        <div className="w-20 h-20 bg-blue-500/10 rounded-[32px] flex items-center justify-center mb-10 border border-blue-500/20 shadow-2xl">
                            <Radio size={40} className="text-blue-500" strokeWidth={1.5} />
                        </div>
                        <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase">Radar System</h2>
                        <p className="text-gray-400 mb-10 max-w-md font-bold text-lg tracking-tight">
                            Scan your followed artists for deep cuts and hidden releases from the last 14 days.
                        </p>
                        <button
                            onClick={handleCheckRadar}
                            disabled={radarLoading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-5 rounded-3xl font-black transition-all flex items-center gap-4 shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] uppercase tracking-widest text-sm"
                        >
                            {radarLoading ? <Loader2 className="animate-spin" size={24} /> : <PlayCircle size={24} />}
                            {radarLoading ? 'Scanning Frequencies...' : 'Run Scan'}
                        </button>
                        {radarStatus && <p className="mt-8 text-sm font-black text-blue-400 uppercase tracking-widest animate-pulse">{radarStatus}</p>}
                    </div>

                    {releases.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-32">
                            {releases.map(album => (
                                <div key={album.id} className="apple-card-interactive p-5 group shadow-2xl">
                                    <div className="relative mb-6 rounded-[32px] overflow-hidden shadow-2xl border border-white/10">
                                        <img src={album.images[0]?.url} className="w-full aspect-square object-cover group-hover:scale-110 transition-transform duration-[2000ms]" alt="" />
                                        <div className="absolute top-4 right-4 apple-glass text-white text-[10px] font-black px-3 py-1.5 rounded-xl border border-white/20 uppercase tracking-widest">
                                            {album.album_type}
                                        </div>
                                    </div>
                                    <div className="px-1">
                                        <h3 className="font-black text-xl truncate mb-1 tracking-tighter uppercase leading-[1.1] group-hover:text-blue-400 transition-colors">{album.name}</h3>
                                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-6 opacity-80">{album.artistMsg}</p>
                                        <div className="flex gap-3">
                                            <a
                                                href={album.external_urls.spotify}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex-1 bg-white text-black text-center py-3.5 rounded-2xl font-black hover:bg-gray-200 transition-all uppercase tracking-widest text-[10px]"
                                            >
                                                Listen
                                            </a>
                                            <button
                                                onClick={() => addToLibrary(album.id)}
                                                className="p-3.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-white shadow-xl"
                                                title="Save to Library"
                                            >
                                                <PlusCircle size={22} />
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
                <div className="animate-apple-in px-4">
                    <div className="apple-glass p-12 rounded-[48px] border border-white/15 mb-14 flex flex-col items-center text-center shadow-2xl">
                        <div className="w-20 h-20 bg-pink-500/10 rounded-[32px] flex items-center justify-center mb-10 border border-pink-500/20 shadow-2xl">
                            <Heart size={40} className="text-pink-500" strokeWidth={1.5} />
                        </div>
                        <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase">Health Diagnostics</h2>
                        <p className="text-gray-400 mb-10 max-w-md font-bold text-lg tracking-tight">
                            Generate a comprehensive profile of your digital listening environment.
                        </p>
                        {!healthStats && (
                            <button
                                onClick={handleHealthCheck}
                                disabled={healthLoading}
                                className="bg-pink-600 hover:bg-pink-500 text-white px-12 py-5 rounded-3xl font-black transition-all flex items-center gap-4 shadow-[0_20px_40px_-10px_rgba(236,72,153,0.4)] uppercase tracking-widest text-sm"
                            >
                                {healthLoading ? <Loader2 className="animate-spin" size={24} /> : <Activity size={24} />}
                                {healthLoading ? 'Analyzing Body...' : 'Generate Report'}
                            </button>
                        )}
                    </div>

                    {healthStats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-32">
                            {[
                                { label: 'Playlists', value: healthStats.playlists, color: 'text-white' },
                                { label: 'Liked Tracks', value: `${healthStats.likedTracks}+`, color: 'text-blue-500' },
                                { label: 'Followers', value: healthStats.followers, color: 'text-pink-500' },
                                { label: 'Status', value: healthStats.product, color: 'text-purple-400' }
                            ].map((stat, i) => (
                                <div key={i} className="apple-card-interactive p-8 text-center border-white/10">
                                    <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">{stat.label}</h3>
                                    <p className={`text-5xl font-black tracking-tighter uppercase ${stat.color}`}>{stat.value}</p>
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
