import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { Music, Play, Wand2, BarChart3, Edit3, Trash2, Activity, RefreshCw, Sliders, Layers, Receipt } from 'lucide-react';

const Dashboard = () => {
    const [playlists, setPlaylists] = useState([]);
    const [profile, setProfile] = useState(null);
    const [topArtist, setTopArtist] = useState(null);
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
            const playlistsData = await spotifyFetch('/me/playlists?limit=20');
            if (playlistsData) {
                setPlaylists(playlistsData.items);
            }

            // Fetch Top Artist for "Vibe Check"
            const topArtistsData = await spotifyFetch('/me/top/artists?limit=1&time_range=short_term');
            if (topArtistsData?.items?.length > 0) {
                setTopArtist(topArtistsData.items[0]);
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

    const QuickActionCard = ({ title, icon: Icon, color, onClick, desc }) => (
        <button
            onClick={onClick}
            className="group relative bg-[#181818] p-6 rounded-2xl border border-white/5 hover:border-white/20 transition-all hover:scale-[1.02] text-left overflow-hidden"
        >
            <div className={`absolute top-0 right-0 p-32 bg-${color}-500/5 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2`} />
            <div className={`w-12 h-12 rounded-full bg-${color}-500/10 flex items-center justify-center mb-4 group-hover:bg-${color}-500/20 transition-colors`}>
                <Icon size={24} className={`text-${color}-500`} />
            </div>
            <h3 className="text-lg font-bold mb-1">{title}</h3>
            <p className="text-sm text-gray-400">{desc}</p>
        </button>
    );

    return (
        <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-black p-4 md:p-8 text-white pb-32">
            {/* Header */}
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    {profile?.images?.[0]?.url && (
                        <img src={profile.images[0].url} className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-green-500" alt="Profile" />
                    )}
                    <div>
                        <p className="hidden md:block text-xs text-gray-400 uppercase font-bold tracking-wider">Dashboard</p>
                        <h1 className="text-xl md:text-3xl font-bold">Hi, {profile?.display_name?.split(' ')[0]}</h1>
                    </div>
                </div>
                <button
                    onClick={() => loadData(true)}
                    disabled={refreshing}
                    className={`p-2 rounded-full hover:bg-white/10 transition-all ${refreshing ? 'animate-spin text-green-500' : 'text-gray-400 hover:text-white'}`}
                >
                    <RefreshCw size={20} />
                </button>
            </header>

            {/* Vibe Check Widget */}
            {topArtist && (
                <div
                    className="mb-8 w-full bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-white/10 rounded-2xl p-6 flex items-center justify-between overflow-hidden relative cursor-pointer hover:border-white/20 transition-all"
                    onClick={() => navigate('/stats')}
                >
                    <div className="z-10">
                        <p className="text-xs font-bold text-purple-400 mb-1 uppercase tracking-wider flex items-center gap-2">
                            <Activity size={12} /> Current Vibe
                        </p>
                        <h2 className="text-2xl md:text-3xl font-bold mb-1">{topArtist.name}</h2>
                        <p className="text-sm text-gray-300">Your top artist this month</p>
                    </div>
                    {topArtist.images?.[0] && (
                        <div className="absolute right-0 top-0 h-full w-1/2 md:w-1/3">
                            <div className="absolute inset-0 bg-gradient-to-r from-[#171425] to-transparent z-10" />
                            <img src={topArtist.images[0].url} className="h-full w-full object-cover opacity-60" alt="" />
                        </div>
                    )}
                </div>
            )}

            {/* Quick Actions Grid */}
            <div className="hidden md:block">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Wand2 size={18} className="text-green-500" /> Quick Actions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
                    <QuickActionCard
                        title="AI Generator"
                        desc="Create playlists from prompts"
                        icon={Wand2}
                        color="green"
                        onClick={() => navigate('/ai-generator')}
                    />
                    <QuickActionCard
                        title="Manage"
                        desc="Split, merge, or sort playlists"
                        icon={Edit3}
                        color="purple"
                        onClick={() => navigate('/playlists')}
                    />
                    <QuickActionCard
                        title="Cleanup"
                        desc="Remove duplicates & filler"
                        icon={Trash2}
                        color="red"
                        onClick={() => navigate('/cleanup')}
                    />
                    <QuickActionCard
                        title="Mood Mix"
                        desc="Filter by Vibe/Energy"
                        icon={Sliders}
                        color="yellow"
                        onClick={() => navigate('/mood-mix')}
                    />
                    <QuickActionCard
                        title="Discovery"
                        desc="Swipe to find new gems"
                        icon={Layers}
                        color="blue"
                        onClick={() => navigate('/discovery')}
                    />
                    <QuickActionCard
                        title="Receiptify"
                        desc="Your top tracks receipt"
                        icon={Receipt}
                        color="gray"
                        onClick={() => navigate('/receipt')}
                    />
                    <QuickActionCard
                        title="Full Stats"
                        desc="Deep dive into your taste"
                        icon={BarChart3}
                        color="blue"
                        onClick={() => navigate('/stats')}
                    />
                </div>
            </div>

            {/* Curated Playlists (Horizontal Scroll) */}
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Play size={18} className="text-white" /> Jump Back In
            </h2>
            <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory">
                {playlists.slice(0, 8).map(playlist => (
                    <div
                        key={playlist.id}
                        onClick={() => navigate(`/recommendations/${playlist.id}`)}
                        className="min-w-[140px] md:min-w-[160px] cursor-pointer snap-start"
                    >
                        <div className="relative aspect-square w-full mb-3 rounded-lg overflow-hidden shadow-lg group">
                            {playlist.images?.[0]?.url ? (
                                <img src={playlist.images[0].url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                            ) : (
                                <div className="w-full h-full bg-neutral-800 flex items-center justify-center"><Music className="text-neutral-500" /></div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Play fill="white" size={32} />
                            </div>
                        </div>
                        <h3 className="text-sm font-bold truncate text-white">{playlist.name}</h3>
                        <p className="text-xs text-gray-400 truncate">{playlist.tracks.total} tracks</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
