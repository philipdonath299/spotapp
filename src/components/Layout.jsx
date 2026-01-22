import React from 'react';
import BottomNav from './BottomNav';

const Layout = ({ children }) => {
    return (
        <div className="min-h-screen bg-[#050505] text-white relative flex flex-col items-center overflow-hidden">
            {/* iOS 26 Ambient Orbitals */}
            <div className="ios26-orbital w-[500px] h-[500px] bg-blue-500 top-[-10%] left-[-10%]" />
            <div className="ios26-orbital w-[400px] h-[400px] bg-purple-500 bottom-[-10%] right-[-10%]" />
            <div className="ios26-orbital w-[300px] h-[300px] bg-indigo-500 top-[40%] right-[-5%] opacity-10" />

            <main className="w-full max-w-[1200px] pb-32 md:pb-8 px-4 md:px-8 relative z-10">
                {children}
            </main>
            <BottomNav />
        </div>
    );
};

export default Layout;
