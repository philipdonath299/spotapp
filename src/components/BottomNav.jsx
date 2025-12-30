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
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pointer-events-none">
            <div className="ios26-island rounded-[32px] px-6 md:px-8 py-3 flex items-center gap-4 md:gap-6 shadow-2xl animate-ios26-in pointer-events-auto">
                {navItems.map((item) => {
                    const active = isActive(item.path);
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`flex flex-col items-center gap-1 transition-all duration-500 relative group ${active ? 'text-blue-500 scale-110' : 'text-white/40 hover:text-white/80'}`}
                        >
                            <div className={`p-2.5 rounded-2xl transition-all duration-500 ${active ? 'bg-blue-500/20 shadow-[0_0_20px_rgba(10,132,255,0.3)]' : 'group-hover:bg-white/5'}`}>
                                <item.icon
                                    size={18}
                                    strokeWidth={active ? 3 : 2}
                                    className={`transition-transform duration-500 md:size-[20px] ${active ? 'rotate-[360deg]' : ''}`}
                                />
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-[0.1em] transition-all duration-500 ${active ? 'opacity-100' : 'opacity-0 scale-50'}`}>
                                {item.label}
                            </span>
                            {active && (
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full blur-[2px] animate-pulse" />
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
