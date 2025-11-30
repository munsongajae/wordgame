import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuizHeader } from '../components/common/QuizHeader';
import { useUser } from '../contexts/UserContext';
import { loadRankings } from '../services/rankingService';
import { RankingRecord, UserName } from '../types/ranking';
import { getSupabase } from '../services/supabaseClient';
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
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                setIsLoading(true);
                setError(null);
                console.log('대시보드 데이터 로드 시작, 현재 사용자:', currentUserName);
                
                // rankings 테이블에서 데이터 로드
                const allRankings = await loadRankings();
                console.log('전체 랭킹 데이터:', allRankings);
                
                // sessions 테이블에서도 데이터 로드 (100%가 아닌 기록도 포함)
                const supabase = getSupabase();
                const userIdMap: Record<string, string> = {
                    '열음이': '11111111-1111-1111-1111-111111111111',
                    '지음이': '22222222-2222-2222-2222-222222222222',
                    '규진이': '33333333-3333-3333-3333-333333333333',
                    '규선이': '44444444-4444-4444-4444-444444444444'
                };
                const currentUserId = userIdMap[currentUserName];
                
                let sessionRecords: RankingRecord[] = [];
                if (supabase && currentUserId) {
                    const { data: sessions, error } = await supabase
                        .from('sessions')
                        .select('*')
                        .eq('user_id', currentUserId)
                        .order('created_at', { ascending: false });
                    
                    if (!error && sessions) {
                        sessionRecords = sessions.map(session => {
                            const accuracy = Math.round((session.score / session.total) * 100);
                            return {
                                id: session.id,
                                quizType: session.mode as RankingRecord['quizType'],
                                userName: currentUserName as UserName,
                                score: session.score,
                                totalQuestions: session.total,
                                totalTimeMs: (session.duration_sec || 0) * 1000,
                                accuracy: accuracy,
                                date: session.created_at,
                                questionCount: 'infinite' as const // sessions 테이블에는 question_count가 없으므로 기본값
                            };
                        });
                    }
                }
                
                // rankings와 sessions 데이터 합치기 (rankings 우선)
                const rankingsMap = new Map<string, RankingRecord>();
                
                // 1. rankings 데이터를 먼저 추가 (100% 정답률 기록)
                allRankings.forEach(r => {
                    if (r.userName === currentUserName) {
                        rankingsMap.set(r.id, r);
                    }
                });
                
                // 2. sessions 데이터 추가 (rankings에 없는 경우만, 그리고 100점이 아닌 경우만)
                sessionRecords.forEach(session => {
                    // 같은 퀴즈 타입이고 같은 시간(5초 이내)인 기록이 rankings에 있는지 확인
                    const hasMatchingRanking = Array.from(rankingsMap.values()).some(r => 
                        r.quizType === session.quizType && 
                        Math.abs(new Date(r.date).getTime() - new Date(session.date).getTime()) < 5000
                    );
                    
                    // rankings에 매칭되는 기록이 없고, 100점이 아닌 경우만 추가
                    if (!hasMatchingRanking && session.accuracy < 100) {
                        rankingsMap.set(session.id, session);
                    }
                });
                
                const myRankings = Array.from(rankingsMap.values());
                console.log('필터링된 기록 (rankings + sessions):', myRankings);
                setRecords(myRankings);
            } catch (err) {
                console.error('대시보드 데이터 로드 실패:', err);
                setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setIsLoading(false);
            }
        })();
    }, [currentUserName]);

    // 통계 계산
    const stats = useMemo(() => {
        if (records.length === 0) return null;

        // 100점 달성 기록만 필터링
        const perfectRecords = records.filter(r => r.accuracy === 100);
        const totalClears = perfectRecords.length;
        const totalTimeMs = records.reduce((acc, r) => acc + r.totalTimeMs, 0);

        // 가장 많이 플레이한 게임 찾기 (100점 기록 기준)
        const gameCounts = perfectRecords.reduce((acc, r) => {
            acc[r.quizType] = (acc[r.quizType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const favoriteGameKey = Object.keys(gameCounts).length > 0 
            ? Object.keys(gameCounts).reduce((a, b) => gameCounts[a] > gameCounts[b] ? a : b)
            : null;

        return {
            totalClears,
            totalTimeMinutes: Math.floor(totalTimeMs / 1000 / 60),
            favoriteGame: favoriteGameKey ? (GAME_NAMES[favoriteGameKey] || favoriteGameKey) : '없음'
        };
    }, [records]);

    // 게임별 최고 기록 (100점 우선, 그 다음 최단 시간)
    const bestRecords = useMemo(() => {
        const bests: Record<string, RankingRecord> = {};

        records.forEach(record => {
            // 같은 게임, 같은 문제 수 기준
            const key = `${record.quizType}-${record.questionCount}`;
            if (!bests[key]) {
                bests[key] = record;
            } else {
                // 100점 기록을 우선시
                if (record.accuracy === 100 && bests[key].accuracy !== 100) {
                    bests[key] = record;
                } else if (record.accuracy === 100 && bests[key].accuracy === 100) {
                    // 둘 다 100점이면 시간이 짧은 것 선택
                    if (record.totalTimeMs < bests[key].totalTimeMs) {
                        bests[key] = record;
                    }
                } else if (record.accuracy !== 100 && bests[key].accuracy !== 100) {
                    // 둘 다 100점이 아니면 시간이 짧은 것 선택
                    if (record.totalTimeMs < bests[key].totalTimeMs) {
                        bests[key] = record;
                    }
                }
                // 100점이 아닌 기록은 100점 기록보다 우선순위가 낮음
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

                {isLoading ? (
                    <div className="no-data">
                        <h3>데이터를 불러오는 중...</h3>
                        <p>잠시만 기다려주세요.</p>
                    </div>
                ) : error ? (
                    <div className="no-data">
                        <h3>오류 발생</h3>
                        <p>{error}</p>
                        <button className="empty-state-action" onClick={() => window.location.reload()}>
                            새로고침
                        </button>
                    </div>
                ) : stats ? (
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
                            <div className="stat-card">
                                <div className="stat-value">{records.length}회</div>
                                <div className="stat-label">총 학습 횟수</div>
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
                                                <span className="record-value">{record.score}/{record.totalQuestions} ({record.accuracy}%)</span>
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
                        <p>게임을 플레이하면 기록이 여기에 나타납니다.</p>
                        <button className="empty-state-action" onClick={() => navigate('/game')}>
                            게임 하러 가기 🚀
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
