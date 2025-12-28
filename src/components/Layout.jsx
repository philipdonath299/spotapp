import React from 'react';
import BottomNav from './BottomNav';

const Layout = ({ children }) => {
    return (
        <div className="min-h-screen bg-black text-white relative">
            <div className="pb-24 md:pb-0">
                {children}
            </div>
            <BottomNav />
        </div>
    );
};

export default Layout;
