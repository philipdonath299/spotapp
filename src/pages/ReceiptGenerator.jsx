import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Download, Loader2, Receipt } from 'lucide-react';

const ReceiptGenerator = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const [profile, setProfile] = useState(null);
    const [totalDuration, setTotalDuration] = useState('00:00');
    const [date, setDate] = useState('');
    const [range, setRange] = useState('short_term'); // short_term, medium_term, long_term

    useEffect(() => {
        const now = new Date();
        setDate(now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).toUpperCase());
        fetchData(range);
    }, [range]);

    const fetchData = async (currentRange) => {
        setLoading(true);
        try {
            const [profileData, tracksData] = await Promise.all([
                spotifyFetch('/me'),
                spotifyFetch(`/me/top/tracks?limit=15&time_range=${currentRange}`)
            ]);

            setProfile(profileData);
            setTracks(tracksData.items);

            const totalMs = tracksData.items.reduce((acc, t) => acc + t.duration_ms, 0);
            const minutes = Math.floor(totalMs / 60000);
            const seconds = ((totalMs % 60000) / 1000).toFixed(0);
            setTotalDuration(`${minutes}:${seconds.padStart(2, '0')}`);

        } catch (err) {
            console.error("Failed to generate receipt:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (ms) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return `${minutes}:${seconds.padStart(2, '0')}`;
    };

    return (
        <div className="py-20  max-w-4xl mx-auto px-6 relative overflow-hidden pb-40">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 blur-[120px] rounded-full -z-10 animate-ios26-float" />

            <header className="mb-24 text-center md:text-left">
                <button onClick={() => navigate('/dashboard')} className="mb-10 flex items-center justify-center md:justify-start text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Dashboard
                </button>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 ml-1">Your Receipt</p>
                    <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-white">
                        Snapshot
                    </h1>
                </div>
            </header>

            <div className="ios26-tabs p-1.5 flex gap-2 mb-20 max-w-lg mx-auto md:mx-0">
                {[
                    { id: 'short_term', label: 'Last Month' },
                    { id: 'medium_term', label: 'Last 6 Months' },
                    { id: 'long_term', label: 'All History' }
                ].map(r => (
                    <button
                        key={r.id}
                        onClick={() => setRange(r.id)}
                        className={`flex-1 py-4 rounded-[18px] text-[10px] font-black transition-all uppercase tracking-[0.2em] ${range === r.id ? 'bg-white text-black shadow-2xl scale-105' : 'text-white/30 hover:text-white'}`}
                    >
                        {r.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-col items-center">
                {loading ? (
                    <div className="py-20 flex flex-col items-center gap-6">
                        <Loader2 className="animate-spin text-white" size={44} />
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Generating your receipt...</p>
                    </div>
                ) : (
                    <div className="ios26-card p-0.5 md:p-1 relative group overflow-visible">
                        <div className="absolute -inset-10 bg-white/[0.03] blur-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                        <div className="bg-white text-black p-6 md:p-10 font-mono text-sm shadow-2xl relative receipt-paper max-w-[340px] md:max-w-[380px] transform-gpu transition-all duration-700 hover:rotate-1 hover:scale-[1.03]">
                            <div className="text-center mb-10">
                                <h2 className="text-4xl font-black tracking-widest mb-2">STATSIFY</h2>
                                <p className="text-[10px] font-black tracking-widest uppercase mb-1">User: {profile?.id || 'ANONYMOUS'}</p>
                                <p className="text-[10px] font-black tracking-widest uppercase opacity-60">{date}</p>
                            </div>

                            <div className="border-b-2 border-dashed border-black/20 mb-8" />

                            <div className="flex justify-between font-black text-[10px] tracking-[0.2em] border-b border-black/10 pb-3 mb-6">
                                <span>ID</span>
                                <span className="flex-1 ml-6 text-left">SIGNAL</span>
                                <span className="text-right">MS</span>
                            </div>

                            <ul className="space-y-4 mb-10">
                                {tracks.map((track, i) => (
                                    <li key={track.id} className="flex justify-between items-start gap-4">
                                        <span className="text-[10px] font-black opacity-40">{(i + 1).toString().padStart(2, '0')}</span>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="truncate uppercase font-black text-xs tracking-tight">{track.name}</div>
                                            <div className="truncate text-[9px] font-black opacity-50">{track.artists?.[0]?.name?.toUpperCase() || 'UNKNOWN'}</div>
                                        </div>
                                        <span className="whitespace-nowrap tabular-nums text-xs font-black">{formatTime(track.duration_ms)}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="border-b-2 border-dashed border-black/20 mb-8" />

                            <div className="space-y-3 mb-10 uppercase text-xs font-black">
                                <div className="flex justify-between items-center opacity-40">
                                    <span className="text-[10px]">TOTAL UNITS</span>
                                    <span className="text-sm">{tracks.length}</span>
                                </div>
                                <div className="flex justify-between items-end tracking-tighter">
                                    <span className="text-sm">TOTAL PULSE</span>
                                    <span className="text-2xl">{totalDuration}</span>
                                </div>
                            </div>

                            <div className="text-center space-y-2 mb-10 pt-4 border-t border-black/5">
                                <p className="text-[9px] font-black opacity-30 tracking-widest">LOG ID: {Math.floor(Math.random() * 10000000)}</p>
                                <p className="text-[9px] font-black tracking-[0.2em]">{profile?.display_name?.toUpperCase()}</p>
                            </div>

                            <div className="text-center">
                                <p className="mb-6 font-black text-[10px] tracking-widest uppercase">Thank you for listening.</p>
                                <div className="h-20 bg-black w-full" style={{
                                    maskImage: 'repeating-linear-gradient(90deg, black, black 3px, transparent 3px, transparent 6px)',
                                    WebkitMaskImage: 'repeating-linear-gradient(90deg, black, black 3px, transparent 3px, transparent 6px)'
                                }} />
                                <p className="text-[8px] mt-4 font-black tracking-[0.4em] opacity-30">{profile?.uri?.split(':')[2] || 'VORTEX-DATA'}</p>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && (
                    <div className="mt-24 flex flex-col items-center gap-8 ">
                        <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.5em]">Capture and broadcast your terminal state</p>
                        <button className="ios26-liquid px-12 py-5 rounded-[22px] flex items-center gap-4 text-[10px] font-black text-white hover:scale-110 transition-all active:scale-95 border border-white/20 shadow-2xl uppercase tracking-[0.3em]">
                            <Download size={20} /> Export Signal
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .receipt-paper {
                    mask-image: linear-gradient(180deg, white 0%, white 99.5%, transparent 100%), radial-gradient(circle at 50% 100%, transparent 12px, white 13px);
                    -webkit-mask-image: linear-gradient(180deg, white 0%, white 99.5%, transparent 100%), radial-gradient(circle at 50% 100%, transparent 12px, white 13px);
                    mask-position: bottom;
                    mask-size: 100% 100%, 28px 24px;
                    mask-repeat: no-repeat, repeat-x;
                    padding-bottom: 60px;
                }
            `}</style>
        </div>
    );
};

export default ReceiptGenerator;
