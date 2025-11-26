import React from 'react';
import { useNavigate } from 'react-router-dom';
import { QuizHeader } from '../components/common/QuizHeader';

export default function RankingPage() {
    const navigate = useNavigate();

    return (
        <div className="app-container">
            <QuizHeader title="명예의 전당" onBack={() => navigate('/')} timeLeft={0} score={0} />
            <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
                <h2>준비 중입니다... 🏆</h2>
                <p>최고 득점자 순위를 이곳에서 확인할 수 있습니다.</p>
            </div>
        </div>
    );
}
