import React from 'react';
import { Routes, Route } from 'react-router-dom';
import GameSelectionPage from '../pages/GameSelectionPage';
import SentenceGame from '../components/SentenceGame';
import BossRaid from '../components/BossRaid';
import MemoryGame from '../components/MemoryGame';
import SpeedChallenge from '../components/SpeedChallenge';

export const GameRoutes: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<GameSelectionPage />} />
            <Route path="/sentence" element={<SentenceGame />} />
            <Route path="/boss-raid" element={<BossRaid />} />
            <Route path="/memory" element={<MemoryGame />} />
            <Route path="/speed" element={<SpeedChallenge />} />
        </Routes>
    );
};
