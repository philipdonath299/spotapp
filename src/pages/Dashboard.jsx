import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyFetch } from '../utils/spotify';
import { Music, Play } from 'lucide-react';

const Dashboard = () => {
    const [playlists, setPlaylists] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const loadData = async () => {
            const profileData = await spotifyFetch('/me');
            if (!profileData) {
                navigate('/');
                return;
            }
            setProfile(profileData);

            // Fetch user's playlists
            // Limit to 50 for now, could paginate
            const playlistsData = await spotifyFetch('/me/playlists?limit=50');
            if (playlistsData) {
                setPlaylists(playlistsData.items);
            }
            setLoading(false);
        };
        loadData();
    }, [navigate]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-neutral-900 to-black p-8 text-white">
            <header className="flex justify-between items-center mb-12">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
                    Hello, {profile?.display_name}
                </h1>
                <button
                    onClick={() => {
                        localStorage.clear();
                        navigate('/');
                    }}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                    Logout
                </button>
            </header>

            <h2 className="text-2xl font-bold mb-6">Select a Playlist to Discover New Music</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {playlists.map((playlist, index) => (
                    <div
                        key={playlist.id}
                        className="group relative bg-[#181818] p-4 rounded-lg hover:bg-[#282828] transition-all duration-300 cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => navigate(`/recommendations/${playlist.id}`)}
                    >
                        <div className="relative aspect-square w-full mb-4 shadow-lg overflow-hidden rounded-md">
                            {playlist.images?.[0]?.url ? (
                                <img
                                    src={playlist.images[0].url}
                                    alt={playlist.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            ) : (
                                <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                                    <Music className="w-12 h-12 text-gray-600" />
                                </div>
                            )}
                            {/* Play Button Overlay */}
                            <div className="absolute bottom-2 right-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 shadow-xl">
                                <div className="bg-green-500 rounded-full p-3 text-black">
                                    <Play fill="currentColor" size={20} />
                                </div>
                            </div>
                        </div>
                        <h3 className="font-bold truncate text-white mb-1" title={playlist.name}>
                            {playlist.name}
                        </h3>
                        <p className="text-sm text-gray-400 truncate">
                            By {playlist.owner.display_name}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
