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
import MoodMix from './pages/MoodMix';
import DiscoveryDeck from './pages/DiscoveryDeck';
import ReceiptGenerator from './pages/ReceiptGenerator';
import LikedSorter from './pages/LikedSorter';
import Layout from './components/Layout';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/callback" element={<Callback />} />

                {/* Authenticated Routes with Mobile Layout */}
                <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
                <Route path="/recommendations/:playlistId" element={<Layout><Recommendations /></Layout>} />
                <Route path="/recommendations" element={<Layout><Recommendations /></Layout>} />
                <Route path="/ai-generator" element={<Layout><AIGenerator /></Layout>} />
                <Route path="/playlists" element={<Layout><PlaylistManager /></Layout>} />
                <Route path="/cleanup" element={<Layout><LibraryCleanup /></Layout>} />
                <Route path="/automation" element={<Layout><Automation /></Layout>} />
                <Route path="/mood-mix" element={<Layout><MoodMix /></Layout>} />
                <Route path="/discovery" element={<Layout><DiscoveryDeck /></Layout>} />
                <Route path="/receipt" element={<Layout><ReceiptGenerator /></Layout>} />
                <Route path="/stats" element={<Layout><Stats /></Layout>} />
                <Route path="/liked-sorter" element={<Layout><LikedSorter /></Layout>} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
