import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWords } from '../contexts/WordsContext';
import { useUser } from '../contexts/UserContext';
import { UserName } from '../types/ranking';

export default function HomePage() {
    const navigate = useNavigate();
    const {
        words,
        allWords,
        isLoading,
        error,
        refreshWords,
        selectedCategories,
        setSelectedCategories
    } = useWords();
    const { currentUserName, switchUser } = useUser();

    // 카테고리 선택 핸들러
    const handleCategoryToggle = (category: string) => {
        if (category === 'all') {
            setSelectedCategories(['all']);
            return;
        }

        let newCategories = [...selectedCategories];

        // 'all'이 선택되어 있었다면 제거
        if (newCategories.includes('all')) {
            newCategories = [];
        }

        if (newCategories.includes(category)) {
            newCategories = newCategories.filter(c => c !== category);
        } else {
            newCategories.push(category);
        }

        // 아무것도 선택되지 않으면 'all'로 설정
        if (newCategories.length === 0) {
            newCategories = ['all'];
        }

        setSelectedCategories(newCategories);
    };

    // 카테고리 목록 추출
    const categories = Array.from(new Set(allWords.map(w => w.category).filter(Boolean))) as string[];

    if (isLoading) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div className="loading-spinner"></div>
                <p style={{ marginTop: 20, fontSize: 18, fontWeight: 700, color: 'var(--color-slate)' }}>데이터를 불러오는 중입니다...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
                    <h2 style={{ color: 'var(--color-danger)', marginBottom: 16 }}>오류 발생</h2>
                    <p style={{ marginBottom: 24, color: 'var(--color-slate)' }}>{error}</p>
                    <button className="btn btn-primary" onClick={() => refreshWords(true)}>
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <div className="app-main">
                {/* Header */}
                <header className="dashboard-header">
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-primary)', marginBottom: 4 }}>
                            세계 여행을 위한{' '}
                            <span
                                style={{
                                    color: '#6366f1',
                                    fontWeight: 900,
                                    fontSize: '1.15em',
                                    textShadow: '0 2px 6px rgba(99, 102, 241, 0.3)',
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                }}
                            >
                                {currentUserName}
                            </span>
                            의 영어 공부
                        </h1>
                        <p style={{ fontSize: 16, color: 'var(--color-slate)', fontWeight: 600 }}>Word Game</p>
                    </div>
                    <div className="user-profile">
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {(['열음이', '지음이', '규진이', '규선이'] as UserName[]).map((userName) => {
                                // 규진이는 '진', 규선이는 '선'으로 표시
                                let displayChar = userName[0];
                                if (userName === '규진이') {
                                    displayChar = '진';
                                } else if (userName === '규선이') {
                                    displayChar = '선';
                                }
                                
                                return (
                                    <button
                                        key={userName}
                                        className="avatar-circle"
                                        onClick={() => switchUser(userName)}
                                        title={userName}
                                        style={{
                                            cursor: 'pointer',
                                            opacity: currentUserName === userName ? 1 : 0.5,
                                            transform: currentUserName === userName ? 'scale(1.1)' : 'scale(1)',
                                            transition: 'all 0.2s ease',
                                            border: currentUserName === userName ? '2px solid var(--color-primary)' : '2px solid transparent',
                                        }}
                                    >
                                        {displayChar}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </header>

                {/* Stats */}
                <section className="stats-grid">
                    <div className="stat-item">
                        <div className="stat-value">{words.length}</div>
                        <div className="stat-label">총 단어</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-value" style={{ color: 'var(--color-accent)' }}>0</div>
                        <div className="stat-label">오늘의 학습</div>
                    </div>
                </section>

                {/* Main Menu */}
                <section style={{ marginBottom: 48 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, color: 'var(--color-ink)' }}>학습 메뉴</h2>
                    <div className="game-grid">
                        <div className="game-card" onClick={() => navigate('/words')}>
                            <div className="game-icon">📚</div>
                            <div className="game-title">단어장</div>
                            <div className="game-desc">단어 목록을 확인하고 학습합니다.</div>
                            <button className="btn btn-outline" style={{ width: '100%' }}>열기</button>
                        </div>
                        <div className="game-card" onClick={() => navigate('/quiz')}>
                            <div className="game-icon">📝</div>
                            <div className="game-title">퀴즈</div>
                            <div className="game-desc">다양한 퀴즈로 실력을 테스트합니다.</div>
                            <button className="btn btn-secondary" style={{ width: '100%' }}>시작하기</button>
                        </div>
                        <div className="game-card" onClick={() => navigate('/game')}>
                            <div className="game-icon">🎮</div>
                            <div className="game-title">게임</div>
                            <div className="game-desc">재미있는 게임으로 영어를 배웁니다.</div>
                            <button className="btn btn-primary" style={{ width: '100%' }}>플레이</button>
                        </div>
                        <div className="game-card" onClick={() => navigate('/dashboard')}>
                            <div className="game-icon">📊</div>
                            <div className="game-title">대시보드</div>
                            <div className="game-desc">나의 학습 기록을 한눈에 봅니다.</div>
                            <button className="btn btn-outline" style={{ width: '100%' }}>보러가기</button>
                        </div>
                        <div className="game-card" onClick={() => navigate('/ranking')}>
                            <div className="game-icon">🏆</div>
                            <div className="game-title">랭킹</div>
                            <div className="game-desc">나의 순위를 확인합니다.</div>
                            <button className="btn btn-outline" style={{ width: '100%' }}>확인하기</button>
                        </div>
                        <div className="game-card" onClick={() => navigate('/board')}>
                            <div className="game-icon">💬</div>
                            <div className="game-title">게시판</div>
                            <div className="game-desc">자유롭게 이야기를 나눕니다.</div>
                            <button className="btn btn-outline" style={{ width: '100%' }}>이동하기</button>
                        </div>
                    </div>
                </section>

                {/* Settings */}
                <section className="card">
                    <h2 className="card-title">학습 설정</h2>

                    {categories.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                            <h3 className="card-subtitle" style={{ marginBottom: 12 }}>카테고리</h3>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    className={`word-chip ${selectedCategories.includes('all') ? 'selected' : ''}`}
                                    onClick={() => handleCategoryToggle('all')}
                                    style={{
                                        backgroundColor: selectedCategories.includes('all') ? 'var(--color-secondary-light)' : 'white',
                                        color: selectedCategories.includes('all') ? 'var(--color-secondary-shadow)' : 'var(--color-ink)',
                                        borderColor: selectedCategories.includes('all') ? 'var(--color-secondary)' : 'var(--color-ash)',
                                        borderStyle: 'solid'
                                    }}
                                >
                                    전체
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        className={`word-chip ${selectedCategories.includes(cat) ? 'selected' : ''}`}
                                        onClick={() => handleCategoryToggle(cat)}
                                        style={{
                                            backgroundColor: selectedCategories.includes(cat) ? 'var(--color-secondary-light)' : 'white',
                                            color: selectedCategories.includes(cat) ? 'var(--color-secondary-shadow)' : 'var(--color-ink)',
                                            borderColor: selectedCategories.includes(cat) ? 'var(--color-secondary)' : 'var(--color-ash)',
                                            borderStyle: 'solid'
                                        }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <h3 className="card-subtitle" style={{ marginBottom: 12 }}>데이터 관리</h3>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <a
                                href={`https://docs.google.com/spreadsheets/d/${process.env.REACT_APP_GOOGLE_SHEET_ID}/edit`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline"
                                style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                <span>📊</span> 구글 시트 바로가기
                            </a>
                            <button
                                className="btn btn-outline"
                                onClick={() => refreshWords(true)}
                                title="데이터 새로고침"
                            >
                                🔄
                            </button>
                        </div>
                    </div>


                </section>
            </div>
        </div>
    );
}
