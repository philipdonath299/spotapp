import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Callback from './pages/Callback';
import Dashboard from './pages/Dashboard';
import AIGenerator from './pages/AIGenerator';
import PlaylistManager from './pages/PlaylistManager';
import VinylScanner from './pages/VinylScanner';
import Layout from './components/Layout';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/callback" element={<Callback />} />

                {/* Authenticated Routes with Mobile Layout */}
                <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
                <Route path="/ai-generator" element={<Layout><AIGenerator /></Layout>} />
                <Route path="/playlists" element={<Layout><PlaylistManager /></Layout>} />
                <Route path="/vinyl-scanner" element={<Layout><VinylScanner /></Layout>} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
