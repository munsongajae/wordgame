import React from 'react';
import { Word } from '../../types/word';

interface QuizResultProps {
    score: number;
    total: number;
    duration: number;
    isNewRecord?: boolean;
    wrongWords?: Word[];
    onRestart?: () => void;
    onBack: () => void;
}

export const QuizResult: React.FC<QuizResultProps> = ({
    score,
    total,
    duration,
    isNewRecord = false,
    wrongWords = [],
    onRestart,
    onBack,
}) => {
    const accuracy = Math.round((score / total) * 100);

    const getComment = () => {
        if (accuracy >= 90) return { emoji: '🏆', text: '완벽해요! 정말 대단해요!' };
        if (accuracy >= 70) return { emoji: '🎉', text: '훌륭해요! 계속 열심히 해봐요!' };
        if (accuracy >= 50) return { emoji: '😊', text: '좋아요! 조금만 더 연습해봐요!' };
        return { emoji: '💪', text: '힘내요! 다시 한번 도전해봐요!' };
    };

    const comment = getComment();

    return (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
            <h3 style={{ color: '#333', fontSize: '28px', marginBottom: '20px' }}>
                🎯 퀴즈 결과
            </h3>

            {isNewRecord && (
                <div
                    style={{
                        backgroundColor: '#fff3cd',
                        border: '2px solid #ffc107',
                        borderRadius: '12px',
                        padding: '15px',
                        margin: '10px 0',
                        color: '#856404',
                        animation: 'pulse 2s infinite',
                    }}
                >
                    🏆 신기록 달성! 순위에 기록되었습니다!
                </div>
            )}

            {/* 점수 표시 */}
            <div
                style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color: '#2196F3',
                    margin: '20px 0',
                    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
            >
                {score} / {total}
            </div>

            {/* 정답률과 시간 표시 */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '30px',
                    margin: '20px 0',
                    flexWrap: 'wrap',
                }}
            >
                <div
                    style={{
                        backgroundColor: '#e3f2fd',
                        padding: '15px 25px',
                        borderRadius: '12px',
                        border: '2px solid #2196F3',
                    }}
                >
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                        정답률
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                        {accuracy}%
                    </div>
                </div>
                <div
                    style={{
                        backgroundColor: '#f3e5f5',
                        padding: '15px 25px',
                        borderRadius: '12px',
                        border: '2px solid #9c27b0',
                    }}
                >
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                        풀이 시간
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7b1fa2' }}>
                        {duration}초
                    </div>
                </div>
            </div>

            {/* 코멘트 */}
            <div
                style={{
                    fontSize: '24px',
                    margin: '30px 0',
                    padding: '20px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '12px',
                }}
            >
                {comment.emoji} {comment.text}
            </div>

            {/* 버튼들 */}
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
                {onRestart && (
                    <button
                        onClick={onRestart}
                        style={{
                            padding: '15px 30px',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        🔄 다시 도전
                    </button>
                )}
                <button
                    onClick={onBack}
                    style={{
                        padding: '15px 30px',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        backgroundColor: '#757575',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s ease',
                    }}
                >
                    ← 메인으로
                </button>
            </div>

            {/* 틀린 단어 목록 */}
            {wrongWords.length > 0 && (
                <div style={{ marginTop: '40px', textAlign: 'left', maxWidth: '600px', margin: '40px auto 0' }}>
                    <h4 style={{ color: '#d32f2f', marginBottom: '15px' }}>
                        ❌ 틀린 단어 ({wrongWords.length}개)
                    </h4>
                    <div
                        style={{
                            backgroundColor: '#fff',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            padding: '15px',
                        }}
                    >
                        {wrongWords.map((word, idx) => (
                            <div
                                key={word.id || idx}
                                style={{
                                    padding: '10px',
                                    borderBottom: idx < wrongWords.length - 1 ? '1px solid #f0f0f0' : 'none',
                                }}
                            >
                                <span style={{ fontWeight: 'bold', color: '#333' }}>{word.english}</span>
                                <span style={{ color: '#666', marginLeft: '10px' }}>- {word.korean}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
