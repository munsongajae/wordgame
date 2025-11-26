import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuizHeader } from '../components/common/QuizHeader';
import { useUser } from '../contexts/UserContext';
import { loadRankings } from '../services/rankingService';
import { RankingRecord } from '../types/ranking';
import './DashboardPage.css';

const GAME_NAMES: Record<string, string> = {
    imageQuiz: '그림 퀴즈',
    spellingQuiz: '철자 퀴즈',
    meaningQuiz: '뜻 퀴즈',
    listeningQuiz: '듣기 퀴즈',
    spellingGame: '철자 게임',
    fillBlankGame: '빈칸 채우기',
    sentenceGame: '문장 만들기',
    combinedQuiz: '종합 퀴즈',
    bossRaid: '보스 레이드',
    memoryGame: '메모리 게임',
    speedChallenge: '스피드 챌린지'
};

export default function DashboardPage() {
    const navigate = useNavigate();
    const { currentUserName } = useUser();
    const [records, setRecords] = useState<RankingRecord[]>([]);

    useEffect(() => {
        const allRankings = loadRankings();
        // 현재 사용자의 기록만 필터링
        const myRankings = allRankings.filter(r => r.userName === currentUserName);
        setRecords(myRankings);
    }, [currentUserName]);

    // 통계 계산
    const stats = useMemo(() => {
        if (records.length === 0) return null;

        const totalClears = records.length;
        const totalTimeMs = records.reduce((acc, r) => acc + r.totalTimeMs, 0);

        // 가장 많이 플레이한 게임 찾기
        const gameCounts = records.reduce((acc, r) => {
            acc[r.quizType] = (acc[r.quizType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const favoriteGameKey = Object.keys(gameCounts).reduce((a, b) => gameCounts[a] > gameCounts[b] ? a : b);

        return {
            totalClears,
            totalTimeMinutes: Math.floor(totalTimeMs / 1000 / 60),
            favoriteGame: GAME_NAMES[favoriteGameKey] || favoriteGameKey
        };
    }, [records]);

    // 게임별 최고 기록 (최단 시간)
    const bestRecords = useMemo(() => {
        const bests: Record<string, RankingRecord> = {};

        records.forEach(record => {
            // 같은 게임, 같은 문제 수 기준
            const key = `${record.quizType}-${record.questionCount}`;
            if (!bests[key] || record.totalTimeMs < bests[key].totalTimeMs) {
                bests[key] = record;
            }
        });

        return Object.values(bests).sort((a, b) => {
            // 게임 타입별 정렬
            if (a.quizType !== b.quizType) return a.quizType.localeCompare(b.quizType);
            // 문제 수별 정렬
            if (a.questionCount === 'infinite') return 1;
            if (b.questionCount === 'infinite') return -1;
            return (a.questionCount as number) - (b.questionCount as number);
        });
    }, [records]);

    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}분 ${remainingSeconds}초`;
    };

    return (
        <div className="app-container">
            <QuizHeader title="학습 대시보드" onBack={() => navigate('/')} timeLeft={0} score={0} />

            <div className="dashboard-container">
                <div className="dashboard-header">
                    <div className="user-welcome">
                        <h1>안녕하세요, {currentUserName}님! 👋</h1>
                        <p>오늘도 즐겁게 영어를 배워볼까요?</p>
                    </div>
                </div>

                {stats ? (
                    <>
                        <div className="dashboard-stats">
                            <div className="stat-card">
                                <div className="stat-value">{stats.totalClears}회</div>
                                <div className="stat-label">완벽 클리어 (100점)</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{stats.totalTimeMinutes}분</div>
                                <div className="stat-label">총 학습 시간</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-value">{stats.favoriteGame}</div>
                                <div className="stat-label">가장 좋아하는 게임</div>
                            </div>
                        </div>

                        <div className="records-section">
                            <div className="section-title">
                                <span>🏆</span> 나의 명예의 전당 (게임별 최고 기록)
                            </div>

                            <div className="records-grid">
                                {bestRecords.map((record) => (
                                    <div key={record.id} className="record-card">
                                        <div className="game-title">
                                            {GAME_NAMES[record.quizType] || record.quizType}
                                            <span className="game-badge">
                                                {record.questionCount === 'infinite' ? '무제한' : `${record.questionCount}문제`}
                                            </span>
                                        </div>
                                        <div className="record-details">
                                            <div className="record-item">
                                                <span>소요 시간</span>
                                                <span className="record-value">{formatTime(record.totalTimeMs)}</span>
                                            </div>
                                            <div className="record-item">
                                                <span>점수</span>
                                                <span className="record-value">{record.score}점</span>
                                            </div>
                                            <div className="record-item">
                                                <span>달성일</span>
                                                <span className="record-value">
                                                    {new Date(record.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="no-data">
                        <h3>아직 학습 기록이 없어요! 😅</h3>
                        <p>게임을 플레이하고 100점을 받아보세요. 기록이 여기에 나타납니다.</p>
                        <button className="empty-state-action" onClick={() => navigate('/game')}>
                            게임 하러 가기 🚀
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
