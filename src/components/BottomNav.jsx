import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Edit3, Trash2, Wand2 } from 'lucide-react';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const navItems = [
        { path: '/dashboard', icon: Home, label: 'Home' },
        { path: '/stats', icon: BarChart3, label: 'Stats' },
        { path: '/playlists', icon: Edit3, label: 'Manage' },
        { path: '/cleanup', icon: Trash2, label: 'Cleanup' },
        { path: '/ai-generator', icon: Wand2, label: 'Magic' }
    ];

    return (
        <div className="fixed bottom-6 left-4 right-4 md:hidden z-50 animate-slide-up">
            <div className="bg-[#181818]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 flex justify-between items-center px-6">
                {navItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center gap-1 transition-all duration-300 relative group ${isActive(item.path) ? 'scale-110' : 'opacity-60 hover:opacity-100'
                            }`}
                    >
                        <div className={`p-2 rounded-xl transition-all ${isActive(item.path) ? 'bg-white/10 text-green-400' : 'text-white'
                            }`}>
                            <item.icon size={22} strokeWidth={isActive(item.path) ? 2.5 : 2} />
                        </div>
                        {isActive(item.path) && (
                            <div className="absolute -bottom-2 w-1 h-1 bg-green-500 rounded-full" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default BottomNav;
