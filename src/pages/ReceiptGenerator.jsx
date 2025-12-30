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

            // Calculate total duration
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
        <div className="py-8 animate-apple-in max-w-2xl mx-auto px-4 pb-24">
            <header className="mb-12">
                <button onClick={() => navigate('/dashboard')} className="mb-6 flex items-center text-blue-500 font-bold text-sm hover:underline">
                    <ArrowLeft size={16} className="mr-1" /> Dashboard
                </button>
                <h1 className="text-5xl font-extrabold tracking-tighter">Receiptify</h1>
                <p className="text-gray-500 text-xl font-medium mt-1">Your musical transactions.</p>
            </header>

            <div className="flex gap-2 mb-12 bg-white/5 p-1 rounded-full p-1 border border-white/5">
                {[
                    { id: 'short_term', label: 'Last Month' },
                    { id: 'medium_term', label: '6 Months' },
                    { id: 'long_term', label: 'All Time' }
                ].map(r => (
                    <button
                        key={r.id}
                        onClick={() => setRange(r.id)}
                        className={`flex-1 py-2 px-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${range === r.id ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}
                    >
                        {r.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-col items-center">
                {loading ? (
                    <div className="py-20 flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-blue-500" size={40} />
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Printing your receipt...</p>
                    </div>
                ) : (
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-white/10 blur-2xl rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <div className="bg-white text-black p-8 font-mono text-sm shadow-2xl relative receipt-paper max-w-[360px] transform-gpu transition-all duration-500 hover:scale-[1.02] hover:-rotate-1">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-black tracking-widest mb-1">SPOTIFY</h2>
                                <p className="text-[10px] font-bold">STORE ID: {profile?.id?.toUpperCase() || 'GUEST'}</p>
                                <p className="text-[10px] font-bold">{date}</p>
                            </div>

                            <div className="border-b-2 border-dashed border-black/20 mb-6" />

                            <div className="flex justify-between font-black text-[10px] tracking-widest border-b border-black/10 pb-2 mb-4">
                                <span>QTY</span>
                                <span className="flex-1 ml-4 text-left">ITEM</span>
                                <span>AMT</span>
                            </div>

                            <ul className="space-y-3 mb-8">
                                {tracks.map((track, i) => (
                                    <li key={track.id} className="flex justify-between items-start gap-3">
                                        <span className="text-[10px] font-bold mt-0.5">{(i + 1).toString().padStart(2, '0')}</span>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="truncate uppercase font-black text-xs tracking-tight">{track.name}</div>
                                            <div className="truncate text-[10px] font-bold text-gray-500">{track.artists[0].name.toUpperCase()}</div>
                                        </div>
                                        <span className="whitespace-nowrap tabular-nums text-xs font-bold">{formatTime(track.duration_ms)}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="border-b-2 border-dashed border-black/20 mb-6" />

                            <div className="space-y-2 mb-8 uppercase text-xs font-black">
                                <div className="flex justify-between">
                                    <span>ITEM COUNT:</span>
                                    <span>{tracks.length}</span>
                                </div>
                                <div className="flex justify-between text-lg tracking-tighter">
                                    <span>TOTAL:</span>
                                    <span>{totalDuration}</span>
                                </div>
                            </div>

                            <div className="text-center space-y-1 mb-8">
                                <p className="text-[10px] font-bold text-gray-400">CARD #: **** **** **** {Math.floor(Math.random() * 9000) + 1000}</p>
                                <p className="text-[10px] font-bold text-gray-400">AUTH CODE: {Math.floor(Math.random() * 100000)}</p>
                                <p className="text-[10px] font-black">CARDHOLDER: {profile?.display_name?.toUpperCase()}</p>
                            </div>

                            <div className="text-center">
                                <p className="mb-4 font-black text-[10px] tracking-widest">THANK YOU FOR LISTENING!</p>
                                <div className="h-16 bg-black w-3/4 mx-auto" style={{
                                    maskImage: 'repeating-linear-gradient(90deg, black, black 2px, transparent 2px, transparent 4px)',
                                    WebkitMaskImage: 'repeating-linear-gradient(90deg, black, black 2px, transparent 2px, transparent 4px)'
                                }} />
                                <p className="text-[9px] mt-2 font-bold tracking-[0.2em] text-gray-400">{profile?.uri?.split(':')[2] || 'SAMPLE-CODE'}</p>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && (
                    <div className="mt-12 flex flex-col items-center gap-6 animate-apple-in">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Take a screenshot to share your vibe</p>
                        <button className="apple-glass-light px-8 py-3 rounded-full flex items-center gap-2 text-sm font-bold text-white hover:bg-white/10 transition-all active:scale-95 border border-white/5">
                            <Download size={18} /> Download Image
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .receipt-paper {
                    mask-image: linear-gradient(180deg, white 0%, white 99%, transparent 100%), radial-gradient(circle at 50% 100%, transparent 8px, white 9px);
                    -webkit-mask-image: linear-gradient(180deg, white 0%, white 99%, transparent 100%), radial-gradient(circle at 50% 100%, transparent 8px, white 9px);
                    mask-position: bottom;
                    mask-size: 100% 100%, 20px 20px;
                    mask-repeat: no-repeat, repeat-x;
                    padding-bottom: 40px;
                }
            `}</style>
        </div>
    );
};
};

export default ReceiptGenerator;
