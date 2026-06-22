import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { Wand2, Edit3, RefreshCw, Loader2, Disc } from 'lucide-react';
import DashboardWidget from '../components/DashboardWidget';

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

            const playlistsData = await spotifyFetch('/me/playlists?limit=20');
            if (playlistsData?.items) setPlaylists(playlistsData.items);

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
            <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
                <Loader2 className="animate-spin text-blue-500" size={48} />
                <p className="text-white/50 font-mono text-sm tracking-widest uppercase animate-pulse">Loading Data...</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center space-y-6 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                    <RefreshCw className="text-red-500" size={32} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Connection Error</h2>
                    <p className="text-white/50 max-w-md">Could not load your profile data. Please try again or re-login.</p>
                </div>
                <button
                    onClick={() => window.location.href = '/'}
                    className="px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
                >
                    Re-Login
                </button>
            </div>
        );
    }

    return (
        <div className="py-8 md:py-12 min-h-screen relative z-10">
            {/* iOS 26 Header */}
            <header className="flex justify-between items-center mb-10 px-2 relative">
                <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 ml-1 hidden md:block">Welcome Back</p>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.85] text-white">
                        {profile?.display_name?.split(' ')[0]}
                    </h1>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <button
                        onClick={() => loadData(true)}
                        className={`w-10 h-10 md:w-12 md:h-12 rounded-full ios26-glass flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 border border-white/10 group ${refreshing ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw size={18} className="text-white/60 group-hover:text-white transition-colors" />
                    </button>
                    {profile?.images?.[0]?.url && (
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-[20px] md:rounded-[24px] p-0.5 md:p-1 bg-gradient-to-tr from-white/20 to-transparent rotate-3 hover:rotate-0 transition-all duration-700 shadow-2xl overflow-hidden">
                            <img src={profile.images[0].url} className="w-full h-full rounded-[18px] md:rounded-[22px] object-cover" alt="Profile" />
                        </div>
                    )}
                </div>
            </header>

            <div className="max-w-4xl mx-auto md:mx-0">
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DashboardWidget
                            title="Playlist Manager"
                            desc="Organize, sort, and edit your library"
                            icon={Edit3}
                            colorClass="blue"
                            onClick={() => navigate('/playlists')}
                        />
                        <DashboardWidget
                            title="AI Generator"
                            desc="Create magic playlists with prompts"
                            icon={Wand2}
                            colorClass="purple"
                            onClick={() => navigate('/ai-generator')}
                        />
                        <DashboardWidget
                            title="Vinyl Scanner"
                            desc="Find vinyl releases of top albums"
                            icon={Disc}
                            colorClass="orange"
                            onClick={() => navigate('/vinyl-scanner')}
                            span
                        />
                    </div>

                    <div className="mt-12 ios26-glass p-8 rounded-[32px] border border-white/5">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20 mb-4">Library Summary</p>
                        <div className="flex items-center gap-8">
                            <div>
                                <h3 className="text-4xl font-black text-white">{playlists.length}</h3>
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Playlists</p>
                            </div>
                            <div className="w-[1px] h-12 bg-white/10" />
                            <div>
                                <h3 className="text-4xl font-black text-white">Active</h3>
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Connection</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
