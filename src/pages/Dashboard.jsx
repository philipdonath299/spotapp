import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { Music, Play, Wand2, BarChart3, Edit3, Trash2, Activity, RefreshCw } from 'lucide-react';

const Dashboard = () => {
    const [playlists, setPlaylists] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const navigate = useNavigate();

    const loadData = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const profileData = await spotifyFetch('/me');
            if (!profileData) {
                navigate('/');
                return;
            }
            setProfile(profileData);

            // Fetch user's playlists
            const playlistsData = await spotifyFetch('/me/playlists?limit=50');
            if (playlistsData) {
                setPlaylists(playlistsData.items);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-black p-4 md:p-8 text-white">
            <header className="flex flex-col xl:flex-row justify-between items-center mb-12 gap-8">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500 text-center md:text-left">
                        Hello, {profile?.display_name}
                    </h1>
                    <button
                        onClick={() => loadData(true)}
                        disabled={refreshing}
                        className={`p-2 rounded-full hover:bg-white/10 transition-all ${refreshing ? 'animate-spin text-green-500' : 'text-gray-400 hover:text-white'}`}
                        title="Refresh Library"
                    >
                        <RefreshCw size={24} />
                    </button>
                </div>

                <div className="flex flex-wrap justify-center xl:justify-end gap-3">
                    <button
                        onClick={() => navigate('/stats')}
                        className="flex items-center gap-2 bg-[#181818] border border-neutral-800 text-white px-5 py-2 rounded-full font-bold hover:bg-[#282828] hover:border-green-500/50 transition-all hover:scale-105 shadow-lg text-sm"
                    >
                        <BarChart3 size={18} className="text-green-500" /> My Stats
                    </button>
                    <button
                        onClick={() => navigate('/playlists')}
                        className="flex items-center gap-2 bg-[#181818] border border-neutral-800 text-white px-5 py-2 rounded-full font-bold hover:bg-[#282828] hover:border-purple-500/50 transition-all hover:scale-105 shadow-lg text-sm"
                    >
                        <Edit3 size={18} className="text-purple-500" /> Playlist Manager
                    </button>
                    <button
                        onClick={() => navigate('/cleanup')}
                        className="flex items-center gap-2 bg-[#181818] border border-neutral-800 text-white px-5 py-2 rounded-full font-bold hover:bg-[#282828] hover:border-red-500/50 transition-all hover:scale-105 shadow-lg text-sm"
                    >
                        <Trash2 size={18} className="text-red-500" /> Cleanup
                    </button>
                    <button
                        onClick={() => navigate('/ai-generator')}
                        className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-blue-500 text-black px-5 py-2 rounded-full font-bold hover:opacity-90 transition-all hover:scale-105 shadow-lg shadow-green-500/20 text-sm md:text-base"
                    >
                        <Wand2 size={18} /> AI Magic
                    </button>
                    <button
                        onClick={() => {
                            localStorage.clear();
                            navigate('/');
                        }}
                        className="text-sm text-gray-400 hover:text-white transition-colors px-2"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <h2 className="text-2xl font-bold mb-6">Select a Playlist to Discover New Music</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
                {playlists.map((playlist, index) => (
                    <div
                        key={playlist.id}
                        className="group relative bg-[#181818] p-4 rounded-lg hover:bg-[#282828] transition-all duration-300 cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => navigate(`/recommendations/${playlist.id}`)}
                    >
                        <div className="relative aspect-square w-full mb-4 shadow-lg overflow-hidden rounded-md">
                            {playlist.images?.[0]?.url ? (
                                <img
                                    src={playlist.images[0].url}
                                    alt={playlist.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            ) : (
                                <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                                    <Music className="w-12 h-12 text-gray-600" />
                                </div>
                            )}
                            {/* Play Button Overlay */}
                            <div className="absolute bottom-2 right-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 shadow-xl">
                                <div className="bg-green-500 rounded-full p-3 text-black">
                                    <Play fill="currentColor" size={20} />
                                </div>
                            </div>
                        </div>
                        <h3 className="font-bold truncate text-white mb-1" title={playlist.name}>
                            {playlist.name}
                        </h3>
                        <p className="text-sm text-gray-400 truncate">
                            By {playlist.owner.display_name}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
