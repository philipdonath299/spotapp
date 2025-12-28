import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Callback from './pages/Callback';
import Dashboard from './pages/Dashboard';
import Recommendations from './pages/Recommendations';
import AIGenerator from './pages/AIGenerator';
import PlaylistManager from './pages/PlaylistManager';
import Stats from './pages/Stats';
import LibraryCleanup from './pages/LibraryCleanup';
import Automation from './pages/Automation';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/callback" element={<Callback />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/recommendations/:playlistId" element={<Recommendations />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="/playlists" element={<PlaylistManager />} />
                <Route path="/cleanup" element={<LibraryCleanup />} />
                <Route path="/automation" element={<Automation />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
