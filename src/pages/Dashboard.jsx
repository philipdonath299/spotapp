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

            const playlistsData = await spotifyFetch('/me/playlists?limit=20');
            if (playlistsData) setPlaylists(playlistsData.items);

            const topArtistsData = await spotifyFetch('/me/top/artists?limit=1&time_range=short_term');
            if (topArtistsData?.items?.length > 0) setTopArtist(topArtistsData.items[0]);

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
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    const Widget = ({ title, icon: Icon, colorClass, onClick, desc, span = false }) => (
        <button
            onClick={onClick}
            className={`apple-card-interactive p-6 flex flex-col justify-between group relative overflow-hidden text-left ${span ? 'md:col-span-2' : ''}`}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-${colorClass}-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700`} />

            <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-10 border border-white/10 group-hover:bg-white/15 transition-all duration-300 shadow-lg`}>
                <Icon size={28} className={`text-${colorClass}-500`} strokeWidth={1.5} />
            </div>

            <div>
                <h3 className="text-xl font-bold tracking-tight mb-1 group-hover:text-white transition-colors">{title}</h3>
                <p className="text-sm text-gray-500 font-medium group-hover:text-gray-400 transition-colors">{desc}</p>
            </div>
        </button>
    );

    return (
        <div className="py-8 animate-apple-in">
            {/* Apple Style Header */}
            <header className="flex justify-between items-end mb-12">
                <div>
                    <p className="text-blue-500 font-bold text-xs uppercase tracking-[0.2em] mb-2">Welcome back</p>
                    <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter leading-none">
                        {profile?.display_name?.split(' ')[0]}
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => loadData(true)}
                        className={`p-3.5 rounded-full apple-glass-light hover:bg-white/10 transition-all active:scale-90 border border-white/10 shadow-lg ${refreshing ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw size={20} className="text-gray-400" />
                    </button>
                    {profile?.images?.[0]?.url && (
                        <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-blue-500 to-purple-600 shadow-xl">
                            <img src={profile.images[0].url} className="w-full h-full rounded-full border-2 border-black object-cover" alt="Profile" />
                        </div>
                    )}
                </div>
            </header>

            {/* Vibe Check Widget (Hero Style) */}
            {topArtist && (
                <div
                    onClick={() => navigate('/stats')}
                    className="apple-card-interactive mb-12 p-10 flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden group shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"
                >
                    <div className="z-10 flex-1">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]" />
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Current Frequency</p>
                        </div>
                        <h2 className="text-6xl md:text-7xl font-black tracking-tighter mb-4 group-hover:text-blue-400 transition-all duration-500 leading-none">
                            {topArtist.name}
                        </h2>
                        <p className="text-gray-400 font-medium text-xl md:text-2xl">Your top artist this month</p>
                    </div>

                    {topArtist.images?.[0] && (
                        <div className="w-56 h-56 md:w-64 md:h-64 rounded-[40px] overflow-hidden shadow-2xl relative group-hover:rotate-2 transition-transform duration-700">
                            <img src={topArtist.images[0].url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
                            <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-[40px]" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                    )}

                    {/* Background decoration */}
                    <div className="absolute left-0 bottom-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-40" />
                </div>
            )}

            {/* Widgets Section */}
            <div className="mb-12">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-bold tracking-tight">Studio Tools</h2>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <Widget
                        title="Magic Pro"
                        desc="AI Playlists"
                        icon={Wand2}
                        colorClass="blue"
                        onClick={() => navigate('/ai-generator')}
                    />
                    <Widget
                        title="Explore"
                        desc="Discovery Deck"
                        icon={Layers}
                        colorClass="purple"
                        onClick={() => navigate('/discovery')}
                    />
                    <Widget
                        title="Mood Mix"
                        desc="Custom Vibes"
                        icon={Sliders}
                        colorClass="pink"
                        onClick={() => navigate('/mood-mix')}
                    />
                    <Widget
                        title="Vault"
                        desc="Manage library"
                        icon={Edit3}
                        colorClass="orange"
                        onClick={() => navigate('/playlists')}
                    />
                    <Widget
                        title="Analytics"
                        desc="Deep insights"
                        icon={BarChart3}
                        colorClass="green"
                        span
                        onClick={() => navigate('/stats')}
                    />
                    <Widget
                        title="Cleanup"
                        desc="Fix messy library"
                        icon={Trash2}
                        colorClass="red"
                        onClick={() => navigate('/cleanup')}
                    />
                    <Widget
                        title="Receipt"
                        desc="Monthly log"
                        icon={Receipt}
                        colorClass="gray"
                        onClick={() => navigate('/receipt')}
                    />
                </div>
            </div>

            {/* Recent Section */}
            <section className="pb-20">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-bold tracking-tight">Jump Back In</h2>
                    <button className="text-blue-500 font-bold text-sm bg-blue-500/10 px-4 py-1.5 rounded-full hover:bg-blue-500/20 transition-all">See All</button>
                </div>

                <div className="flex overflow-x-auto gap-8 pb-8 no-scrollbar -mx-4 px-4">
                    {playlists.slice(0, 10).map(playlist => (
                        <div
                            key={playlist.id}
                            onClick={() => navigate(`/recommendations/${playlist.id}`)}
                            className="min-w-[180px] cursor-pointer group"
                        >
                            <div className="aspect-square rounded-[36px] overflow-hidden mb-4 relative shadow-[0_12px_24px_-8px_rgba(0,0,0,0.5)] bg-[#1c1c1e] border border-white/5">
                                {playlist.images?.[0]?.url ? (
                                    <img src={playlist.images[0].url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center font-bold text-gray-500">?</div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center border border-white/30 shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
                                        <Play fill="white" size={28} className="ml-1" />
                                    </div>
                                </div>
                            </div>
                            <h3 className="font-bold truncate text-base mb-1 px-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight">{playlist.name}</h3>
                            <p className="text-sm text-gray-500 font-medium px-1">{playlist.tracks.total} tracks</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
