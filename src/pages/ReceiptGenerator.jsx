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

    useEffect(() => {
        const now = new Date();
        setDate(now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).toUpperCase());
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [profileData, tracksData] = await Promise.all([
                spotifyFetch('/me'),
                spotifyFetch('/me/top/tracks?limit=15&time_range=short_term') // Last 4 weeks
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
        <div className="min-h-screen bg-black text-white p-4 md:p-8 flex flex-col items-center pb-20 animate-fade-in">
            <button
                onClick={() => navigate('/dashboard')}
                className="self-start hidden md:flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft className="mr-2" size={20} /> Back to Dashboard
            </button>

            <div className="w-full max-w-md">
                <header className="mb-8 text-center md:text-left">
                    <h1 className="text-3xl font-bold mb-2 flex items-center justify-center md:justify-start gap-3">
                        <Receipt className="text-gray-400" /> Receiptify
                    </h1>
                    <p className="text-gray-500 text-sm">Your top tracks this month, served fresh.</p>
                </header>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-white" size={40} />
                    </div>
                ) : (
                    <div className="bg-white text-black p-6 font-mono text-sm shadow-2xl rotate-1 filter drop-shadow-xl relative mx-auto receipt-paper">
                        {/* Receipt Texture/Effect could go here with CSS */}

                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold tracking-widest mb-1">SPOTIFY</h2>
                            <p className="text-xs">STORE ID: {profile?.id || 'GUEST'}</p>
                            <p className="text-xs">{date}</p>
                        </div>

                        <div className="border-b-2 border-dashed border-black mb-4"></div>

                        <div className="flex justify-between font-bold mb-2">
                            <span>QTY</span>
                            <span>ITEM</span>
                            <span>AMT</span>
                        </div>

                        <ul className="space-y-2 mb-6">
                            {tracks.map((track, i) => (
                                <li key={track.id} className="flex justify-between items-start gap-2">
                                    <span>{(i + 1).toString().padStart(2, '0')}</span>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="truncate uppercase font-bold">{track.name}</div>
                                        <div className="truncate text-xs text-gray-600">{track.artists[0].name.toUpperCase()}</div>
                                    </div>
                                    <span className="whitespace-nowrap">{formatTime(track.duration_ms)}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="border-b-2 border-dashed border-black mb-4"></div>

                        <div className="flex justify-between font-bold text-lg mb-2">
                            <span>ITEM COUNT:</span>
                            <span>{tracks.length}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg mb-6">
                            <span>TOTAL:</span>
                            <span>{totalDuration}</span>
                        </div>

                        <div className="text-center space-y-2 mb-6">
                            <p className="text-xs">CARD #: **** **** **** {Math.floor(Math.random() * 9000) + 1000}</p>
                            <p className="text-xs">AUTH CODE: {Math.floor(Math.random() * 100000)}</p>
                            <p className="text-xs">CARDHOLDER: {profile?.display_name?.toUpperCase()}</p>
                        </div>

                        <div className="text-center">
                            <p className="mb-2 font-bold text-xs">THANK YOU FOR LISTENING!</p>
                            {/* Fake Barcode */}
                            <div className="h-12 bg-black w-3/4 mx-auto" style={{
                                maskImage: 'repeating-linear-gradient(90deg, black, black 2px, transparent 2px, transparent 4px)'
                            }}></div>
                            <p className="text-[10px] mt-1">{profile?.uri?.split(':')[2] || 'SAMPLE-CODE'}</p>
                        </div>
                    </div>
                )}

                <div className="mt-8 text-center text-gray-500 text-sm">
                    <p>Take a screenshot to share!</p>
                </div>
            </div>

            <style>{`
                .receipt-paper {
                    mask-image: linear-gradient(180deg, white 0%, white 98%, transparent 100%), radial-gradient(circle at 50% 100%, transparent 6px, white 7px);
                    mask-position: bottom;
                    mask-size: 100% 100%, 20px 20px;
                    mask-repeat: no-repeat, repeat-x;
                    padding-bottom: 30px;
                }
            `}</style>
        </div>
    );
};

export default ReceiptGenerator;
