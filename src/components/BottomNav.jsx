import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Edit3, Trash2, Wand2, Layers } from 'lucide-react';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    const navItems = [
        { path: '/dashboard', icon: Home, label: 'Home' },
        { path: '/stats', icon: BarChart3, label: 'Stats' },
        { path: '/discovery', icon: Layers, label: 'Explore' },
        { path: '/playlists', icon: Edit3, label: 'Manage' },
        { path: '/ai-generator', icon: Wand2, label: 'Magic' }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 apple-tab-bar pb-6 md:pb-4 border-t border-white/10">
            <div className="max-w-2xl mx-auto flex justify-around items-center pt-3 px-6">
                {navItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative group ${active ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <div className={`p-1 rounded-xl transition-all duration-300 ${active ? 'bg-blue-500/10' : 'group-hover:bg-white/5'}`}>
                                <item.icon
                                    size={22}
                                    strokeWidth={active ? 2.5 : 2}
                                    className="transition-transform duration-300"
                                />
                            </div>
                            <span className={`text-[10px] font-bold tracking-tight transition-all duration-300 ${active ? 'opacity-100' : 'opacity-70'}`}>
                                {item.label}
                            </span>
                            {active && (
                                <div className="absolute -bottom-1 w-1 h-1 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,1)]" />
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
