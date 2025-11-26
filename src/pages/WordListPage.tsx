import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWords } from '../contexts/WordsContext';
import { QuizHeader } from '../components/common/QuizHeader';
import { speakText } from '../utils/tts';

export default function WordListPage() {
    const navigate = useNavigate();
    const { words } = useWords();

    // State for Flashcard Mode
    const [viewMode, setViewMode] = React.useState<'list' | 'flashcard'>('list');
    const [frontType, setFrontType] = React.useState<'image' | 'english' | 'korean'>('image');
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [isFlipped, setIsFlipped] = React.useState(false);

    // Reset state when entering flashcard mode
    React.useEffect(() => {
        if (viewMode === 'flashcard') {
            setCurrentIndex(0);
            setIsFlipped(false);
        }
    }, [viewMode]);

    const handleNext = () => {
        if (currentIndex < words.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            setIsFlipped(false);
        }
    };

    const currentWord = words[currentIndex];

    return (
        <div className="app-container">
            <QuizHeader title={`단어장 (${words.length})`} onBack={() => navigate('/')} timeLeft={0} score={0} />

            {/* View Toggle & Settings */}
            <div style={{ padding: '0 20px', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button
                        className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setViewMode('list')}
                        style={{ flex: 1 }}
                    >
                        📋 목록 보기
                    </button>
                    <button
                        className={`btn ${viewMode === 'flashcard' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setViewMode('flashcard')}
                        style={{ flex: 1 }}
                    >
                        🎴 플래시카드
                    </button>
                </div>

                {viewMode === 'flashcard' && (
                    <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-slate)' }}>앞면 선택</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {[
                                { id: 'image', label: '🖼️ 그림' },
                                { id: 'english', label: '🔤 영어' },
                                { id: 'korean', label: '🇰🇷 한글' }
                            ].map(type => (
                                <button
                                    key={type.id}
                                    className={`word-chip ${frontType === type.id ? 'selected' : ''}`}
                                    onClick={() => {
                                        setFrontType(type.id as any);
                                        setIsFlipped(false);
                                    }}
                                    style={{
                                        flex: 1,
                                        backgroundColor: frontType === type.id ? 'var(--color-secondary-light)' : 'white',
                                        color: frontType === type.id ? 'var(--color-secondary-shadow)' : 'var(--color-ink)',
                                        borderColor: frontType === type.id ? 'var(--color-secondary)' : 'var(--color-ash)',
                                        borderStyle: 'solid'
                                    }}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="word-list" style={{ padding: '8px 20px', flex: 1, overflowY: 'auto' }}>
                {viewMode === 'list' ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                        {words.map(word => (
                            <div key={word.id} style={{
                                padding: 15,
                                backgroundColor: 'white',
                                borderRadius: 10,
                                boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 15
                            }}>
                                {word.imageUrl && (
                                    <img src={word.imageUrl} alt={word.english} style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 8 }} />
                                )}
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: 18 }}>{word.english}</div>
                                    <div style={{ color: '#666' }}>{word.korean}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Flashcard View */
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 0' }}>
                        {words.length > 0 ? (
                            <>
                                <div
                                    className="card"
                                    onClick={() => {
                                        if (!isFlipped) {
                                            speakText(currentWord.english);
                                        }
                                        setIsFlipped(!isFlipped);
                                    }}
                                    style={{
                                        width: '100%',
                                        maxWidth: 480,
                                        aspectRatio: '3/4',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transformStyle: 'preserve-3d',
                                        transition: 'transform 0.6s',
                                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                                        position: 'relative',
                                        backgroundColor: 'transparent',
                                        boxShadow: 'none',
                                        border: 'none',
                                        padding: 0
                                    }}
                                >
                                    {/* Front Face */}
                                    <div style={{
                                        position: 'absolute',
                                        width: '100%',
                                        height: '100%',
                                        backfaceVisibility: 'hidden',
                                        backgroundColor: 'white',
                                        borderRadius: 20,
                                        border: '2px solid var(--color-ash)',
                                        boxShadow: '0 4px 0 var(--color-ash)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 16
                                    }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                speakText(currentWord.english);
                                            }}
                                            className="btn-icon"
                                            style={{
                                                position: 'absolute',
                                                top: 12,
                                                right: 12,
                                                width: 36,
                                                height: 36,
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--color-primary-light)',
                                                color: 'var(--color-primary)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 18,
                                                zIndex: 10
                                            }}
                                            title="발음 듣기"
                                        >
                                            🔊
                                        </button>

                                        {frontType === 'image' && currentWord.imageUrl && (
                                            <img src={currentWord.imageUrl} alt="Quiz" style={{ width: '90%', height: '85%', objectFit: 'contain' }} />
                                        )}
                                        {frontType === 'image' && !currentWord.imageUrl && (
                                            <div style={{ fontSize: 60 }}>🖼️</div>
                                        )}

                                        {frontType === 'english' && (
                                            <div style={{ fontSize: 112, fontWeight: 800, color: 'var(--color-ink)' }}>{currentWord.english}</div>
                                        )}

                                        {frontType === 'korean' && (
                                            <div style={{ fontSize: 112, fontWeight: 800, color: 'var(--color-ink)' }}>{currentWord.korean}</div>
                                        )}
                                    </div>

                                    {/* Back Face */}
                                    <div style={{
                                        position: 'absolute',
                                        width: '100%',
                                        height: '100%',
                                        backfaceVisibility: 'hidden',
                                        backgroundColor: 'var(--color-primary-light)',
                                        borderRadius: 20,
                                        border: '2px solid var(--color-primary)',
                                        boxShadow: '0 4px 0 var(--color-primary-shadow)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 16,
                                        transform: 'rotateY(180deg)'
                                    }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                speakText(currentWord.english);
                                            }}
                                            className="btn-icon"
                                            style={{
                                                position: 'absolute',
                                                top: 12,
                                                right: 12,
                                                width: 36,
                                                height: 36,
                                                borderRadius: '50%',
                                                backgroundColor: 'white',
                                                color: 'var(--color-primary)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: 18,
                                                zIndex: 10
                                            }}
                                            title="발음 듣기"
                                        >
                                            🔊
                                        </button>

                                        {currentWord.imageUrl && (
                                            <img src={currentWord.imageUrl} alt={currentWord.english} style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />
                                        )}
                                        <div style={{ fontSize: 96, fontWeight: 800, color: 'var(--color-ink)', marginBottom: 8 }}>{currentWord.english}</div>
                                        <div style={{ fontSize: 72, fontWeight: 600, color: 'var(--color-slate)' }}>{currentWord.korean}</div>
                                    </div>
                                </div>

                                {/* Navigation */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 24, width: '100%', maxWidth: 480 }}>
                                    <button
                                        className="btn btn-outline"
                                        onClick={handlePrev}
                                        disabled={currentIndex === 0}
                                        style={{ flex: 1 }}
                                    >
                                        ⬅️ 이전
                                    </button>
                                    <div style={{ fontWeight: 700, color: 'var(--color-slate)' }}>
                                        {currentIndex + 1} / {words.length}
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleNext}
                                        disabled={currentIndex === words.length - 1}
                                        style={{ flex: 1 }}
                                    >
                                        다음 ➡️
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', color: 'var(--color-slate)' }}>
                                표시할 단어가 없습니다.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
