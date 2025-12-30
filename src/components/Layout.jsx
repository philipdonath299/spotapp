import React from 'react';
import BottomNav from './BottomNav';

const Layout = ({ children }) => {
    return (
        <div className="min-h-screen bg-black text-white relative flex flex-col items-center">
            <main className="w-full max-w-[1200px] pb-32 md:pb-8 px-4 md:px-8">
                {children}
            </main>
            <BottomNav />
        </div>
    );
};

export default Layout;
