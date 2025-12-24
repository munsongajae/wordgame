import React from 'react';
import { useNavigate } from 'react-router-dom';
import { QuizHeader } from '../components/common/QuizHeader';

export default function QuizSelectionPage() {
    const navigate = useNavigate();

    const quizzes = [
        { id: 'combined', title: '🎯 종합 퀴즈', desc: '모든 유형이 섞여 나옵니다', path: '/quiz/combined' },
        { id: 'image', title: '🖼️ 그림 퀴즈', desc: '그림을 보고 단어를 맞추세요', path: '/quiz/image' },
        { id: 'spelling', title: '📝 단어 맞추기', desc: '뜻 보고 영어 맞추기', path: '/quiz/spelling' },
        { id: 'meaning', title: '📖 뜻 맞추기', desc: '단어의 뜻을 맞추세요', path: '/quiz/meaning' },
        { id: 'listening', title: '🎧 듣기 퀴즈', desc: '발음을 듣고 단어를 맞추세요', path: '/quiz/listening' },
        { id: 'spelling-game', title: '🔤 철자 게임', desc: '섞인 글자 올바르게 배열하기', path: '/quiz/spelling-game' },
        { id: 'fillblank', title: '🕳️ 빈칸 채우기', desc: '문장의 빈칸에 알맞은 단어를 넣으세요', path: '/quiz/fill-blank' },
        { id: 'pronunciation', title: '🗣️ 발음 퀴즈', desc: '단어를 읽고 정답을 맞추세요 (음성인식)', path: '/quiz/pronunciation' },
        { id: 'pronunciation-practice', title: '🎙️ 발음 연습', desc: '자유롭게 발음을 연습해보세요', path: '/quiz/pronunciation-practice' },
    ];

    return (
        <div className="quiz-container">
            <QuizHeader title="퀴즈 선택" onBack={() => navigate('/')} timeLeft={0} score={0} />

            <div className="quiz-selection-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 20, maxWidth: 600, margin: '0 auto' }}>
                {quizzes.map(quiz => (
                    <button
                        key={quiz.id}
                        onClick={() => navigate(quiz.path)}
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
                        <h3 style={{ margin: '0 0 10px 0', fontSize: 20 }}>{quiz.title}</h3>
                        <p style={{ margin: 0, color: '#666' }}>{quiz.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}
