import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { Disc, ArrowLeft, Loader2, Play, Search, ExternalLink, Sparkles } from 'lucide-react';

const VinylScanner = () => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const fetchAIResponse = async (apiKey, prompt) => {
        const models = [
            { version: 'v1beta', id: 'gemini-2.0-flash' },
            { version: 'v1beta', id: 'gemini-1.5-flash' },
            { version: 'v1beta', id: 'gemini-pro-latest' }
        ];

        let lastError = null;
        for (const model of models) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/${model.version}/models/${model.id}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }]
                    })
                });
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) return data.candidates[0].content.parts[0].text;
            } catch (err) {
                lastError = err.message;
            }
        }
        throw new Error(lastError || `AI Connection Failed.`);
    };

    const startScan = async () => {
        setLoading(true);
        setError(null);
        setResults([]);
        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) throw new Error("VITE_GEMINI_API_KEY missing.");

            setStatus('Fetching Liked Songs...');
            let allTracks = [];
            let nextUrl = '/me/tracks?limit=50';

            while (nextUrl) {
                const data = await spotifyFetch(nextUrl.startsWith('https') ? nextUrl.replace('https://api.spotify.com/v1', '') : nextUrl);
                if (data?.items) {
                    allTracks = [...allTracks, ...data.items];
                    nextUrl = data.next;
                    setStatus(`Fetched ${allTracks.length} tracks...`);
                } else {
                    nextUrl = null;
                }
                // Safety break for huge libraries in demo
                if (allTracks.length > 500) break;
            }

            setStatus('Analyzing Library...');
            const albumMap = {};
            allTracks.forEach(item => {
                const album = item.track.album;
                if (!albumMap[album.id]) {
                    albumMap[album.id] = {
                        name: album.name,
                        artist: album.artists[0].name,
                        image: album.images[0]?.url,
                        tracks: [],
                        id: album.id
                    };
                }
                albumMap[album.id].tracks.push(item.track.name);
            });

            const topAlbums = Object.values(albumMap)
                .filter(a => a.tracks.length >= 3)
                .sort((a, b) => b.tracks.length - a.tracks.length);

            if (topAlbums.length === 0) {
                setStatus('No significant albums found (>=3 tracks).');
                setLoading(false);
                return;
            }

            setStatus(`Verifying Vinyl for ${topAlbums.length} albums...`);
            const verifiedAlbums = [];

            // Process in batches to avoid API limits/long prompts
            for (let i = 0; i < Math.min(topAlbums.length, 20); i++) {
                const album = topAlbums[i];
                setStatus(`Checking Vinyl: ${album.name} [${i+1}/${Math.min(topAlbums.length, 20)}]`);

                const prompt = `Does the album "${album.name}" by "${album.artist}" have an official vinyl release? Return ONLY a JSON object: {"hasVinyl": boolean, "releaseYear": string}. If multiple versions exist, just confirm one exists.`;

                try {
                    const aiText = await fetchAIResponse(apiKey, prompt);
                    const jsonMatch = aiText.match(/\{.*\}/s);
                    if (jsonMatch) {
                        const result = JSON.parse(jsonMatch[0]);
                        if (result.hasVinyl) {
                            verifiedAlbums.push({
                                ...album,
                                releaseYear: result.releaseYear
                            });
                        }
                    }
                } catch (err) {
                    console.error("AI verify failed for", album.name, err);
                }
            }

            setResults(verifiedAlbums);
            setStatus(verifiedAlbums.length > 0 ? `Scan complete. Found ${verifiedAlbums.length} recommendations.` : 'No vinyl releases found for your top albums.');
        } catch (err) {
            setError(err.message);
            setStatus('Scan failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="py-20 max-w-6xl mx-auto px-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full -z-10 animate-ios26-float" />

            <header className="mb-24">
                <button onClick={() => navigate('/dashboard')} className="mb-10 flex items-center text-blue-500 font-black text-[10px] uppercase tracking-[0.3em] hover:text-blue-400 transition-colors">
                    <ArrowLeft size={16} className="mr-2" /> Dashboard
                </button>
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-12">
                    <div className="max-w-2xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-3 ml-1">Physical Media Discovery</p>
                        <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-none text-white mb-8">
                            Vinyl Scanner
                        </h1>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto space-y-16">
                {!loading && results.length === 0 && (
                    <div className="ios26-card p-12 text-center space-y-8 border-white/10 bg-white/[0.02]">
                        <div className="w-20 h-20 mx-auto ios26-liquid rounded-[32px] flex items-center justify-center border border-white/20 shadow-2xl">
                            <Disc size={40} className="text-white" />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black tracking-tighter uppercase text-white">Analyze Your Library</h2>
                            <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] max-w-md mx-auto leading-relaxed">
                                We'll scan your liked songs, group them by album, and use AI to find which ones are available on vinyl.
                            </p>
                        </div>
                        <button
                            onClick={startScan}
                            className="px-12 py-6 ios26-liquid text-white font-black rounded-[28px] hover:scale-[1.02] active:scale-95 transition-all shadow-2xl border border-white/20 uppercase tracking-[0.3em] text-[10px]"
                        >
                            Initiate Scan
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center space-y-8 py-20">
                        <div className="relative">
                            <Disc className="animate-spin text-blue-500" size={80} strokeWidth={1} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles className="text-white/20 animate-pulse" size={24} />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-blue-500 font-black uppercase tracking-[0.4em] text-[10px] animate-pulse">{status}</p>
                            <p className="text-white/20 font-black uppercase tracking-[0.2em] text-[8px]">Processing Library Signal</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="ios26-glass p-8 rounded-[32px] border border-red-500/20 text-center">
                        <p className="text-red-500 font-black uppercase tracking-[0.2em] text-[10px]">{error}</p>
                    </div>
                )}

                {results.length > 0 && !loading && (
                    <div className="space-y-12 pb-32">
                        <div className="flex justify-between items-center border-b border-white/5 pb-8">
                            <div>
                                <h2 className="text-3xl font-black tracking-tighter uppercase text-white leading-none">Recommendations</h2>
                                <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-2">Verified Vinyl Releases</p>
                            </div>
                            <button onClick={startScan} className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-white transition-colors">Rescan</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {results.map((album) => (
                                <div key={album.id} className="ios26-card-interactive p-6 flex items-center gap-6 group">
                                    <div className="w-24 h-24 rounded-[28px] overflow-hidden shadow-2xl ring-1 ring-white/10 group-hover:scale-110 transition-all duration-700 shrink-0">
                                        {album.image ? (
                                            <img src={album.image} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="w-full h-full bg-white/5 flex items-center justify-center"><Disc size={32} className="text-white/10" /></div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-between h-24">
                                        <div>
                                            <h3 className="font-black truncate text-sm tracking-tighter uppercase text-white group-hover:text-blue-500 transition-colors mb-1">{album.name}</h3>
                                            <p className="text-[9px] text-white/30 font-black truncate tracking-widest uppercase mb-1">{album.artist}</p>
                                            <p className="text-[8px] text-blue-500/50 font-black uppercase tracking-widest">{album.tracks.length} Songs Liked</p>
                                        </div>
                                        <a
                                            href={`https://www.google.com/search?q=${encodeURIComponent(album.name + ' ' + album.artist + ' vinyl')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-[9px] font-black text-white/40 uppercase tracking-widest hover:text-white transition-colors"
                                        >
                                            <Search size={10} /> Find Vinyl <ExternalLink size={10} />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VinylScanner;
