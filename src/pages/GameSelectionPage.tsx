import React from 'react';
import { useNavigate } from 'react-router-dom';
import { QuizHeader } from '../components/common/QuizHeader';

export default function GameSelectionPage() {
    const navigate = useNavigate();

    const games = [
        { id: 'sentence', title: '📝 문장 만들기', desc: '단어를 순서대로 배열하여 문장을 만드세요', path: '/game/sentence' },
        { id: 'boss', title: '👽 외계인 침공', desc: '외계인을 막으며 단어를 학습하세요', path: '/game/boss-raid' },
        { id: 'memory', title: '🎴 단어 메모리', desc: '영어와 한글 카드를 맞춰보세요', path: '/game/memory' },
        { id: 'speed', title: '⚡ 단어 스피드 챌린지', desc: '60초 동안 최대한 많은 단어를 맞춰보세요', path: '/game/speed' },
    ];

    return (
        <div className="quiz-container">
            <QuizHeader title="게임 선택" onBack={() => navigate('/')} timeLeft={0} score={0} />

            <div className="quiz-selection-grid" style={{ display: 'grid', gap: 20, padding: 20 }}>
                {games.map(game => (
                    <button
                        key={game.id}
                        onClick={() => navigate(game.path)}
                        className="quiz-selection-card"
                        style={{
                            padding: 20,
                            borderRadius: 15,
                            border: '2px solid #e0e0e0',
                            backgroundColor: 'white',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'transform 0.2s'
                        }}
                    >
                        <h3 style={{ margin: '0 0 10px 0', fontSize: 20 }}>{game.title}</h3>
                        <p style={{ margin: 0, color: '#666' }}>{game.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}
