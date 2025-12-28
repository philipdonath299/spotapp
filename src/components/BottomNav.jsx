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
        { path: '/ai-generator', icon: Wand2, label: 'AI Magic' }
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur-md border-t border-white/10 p-2 pb-6 md:hidden z-50 animate-slide-up">
            <div className="flex justify-around items-center">
                {navItems.map((item) => (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center gap-1 p-2 transition-all ${isActive(item.path)
                                ? 'text-green-500 scale-110'
                                : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <item.icon size={24} fill={isActive(item.path) ? "currentColor" : "none"} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default BottomNav;
