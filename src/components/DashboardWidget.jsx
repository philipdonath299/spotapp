import React from 'react';

const widgetColors = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', blur: 'bg-blue-500/10' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', blur: 'bg-purple-500/10' },
    pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', blur: 'bg-pink-500/10' },
    orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', blur: 'bg-orange-500/10' },
    green: { bg: 'bg-green-500/10', text: 'text-green-400', blur: 'bg-green-500/10' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', blur: 'bg-red-500/10' },
    gray: { bg: 'bg-gray-500/10', text: 'text-gray-400', blur: 'bg-gray-500/10' },
};

const DashboardWidget = ({ title, icon: Icon, colorClass, onClick, desc, span = false }) => {
    const colors = widgetColors[colorClass] || widgetColors.blue;

    return (
        <button
            onClick={onClick}
            className={`ios26-card-interactive p-6 flex flex-col justify-between group relative overflow-hidden text-left ${span ? 'md:col-span-2' : ''}`}
        >
            <div className={`absolute -top-10 -right-10 w-32 h-32 ${colors.blur} blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-1000`} />

            <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-10 border border-white/5 group-hover:bg-white/10 transition-all duration-500`}>
                <Icon size={24} className={colors.text} strokeWidth={2} />
            </div>

            <div className="relative z-10 transition-transform duration-500 group-hover:translate-x-1">
                <h3 className="text-xl font-black tracking-tighter mb-1 uppercase">{title}</h3>
                <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">{desc}</p>
            </div>
        </button>
    );
};

export default DashboardWidget;
