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
            <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft className="mr-2" size={20} /> Back to Dashboard
            </button>

            <header className="mb-8">
                <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
                    <Activity className="text-blue-500" /> Automation Hub
                </h1>
                <p className="text-gray-400">Manual triggers for smart library management.</p>
            </header>

            <div className="flex gap-4 border-b border-neutral-800 mb-8 overflow-x-auto">
                <button onClick={() => setActiveTab('radar')} className={`pb-4 px-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'radar' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-white'}`}>
                    Release Radar
                </button>
                <button onClick={() => setActiveTab('health')} className={`pb-4 px-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'health' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-white'}`}>
                    Health Report
                </button>
            </div>

            {activeTab === 'radar' && (
                <div className="animate-slide-up">
                    <div className="bg-[#181818] p-8 rounded-2xl border border-neutral-800 mb-8 flex flex-col items-center text-center">
                        <Radio size={48} className="text-blue-500 mb-4" />
                        <h2 className="text-2xl font-bold mb-2">Check for New Releases</h2>
                        <p className="text-gray-400 mb-6 max-w-md">
                            Scan your followed artists for albums/singles released in the last 2 weeks that you might have missed.
                        </p>
                        <button
                            onClick={handleCheckRadar}
                            disabled={radarLoading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-bold transition-all flex items-center gap-2"
                        >
                            {radarLoading ? <Loader2 className="animate-spin" /> : <PlayCircle />}
                            {radarLoading ? 'Scanning...' : 'Run Radar Scan'}
                        </button>
                        {radarStatus && <p className="mt-4 text-sm font-bold text-blue-400">{radarStatus}</p>}
                    </div>

                    {releases.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {releases.map(album => (
                                <div key={album.id} className="bg-[#181818] rounded-xl overflow-hidden hover:bg-[#202020] transition-all group">
                                    <div className="relative">
                                        <img src={album.images[0]?.url} className="w-full aspect-square object-cover" alt="" />
                                        <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded shadow">
                                            {album.album_type.toUpperCase()}
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-bold text-lg truncate mb-1">{album.name}</h3>
                                        <p className="text-gray-400 text-sm mb-4">{album.artistMsg}</p>
                                        <div className="flex gap-2">
                                            <a
                                                href={album.external_urls.spotify}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex-1 bg-white text-black text-center py-2 rounded-full font-bold hover:scale-105 transition-transform"
                                            >
                                                Listen
                                            </a>
                                            <button
                                                onClick={() => addToLibrary(album.id)}
                                                className="p-2 border border-neutral-600 rounded-full hover:border-white hover:text-white text-gray-400 transition-colors"
                                                title="Save to Library"
                                            >
                                                <PlusCircle size={24} />
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
                <div className="animate-slide-up">
                    <div className="bg-[#181818] p-8 rounded-2xl border border-neutral-800 mb-8 flex flex-col items-center text-center">
                        <Heart size={48} className="text-pink-500 mb-4" />
                        <h2 className="text-2xl font-bold mb-2">Library Checkup</h2>
                        <p className="text-gray-400 mb-6">
                            Get a quick snapshot of your library's status and variety.
                        </p>
                        {!healthStats && (
                            <button
                                onClick={handleHealthCheck}
                                disabled={healthLoading}
                                className="bg-pink-600 hover:bg-pink-500 text-white px-8 py-3 rounded-full font-bold transition-all flex items-center gap-2"
                            >
                                {healthLoading ? <Loader2 className="animate-spin" /> : <Activity />}
                                {healthLoading ? 'Analyzing...' : 'Generate Report'}
                            </button>
                        )}
                    </div>

                    {healthStats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-[#202020] p-6 rounded-xl border border-neutral-800 text-center">
                                <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">Playlists</h3>
                                <p className="text-4xl font-black text-white">{healthStats.playlists}</p>
                            </div>
                            <div className="bg-[#202020] p-6 rounded-xl border border-neutral-800 text-center">
                                <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">Liked Songs</h3>
                                <p className="text-4xl font-black text-green-500">{healthStats.likedTracks}+</p>
                            </div>
                            <div className="bg-[#202020] p-6 rounded-xl border border-neutral-800 text-center">
                                <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">Followers</h3>
                                <p className="text-4xl font-black text-blue-500">{healthStats.followers}</p>
                            </div>
                            <div className="bg-[#202020] p-6 rounded-xl border border-neutral-800 text-center">
                                <h3 className="text-gray-500 text-sm font-bold uppercase mb-2">Status</h3>
                                <p className="text-xl font-bold text-purple-400 mt-2 capitalize">{healthStats.product}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Automation;
