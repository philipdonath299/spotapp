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



    const copySnapshot = () => {
        if (!topArtist) return;
        const stats = `🎵 My Music Snapshot\n🔥 Top Artist: ${topArtist.name}\n🎧 Playlists: ${playlists.length}\n🚀 Generated via Statsify Pro`;
        navigator.clipboard.writeText(stats);
        alert("Snapshot copied to clipboard!");
    };

    return (
        <div className="py-12 animate-ios26-in">
            {/* iOS 26 Header */}
            <header className="flex justify-between items-center mb-16 relative">
                <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2 ml-1 hidden md:block">Your Stats</p>
                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.85] text-white">
                        {profile?.display_name?.split(' ')[0]}
                    </h1>
                </div>

                <div className="flex items-center gap-4 md:gap-6 relative z-10">
                    <button
                        onClick={copySnapshot}
                        className="w-12 h-12 md:w-14 md:h-14 rounded-full ios26-glass flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 border border-white/10 group"
                        title="Share Snapshot"
                    >
                        <Share2 size={20} className="text-white/60 group-hover:text-blue-500 transition-colors" />
                    </button>
                    <button
                        onClick={() => loadData(true)}
                        className={`w-12 h-12 md:w-14 md:h-14 rounded-full ios26-glass flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 border border-white/10 group ${refreshing ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw size={20} className="text-white/60 group-hover:text-white transition-colors" />
                    </button>
                    {profile?.images?.[0]?.url && (
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-[28px] md:rounded-[32px] p-0.5 md:p-1 bg-gradient-to-tr from-white/20 to-transparent rotate-3 hover:rotate-0 transition-all duration-700 shadow-2xl overflow-hidden">
                            <img src={profile.images[0].url} className="w-full h-full rounded-[24px] md:rounded-[28px] object-cover" alt="Profile" />
                        </div>
                    )}
                </div>

                {/* Ambient glow behind title */}
                <div className="absolute -left-20 -top-20 w-80 h-80 bg-blue-500/10 blur-[120px] rounded-full -z-10" />
            </header>

            {/* Quick Stats Hero */}
            {topArtist && (
                <section className="mb-24 relative px-1">
                    <div
                        onClick={() => navigate('/stats')}
                        className="ios26-card-interactive p-12 flex flex-col md:flex-row items-center justify-between gap-12 group cursor-pointer"
                    >
                        <div className="z-10 flex-1 text-center md:text-left">
                            <div className="flex items-center justify-center md:justify-start gap-3 mb-4 md:mb-8">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_20px_rgba(10,132,255,0.8)]" />
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Current Vibe</p>
                            </div>
                            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 md:mb-6 leading-none group-hover:scale-[1.02] transition-transform duration-700">
                                {topArtist.name}
                            </h2>
                            <div className="flex items-center justify-center md:justify-start gap-6 text-white/40">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Top Artist</span>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black text-white leading-none">{playlists.length}</span>
                                    <span className="text-[8px] font-black uppercase tracking-widest mt-1">Playlists</span>
                                </div>
                            </div>
                        </div>

                        {topArtist.images?.[0] && (
                            <div className="w-64 h-64 md:w-80 md:h-80 relative group">
                                <div className="absolute inset-0 bg-blue-500/20 blur-[60px] rounded-full scale-75 group-hover:scale-110 transition-transform duration-1000" />
                                <div className="relative w-full h-full rounded-[64px] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/20 -rotate-3 group-hover:rotate-0 transition-all duration-1000">
                                    <img src={topArtist.images[0].url} className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-1000" alt="" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* Section 1: Creative Studio */}
            <div className="mb-20">
                <div className="flex items-baseline gap-4 mb-8 px-2">
                    <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase text-white/90">Creative Studio</h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <DashboardWidget title="Magic Playlist" desc="AI Generator" icon={Wand2} colorClass="blue" onClick={() => navigate('/ai-generator')} />
                    <DashboardWidget title="Mood Mix" desc="Smart Filters" icon={Sliders} colorClass="purple" onClick={() => navigate('/mood-mix')} />
                    <DashboardWidget title="Liked Sorter" desc="Library Organize" icon={Lists} colorClass="pink" onClick={() => navigate('/liked-sorter')} />
                </div>
            </div>

            {/* Section 2: Analytics & Health */}
            <div className="mb-20">
                <div className="flex items-baseline gap-4 mb-8 px-2">
                    <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase text-white/90">Analytics</h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <DashboardWidget title="Deep Stats" desc="Visual Data" icon={BarChart3} colorClass="green" onClick={() => navigate('/stats')} span />
                    <DashboardWidget title="Receipt" desc="Shareable" icon={Receipt} colorClass="gray" onClick={() => navigate('/receipt')} />
                    <DashboardWidget title="Cleanup" desc="Remove Duplicates" icon={Trash2} colorClass="red" onClick={() => navigate('/cleanup')} />
                </div>
            </div>

            {/* Section 3: Exploration */}
            <div className="mb-12">
                <div className="flex items-baseline gap-4 mb-8 px-2">
                    <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase text-white/90">Discovery</h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DashboardWidget title="Discovery Deck" desc="Find New Music" icon={Layers} colorClass="orange" onClick={() => navigate('/discovery')} />
                    <DashboardWidget title="Vault" desc="Playlist Manager" icon={Edit3} colorClass="blue" onClick={() => navigate('/playlists')} />
                </div>
            </div>

            {/* Fluid Playlist Section */}
            <section className="pb-32">
                <div className="flex items-baseline gap-4 mb-10 px-2">
                    <h2 className="text-4xl font-black tracking-tighter uppercase">Library</h2>
                    <button className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors">View All</button>
                    <div className="h-px flex-1 bg-white/5" />
                </div>

                <div className="flex overflow-x-auto gap-10 pb-12 no-scrollbar -mx-4 px-6">
                    {playlists.slice(0, 10).map(playlist => (
                        <div
                            key={playlist.id}
                            onClick={() => navigate(`/recommendations/${playlist.id}`)}
                            className="min-w-[200px] cursor-pointer group"
                        >
                            <div className="aspect-square rounded-[56px] overflow-hidden mb-6 relative ios26-glass ring-1 ring-white/10 group-active:scale-90 transition-all duration-700 shadow-2xl">
                                {playlist.images?.[0]?.url ? (
                                    <img src={playlist.images[0].url} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" alt="" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 group-hover:bg-white/10 transition-colors">
                                        <Music size={40} className="text-white/20 mb-2" />
                                        <span className="text-[8px] font-black text-white/20 tracking-[0.3em]">EMPTY ARCHIVE</span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all duration-700 flex items-center justify-center backdrop-blur-md">
                                    <div className="w-16 h-16 rounded-full ios26-liquid flex items-center justify-center border border-white/20 shadow-2xl scale-50 group-hover:scale-100 transition-transform duration-700">
                                        <Play fill="white" size={24} className="ml-1" />
                                    </div>
                                </div>
                            </div>
                            <div className="px-2 transition-transform duration-500 group-hover:translate-x-1">
                                <h3 className="font-black truncate text-lg mb-1 tracking-tighter uppercase group-hover:text-blue-500 transition-colors">{playlist.name}</h3>
                                <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em]">{playlist.tracks.total} units</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Dashboard;
