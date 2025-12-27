import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Callback from './pages/Callback';
import Dashboard from './pages/Dashboard';
import Recommendations from './pages/Recommendations';
import AIGenerator from './pages/AIGenerator';
import Stats from './pages/Stats';

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/callback" element={<Callback />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/recommendations/:playlistId" element={<Recommendations />} />
                <Route path="/ai-generator" element={<AIGenerator />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
