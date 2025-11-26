import React from 'react';

interface QuizHeaderProps {
    title: string;
    currentQuestion?: number;
    totalQuestions?: number;
    timeLeft: number;
    score: number;
    onBack: () => void;
}

export const QuizHeader: React.FC<QuizHeaderProps> = ({
    title,
    currentQuestion,
    totalQuestions,
    timeLeft,
    score,
    onBack,
}) => {
    return (
        <div
            className="quiz-header"
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                gap: '16px',
            }}
        >
            <button
                className="btn btn-outline"
                onClick={onBack}
                style={{
                    width: 'auto',
                    padding: '8px 16px',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}
            >
                ⬅️ 나가기
            </button>

            <div style={{ flex: 1, textAlign: 'center' }}>
                <h2 style={{ margin: 0, color: 'var(--color-ink)', fontSize: '20px', fontWeight: 800 }}>
                    {title}
                    {currentQuestion !== undefined && totalQuestions !== undefined &&
                        ` (${currentQuestion}/${totalQuestions})`}
                </h2>
            </div>

            <div
                style={{
                    backgroundColor: 'var(--color-ash)',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontWeight: 'bold',
                    color: 'var(--color-slate)',
                    minWidth: '80px',
                    textAlign: 'center',
                    fontSize: '14px'
                }}
            >
                {timeLeft > 0 ? `⏱️ ${timeLeft}s` : ''}
                {timeLeft > 0 && score !== undefined ? ' | ' : ''}
                {score !== undefined ? `🏆 ${score}` : ''}
            </div>
        </div>
    );
};
