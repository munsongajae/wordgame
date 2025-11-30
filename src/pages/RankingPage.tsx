import React from 'react';
import { useNavigate } from 'react-router-dom';
import Ranking from '../components/Ranking';

export default function RankingPage() {
    const navigate = useNavigate();

    return (
        <div className="app-container">
            <Ranking onBack={() => navigate('/')} />
        </div>
    );
}
