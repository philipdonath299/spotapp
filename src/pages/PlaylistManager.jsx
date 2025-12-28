import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { ArrowLeft, Edit3, Wand2, Loader2, Save, X, CheckCircle, Sparkles } from 'lucide-react';

const PlaylistManager = () => {
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [generatingFor, setGeneratingFor] = useState(null);
    const [savingId, setSavingId] = useState(null);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadPlaylists();
    }, []);

    const loadPlaylists = async () => {
        setLoading(true);
        try {
            const data = await spotifyFetch('/me/playlists?limit=50');
            if (data) {
                setPlaylists(data.items);
            }
        } catch (err) {
            setError('Failed to load playlists');
        } finally {
            setLoading(false);
        }
    };

    const startEditing = (playlist) => {
        setEditingId(playlist.id);
        setEditName(playlist.name);
        setEditDescription(playlist.description || '');
        setError(null);
        setSuccessMessage(null);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditName('');
        setEditDescription('');
    };

    const savePlaylist = async (playlistId) => {
        setSavingId(playlistId);
        try {
            await spotifyFetch(`/playlists/${playlistId}`, 'PUT', {
                name: editName,
                description: editDescription
            });

            // Update local state
            setPlaylists(playlists.map(p =>
                p.id === playlistId
                    ? { ...p, name: editName, description: editDescription }
                    : p
            ));

            setSuccessMessage('Playlist updated successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
            cancelEditing();
        } catch (err) {
            setError('Failed to save playlist');
        } finally {
            setSavingId(null);
        }
    };

    const generateDescription = async (playlist) => {
        setGeneratingFor(playlist.id);
        setError(null);

        try {
            // Fetch playlist tracks
            const tracksData = await spotifyFetch(`/playlists/${playlist.id}/tracks?limit=50`);

            if (!tracksData?.items || tracksData.items.length === 0) {
                throw new Error('No tracks found in this playlist');
            }

            // Extract track and artist info
            const tracks = tracksData.items
                .filter(item => item.track)
                .slice(0, 30) // Use first 30 tracks for analysis
                .map(item => ({
                    name: item.track.name,
                    artist: item.track.artists[0]?.name || 'Unknown'
                }));

            // Generate AI description
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('Gemini API Key is missing');
            }

            const prompt = `Analyze this playlist and create a short, catchy description (max 100 characters):

Playlist Name: "${playlist.name}"
Tracks: ${tracks.map(t => `${t.name} by ${t.artist}`).join(', ')}

Generate a description that captures the vibe, genre, mood, or theme. Be creative and concise.`;

            const models = [
                { version: 'v1beta', id: 'gemini-2.0-flash-exp' },
                { version: 'v1beta', id: 'gemini-2.0-flash' },
                { version: 'v1beta', id: 'gemini-flash-latest' }
            ];

            let description = null;
            for (const model of models) {
                try {
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/${model.version}/models/${model.id}:generateContent?key=${apiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [{ text: prompt }]
                                }]
                            })
                        }
                    );

                    const data = await response.json();
                    if (data.candidates?.[0]?.content?.parts[0]?.text) {
                        description = data.candidates[0].content.parts[0].text.trim();
                        // Remove quotes if present
                        description = description.replace(/^["']|["']$/g, '');
                        break;
                    }
                } catch (err) {
                    console.warn(`Model ${model.id} failed:`, err.message);
                }
            }

            if (!description) {
                throw new Error('Failed to generate description');
            }

            // Update the editing state with generated description
            setEditingId(playlist.id);
            setEditName(playlist.name);
            setEditDescription(description);

        } catch (err) {
            setError(err.message);
        } finally {
            setGeneratingFor(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-black text-white p-8 animate-fade-in">
            <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft className="mr-2" size={20} /> Back to Dashboard
            </button>

            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <div className="inline-block p-3 bg-purple-500/10 rounded-full mb-4">
                        <Edit3 className="text-purple-500" size={32} />
                    </div>
                    <h1 className="text-4xl font-bold mb-4">Playlist Manager</h1>
                    <p className="text-gray-400">Rename playlists and generate AI-powered descriptions</p>
                </div>

                {successMessage && (
                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-500 animate-fade-in">
                        <CheckCircle size={20} />
                        {successMessage}
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 animate-fade-in">
                        {error}
                    </div>
                )}

                <div className="grid gap-4">
                    {playlists.map((playlist, index) => {
                        const isEditing = editingId === playlist.id;
                        const isGenerating = generatingFor === playlist.id;
                        const isSaving = savingId === playlist.id;

                        return (
                            <div
                                key={playlist.id}
                                className="bg-[#181818] rounded-xl border border-neutral-800 p-6 hover:border-neutral-700 transition-all animate-fade-in"
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Playlist Image */}
                                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
                                        {playlist.images?.[0]?.url ? (
                                            <img
                                                src={playlist.images[0].url}
                                                alt={playlist.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                                                <Sparkles className="text-neutral-600" size={24} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Playlist Info */}
                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full bg-black border border-neutral-700 rounded-lg px-4 py-2 text-white font-bold focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                                                    placeholder="Playlist name"
                                                />
                                                <textarea
                                                    value={editDescription}
                                                    onChange={(e) => setEditDescription(e.target.value)}
                                                    className="w-full bg-black border border-neutral-700 rounded-lg px-4 py-2 text-white text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                                                    placeholder="Playlist description"
                                                    rows={2}
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => savePlaylist(playlist.id)}
                                                        disabled={isSaving || !editName.trim()}
                                                        className="flex items-center gap-2 bg-green-500 text-black px-4 py-2 rounded-full font-bold hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                    >
                                                        {isSaving ? (
                                                            <Loader2 className="animate-spin" size={16} />
                                                        ) : (
                                                            <Save size={16} />
                                                        )}
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={cancelEditing}
                                                        disabled={isSaving}
                                                        className="flex items-center gap-2 bg-neutral-700 text-white px-4 py-2 rounded-full font-bold hover:bg-neutral-600 disabled:opacity-50 transition-all"
                                                    >
                                                        <X size={16} />
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className="font-bold text-lg mb-1 truncate">
                                                    {playlist.name}
                                                </h3>
                                                <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                                                    {playlist.description || 'No description'}
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => startEditing(playlist)}
                                                        className="flex items-center gap-2 bg-neutral-700 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-neutral-600 transition-all"
                                                    >
                                                        <Edit3 size={14} />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => generateDescription(playlist)}
                                                        disabled={isGenerating}
                                                        className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                                                    >
                                                        {isGenerating ? (
                                                            <Loader2 className="animate-spin" size={14} />
                                                        ) : (
                                                            <Wand2 size={14} />
                                                        )}
                                                        {isGenerating ? 'Generating...' : 'AI Description'}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {playlists.length === 0 && (
                    <div className="text-center text-gray-400 py-12">
                        No playlists found
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaylistManager;
