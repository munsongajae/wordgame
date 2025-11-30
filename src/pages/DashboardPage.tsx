import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuizHeader } from '../components/common/QuizHeader';
import { useUser } from '../contexts/UserContext';
import { loadRankings } from '../services/rankingService';
import { RankingRecord, UserName } from '../types/ranking';
import { getSupabase } from '../services/supabaseClient';
import { deleteAllRecords, deleteRecordsByDate } from '../services/dashboardService';
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
    bossRaid: '외계인 침공',
    memoryGame: '메모리 게임',
    speedChallenge: '스피드 챌린지'
};

export default function DashboardPage() {
    const navigate = useNavigate();
    const { currentUserName } = useUser();
    const [records, setRecords] = useState<RankingRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [isDeleting, setIsDeleting] = useState(false);


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

    const loadData = async () => {
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
                            questionCount: 'infinite' as const
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
                const hasMatchingRanking = Array.from(rankingsMap.values()).some(r => 
                    r.quizType === session.quizType && 
                    Math.abs(new Date(r.date).getTime() - new Date(session.date).getTime()) < 5000
                );
                
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
    };

    useEffect(() => {
        loadData();
    }, [currentUserName]);

    const handleDeleteAll = async () => {
        if (!window.confirm('정말 모든 학습 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        setIsDeleting(true);
        try {
            const result = await deleteAllRecords(currentUserName as UserName);
            if (result.success) {
                alert('모든 학습 기록이 삭제되었습니다.');
                setShowDeleteModal(false);
                await loadData();
            } else {
                alert(`삭제 실패: ${result.error}`);
            }
        } catch (error) {
            console.error('삭제 중 오류:', error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteByDate = async () => {
        if (!selectedDate) {
            alert('날짜를 선택해주세요.');
            return;
        }

        const date = new Date(selectedDate);
        if (!window.confirm(`${date.toLocaleDateString('ko-KR')}의 모든 학습 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const result = await deleteRecordsByDate(currentUserName as UserName, date);
            if (result.success) {
                alert(`${date.toLocaleDateString('ko-KR')}의 학습 기록이 삭제되었습니다. (${result.deletedCount || 0}개)`);
                setShowDatePicker(false);
                setSelectedDate('');
                await loadData();
            } else {
                alert(`삭제 실패: ${result.error}`);
            }
        } catch (error) {
            console.error('삭제 중 오류:', error);
            alert('삭제 중 오류가 발생했습니다.');
        } finally {
            setIsDeleting(false);
        }
    };

    // 기록이 있는 날짜 목록 추출
    const availableDates = useMemo(() => {
        const dateSet = new Set<string>();
        records.forEach(record => {
            const date = new Date(record.date);
            const dateStr = date.toISOString().split('T')[0];
            dateSet.add(dateStr);
        });
        return Array.from(dateSet).sort().reverse();
    }, [records]);

    return (
        <div className="app-container">
            <QuizHeader title="학습 대시보드" onBack={() => navigate('/')} timeLeft={0} score={0} />

            <div className="dashboard-container">
                <div className="dashboard-header">
                    <div className="user-welcome">
                        <h1>안녕하세요, {currentUserName}님! 👋</h1>
                        <p>오늘도 즐겁게 영어를 배워볼까요?</p>
                    </div>
                    {records.length > 0 && (
                        <div className="dashboard-actions">
                            <button 
                                className="btn-danger-outline" 
                                onClick={() => setShowDeleteModal(true)}
                                style={{ marginRight: '8px' }}
                            >
                                🗑️ 전체 초기화
                            </button>
                            <button 
                                className="btn-danger-outline" 
                                onClick={() => setShowDatePicker(true)}
                            >
                                📅 날짜별 삭제
                            </button>
                        </div>
                    )}
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

                {/* 삭제 모달 */}
                {showDeleteModal && (
                    <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <h3>전체 기록 삭제</h3>
                            <p>모든 학습 기록을 삭제하시겠습니까?</p>
                            <p style={{ color: '#d32f2f', fontSize: '0.9rem', marginTop: '8px' }}>
                                ⚠️ 이 작업은 되돌릴 수 없습니다.
                            </p>
                            <div className="modal-actions">
                                <button 
                                    className="btn-danger" 
                                    onClick={handleDeleteAll}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? '삭제 중...' : '삭제'}
                                </button>
                                <button 
                                    className="btn-secondary" 
                                    onClick={() => setShowDeleteModal(false)}
                                    disabled={isDeleting}
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 날짜 선택 모달 */}
                {showDatePicker && (
                    <div className="modal-overlay" onClick={() => !isDeleting && setShowDatePicker(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <h3>날짜별 기록 삭제</h3>
                            <p>삭제할 날짜를 선택하세요.</p>
                            <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="date-input"
                                    max={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            {availableDates.length > 0 && (
                                <div style={{ marginBottom: '16px' }}>
                                    <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '8px' }}>
                                        기록이 있는 날짜:
                                    </p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {availableDates.slice(0, 10).map(date => (
                                            <button
                                                key={date}
                                                className="date-chip"
                                                onClick={() => setSelectedDate(date)}
                                                style={{
                                                    backgroundColor: selectedDate === date ? '#1976d2' : '#f5f5f5',
                                                    color: selectedDate === date ? 'white' : '#333',
                                                    border: `1px solid ${selectedDate === date ? '#1976d2' : '#ddd'}`,
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.9rem'
                                                }}
                                            >
                                                {new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button 
                                    className="btn-danger" 
                                    onClick={handleDeleteByDate}
                                    disabled={isDeleting || !selectedDate}
                                >
                                    {isDeleting ? '삭제 중...' : '삭제'}
                                </button>
                                <button 
                                    className="btn-secondary" 
                                    onClick={() => {
                                        setShowDatePicker(false);
                                        setSelectedDate('');
                                    }}
                                    disabled={isDeleting}
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
