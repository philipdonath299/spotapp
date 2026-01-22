import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { Music, Play, Wand2, BarChart3, Edit3, Trash2, Activity, RefreshCw, Sliders, Layers, Receipt, Loader2, Share2, List as Lists } from 'lucide-react';
import DashboardWidget from '../components/DashboardWidget';

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
            if (playlistsData?.items) setPlaylists(playlistsData.items);

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
                    <Activity className="text-red-500" size={32} />
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



    const [activeTab, setActiveTab] = useState('overview');

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'creative', label: 'Studio' },
        { id: 'analytics', label: 'Analytics' },
        { id: 'discovery', label: 'Library' },
    ];

    return (
        <div className="py-8 md:py-12 min-h-screen relative z-10">
            {/* iOS 26 Header */}
            <header className="flex justify-between items-center mb-10 px-2 relative">
                <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 ml-1 hidden md:block">Your Stats</p>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.85] text-white">
                        {profile?.display_name?.split(' ')[0]}
                    </h1>
                </div>

                <div className="flex items-center gap-4 relative z-10">
                    <button
                        onClick={copySnapshot}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full ios26-glass flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 border border-white/10 group"
                        title="Share Snapshot"
                    >
                        <Share2 size={18} className="text-white/60 group-hover:text-blue-500 transition-colors" />
                    </button>
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

            {/* Compact Tab Navigation */}
            <nav className="mb-10 px-1 overflow-x-auto no-scrollbar">
                <div className="flex gap-2 p-1 ios26-glass rounded-[20px] w-fit mx-auto md:mx-0">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-2 rounded-[16px] text-xs font-bold transition-all duration-300 ${activeTab === tab.id
                                ? 'bg-white text-black shadow-lg scale-105'
                                : 'text-white/50 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </nav>

            <div className="max-w-4xl mx-auto md:mx-0">
                {/* OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        {/* Quick Stats Hero */}
                        {topArtist && (
                            <section className="relative">
                                <div
                                    onClick={() => navigate('/stats')}
                                    className="ios26-card-interactive p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8 group cursor-pointer"
                                >
                                    <div className="z-10 flex-1 text-center md:text-left">
                                        <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(10,132,255,0.8)]" />
                                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Current Vibe</p>
                                        </div>
                                        <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 leading-none text-white">
                                            {topArtist.name}
                                        </h2>
                                        <p className="text-white/40 text-xs font-mono">
                                            {playlists?.length || 0} Playlists • Top Tier
                                        </p>
                                    </div>

                                    {topArtist.images?.[0] && (
                                        <div className="w-40 h-40 md:w-48 md:h-48 relative group shadow-2xl rounded-[40px] overflow-hidden border border-white/10">
                                            <img src={topArtist.images[0].url} className="w-full h-full object-cover" alt="" />
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <DashboardWidget title="Magic" desc="Create" icon={Wand2} colorClass="blue" onClick={() => navigate('/ai-generator')} />
                            <DashboardWidget title="Stats" desc="Analyze" icon={BarChart3} colorClass="green" onClick={() => navigate('/stats')} />
                        </div>
                    </div>
                )}

                {/* CREATIVE TAB */}
                {activeTab === 'creative' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DashboardWidget title="Magic Playlist" desc="AI Generator" icon={Wand2} colorClass="blue" onClick={() => navigate('/ai-generator')} />
                        <DashboardWidget title="Mood Mix" desc="Smart Filters" icon={Sliders} colorClass="purple" onClick={() => navigate('/mood-mix')} />
                        <DashboardWidget title="Liked Sorter" desc="Library Organize" icon={Lists} colorClass="pink" onClick={() => navigate('/liked-sorter')} />
                    </div>
                )}

                {/* ANALYTICS TAB */}
                {activeTab === 'analytics' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DashboardWidget title="Deep Stats" desc="Visual Data" icon={BarChart3} colorClass="green" onClick={() => navigate('/stats')} span />
                        <DashboardWidget title="Receipt" desc="Shareable" icon={Receipt} colorClass="gray" onClick={() => navigate('/receipt')} />
                        <DashboardWidget title="Cleanup" desc="Remove Duplicates" icon={Trash2} colorClass="red" onClick={() => navigate('/cleanup')} />
                    </div>
                )}

                {/* LIBRARY TAB */}
                {activeTab === 'discovery' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <DashboardWidget title="Discovery Deck" desc="Find New Music" icon={Layers} colorClass="orange" onClick={() => navigate('/discovery')} />
                        <DashboardWidget title="Vault" desc="Playlist Manager" icon={Edit3} colorClass="blue" onClick={() => navigate('/playlists')} />
                    </div>
                )}
            </div>


        </div>
    );
};

export default Dashboard;
