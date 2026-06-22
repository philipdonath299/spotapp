import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { Disc, ArrowLeft, Loader2, Play, Search, ExternalLink, Sparkles } from 'lucide-react';

const VinylScanner = () => {
    const [loading, setLoading] = useState(false);
    const [hasScanned, setHasScanned] = useState(false);
    const [status, setStatus] = useState('');
    const [results, setResults] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const fetchAIResponse = async (apiKey, prompt) => {
        const models = [
            { version: 'v1beta', id: 'gemini-2.5-flash' },
            { version: 'v1beta', id: 'gemini-2.0-flash' },
            { version: 'v1beta', id: 'gemini-flash-latest' },
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
        setHasScanned(true);
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
                // Safety break for huge libraries in demo - increased for better library coverage
                if (allTracks.length > 2000) break;
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

            const allAlbumValues = Object.values(albumMap);
            console.log(`Found ${allAlbumValues.length} unique albums.`);

            let topAlbums = allAlbumValues
                .filter(a => a.tracks.length >= 3)
                .sort((a, b) => b.tracks.length - a.tracks.length);

            // Fallback to 2 tracks if no albums meet the 3-track threshold
            if (topAlbums.length === 0) {
                topAlbums = allAlbumValues
                    .filter(a => a.tracks.length >= 2)
                    .sort((a, b) => b.tracks.length - a.tracks.length);
            }

            // Ultimate fallback to 1 track if no albums meet the 2-track threshold
            if (topAlbums.length === 0) {
                topAlbums = allAlbumValues
                    .filter(a => a.tracks.length >= 1)
                    .sort((a, b) => Math.random() - 0.5) // Randomize if single tracks
                    .slice(0, 50);
            }

            if (topAlbums.length === 0) {
                setStatus('Your library appears to be empty.');
                setLoading(false);
                return;
            }

            setCandidates(topAlbums.slice(0, 10)); // Store top 10 as potential fallbacks
            console.log(`Verifying Vinyl for ${topAlbums.length} candidate albums.`);
            setStatus(`Verifying Vinyl for ${topAlbums.length} albums...`);
            const verifiedAlbums = [];

            // Increase search breadth to find at least some results
            const searchLimit = Math.min(topAlbums.length, 50);
            for (let i = 0; i < searchLimit; i++) {
                const album = topAlbums[i];
                setStatus(`Verifying ${album.name} [${i + 1}/${searchLimit}]`);

                const prompt = `Task: Verify if the album "${album.name}" by "${album.artist}" has ever been released on vinyl.
                Instructions:
                1. Research the discography for official vinyl releases (LPs, EPs).
                2. Return ONLY a JSON object.
                Format: {"hasVinyl": boolean, "releaseYear": "YYYY" or "Unknown"}
                Constraint: Do NOT include any other text, markdown code blocks, or conversational filler.`;

                try {
                    const aiText = await fetchAIResponse(apiKey, prompt);
                    console.log(`AI Response for ${album.name}:`, aiText);

                    // More resilient JSON parsing - handle markdown and extra text
                    const cleanText = aiText.replace(/```json|```/g, '').trim();
                    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

                    if (jsonMatch) {
                        try {
                            const result = JSON.parse(jsonMatch[0]);
                            if (result.hasVinyl) {
                                verifiedAlbums.push({
                                    ...album,
                                    releaseYear: result.releaseYear || 'Unknown'
                                });
                            }
                        } catch (e) {
                            console.error("JSON parse failed for", album.name, e);
                            // Fallback regex search if JSON.parse fails
                            if (/["']hasVinyl["']\s*:\s*true/i.test(jsonMatch[0])) {
                                verifiedAlbums.push({
                                    ...album,
                                    releaseYear: 'Unknown'
                                });
                            }
                        }
                    } else if (cleanText.toLowerCase().includes('"hasvinyl": true') || cleanText.toLowerCase().includes('"hasvinyl":true')) {
                        // Rough fallback if JSON is slightly malformed but contains the key
                        verifiedAlbums.push({
                            ...album,
                            releaseYear: 'Unknown'
                        });
                    }

                    // If we found enough, stop to save time, but keep going a bit more than before
                    if (verifiedAlbums.length >= 15) break;

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
                {!loading && !hasScanned && (
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

                {!loading && hasScanned && results.length === 0 && (
                    <div className="space-y-16">
                        <div className="ios26-card p-12 text-center space-y-8 border-white/10 bg-white/[0.02]">
                            <div className="w-20 h-20 mx-auto bg-white/5 rounded-[32px] flex items-center justify-center border border-white/10">
                                <Search size={32} className="text-white/20" />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-2xl font-black tracking-tighter uppercase text-white">No Vinyl Found</h2>
                                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] max-w-md mx-auto leading-relaxed">
                                    {status || "We couldn't find any vinyl releases for your top albums at this time."}
                                </p>
                            </div>
                            <button
                                onClick={startScan}
                                className="px-8 py-4 ios26-glass text-white/60 font-black rounded-[20px] hover:text-white transition-all uppercase tracking-[0.3em] text-[9px] border border-white/10"
                            >
                                Try Again
                            </button>
                        </div>

                        {candidates.length > 0 && (
                            <div className="space-y-12">
                                <div className="text-center">
                                    <h2 className="text-3xl font-black tracking-tighter uppercase text-white">Top Library Albums</h2>
                                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-2">Manual Discovery</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                                    {candidates.map((album) => (
                                        <div key={album.id} className="ios26-card-interactive p-6 flex items-center gap-6 group">
                                            <div className="w-20 h-20 rounded-[24px] overflow-hidden shrink-0">
                                                {album.image ? (
                                                    <img src={album.image} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-full h-full bg-white/5 flex items-center justify-center"><Disc size={24} className="text-white/10" /></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-black truncate text-sm uppercase text-white mb-1">{album.name}</h3>
                                                <p className="text-[9px] text-white/30 font-black truncate uppercase mb-4">{album.artist}</p>
                                                <a
                                                    href={`https://www.google.com/search?q=${encodeURIComponent(album.name + ' ' + album.artist + ' vinyl')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-[8px] font-black text-blue-500 uppercase tracking-widest"
                                                >
                                                    Manual Check <ExternalLink size={8} />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
