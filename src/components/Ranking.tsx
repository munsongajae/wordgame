import React, { useState, useEffect } from 'react';
import { RankingDisplay, RankingRecord } from '../types/ranking';
import { getAllRankings, clearAllRankings, clearRankingsByQuiz, clearRankingsByQuizAndCount } from '../services/rankingService';

interface RankingProps {
  onBack: () => void;
}

const Ranking: React.FC<RankingProps> = ({ onBack }) => {
  const [rankings, setRankings] = useState<RankingDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RankingRecord['quizType'] | 'all'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearType, setClearType] = useState<'all' | 'quiz' | 'quizCount'>('all');
  const [clearTarget, setClearTarget] = useState<{ quizType?: RankingRecord['quizType']; questionCount?: number | 'infinite' }>({});

  const loadRankings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAllRankings();
      setRankings(data);
    } catch (err) {
      console.error('순위 로드 실패:', err);
      setError('순위를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRankings();
  }, []);

  const handleClearAll = () => {
    setClearType('all');
    setShowClearConfirm(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleClearQuiz = (quizType: RankingRecord['quizType']) => {
    setClearType('quiz');
    setClearTarget({ quizType });
    setShowClearConfirm(true);
  };

  const handleClearQuizCount = (quizType: RankingRecord['quizType'], questionCount: number | 'infinite') => {
    setClearType('quizCount');
    setClearTarget({ quizType, questionCount });
    setShowClearConfirm(true);
  };

  const confirmClear = async () => {
    try {
      switch (clearType) {
        case 'all':
          await clearAllRankings();
          break;
        case 'quiz':
          if (clearTarget.quizType) {
            await clearRankingsByQuiz(clearTarget.quizType);
          }
          break;
        case 'quizCount':
          if (clearTarget.quizType && clearTarget.questionCount !== undefined) {
            await clearRankingsByQuizAndCount(clearTarget.quizType, clearTarget.questionCount);
          }
          break;
      }
      await loadRankings();
      setShowClearConfirm(false);
    } catch (err) {
      console.error('순위 초기화 실패:', err);
      setError('순위 초기화 중 오류가 발생했습니다.');
    }
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}분 ${remainingSeconds}초`;
    }
    return `${remainingSeconds}초`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMedalEmoji = (index: number): string => {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `${index + 1}위`;
    }
  };

  const renderAllRankings = () => (
    <div>
      {rankings.map(({ quizType, quizName, records }) => (
        <div key={`${quizType}-${quizName}`} style={{ marginBottom: '30px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '15px',
            padding: '10px 15px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px'
          }}>
            <h3 style={{ 
              color: '#333', 
              margin: 0,
              fontSize: '18px'
            }}>
              {quizName}
            </h3>
            <button 
              onClick={() => {
                const quizType = quizName.includes('그림') ? 'imageQuiz' : 
                               quizName.includes('철자 보고') ? 'spellingQuiz' :
                               quizName.includes('철자 조합') ? 'spellingGame' :
                               quizName.includes('빈칸 채우기') ? 'fillBlankGame' :
                               quizName.includes('영어 문장 만들기') ? 'sentenceGame' :
                               quizName.includes('외계인 침공') ? 'bossRaid' :
                               quizName.includes('단어 메모리') ? 'memoryGame' :
                               quizName.includes('단어 스피드') ? 'speedChallenge' :
                               quizName.includes('뜻') ? 'meaningQuiz' :
                               quizName.includes('듣기') ? 'listeningQuiz' : 'combinedQuiz';
                let questionCount: number | 'infinite';
                if (quizType === 'speedChallenge') {
                  // 스피드 챌린지: 시간 제한으로 해석
                  questionCount = quizName.includes('10초') ? 10 :
                                 quizName.includes('20초') ? 20 :
                                 quizName.includes('30초') ? 30 :
                                 quizName.includes('60초') ? 60 :
                                 quizName.includes('120초') ? 120 : 60;
                } else {
                  // 다른 게임: 문제 수로 해석
                  questionCount = quizName.includes('10문제') ? 10 : 
                                 quizName.includes('20문제') ? 20 : 
                                 quizName.includes('30문제') ? 30 : 'infinite';
                }
                handleClearQuizCount(quizType, questionCount);
              }}
              style={{
                padding: '4px 8px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              🗑️
            </button>
          </div>
          {records.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
              아직 100% 완주 기록이 없습니다
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {records.slice(0, 5).map((record, index) => (
                <div key={record.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 15px',
                  backgroundColor: index < 3 ? '#fff3cd' : '#f8f9fa',
                  border: index < 3 ? '2px solid #ffc107' : '1px solid #dee2e6',
                  borderRadius: '8px',
                  gap: '15px'
                }}>
                  <div style={{ 
                    fontSize: '20px', 
                    fontWeight: 'bold',
                    minWidth: '50px',
                    textAlign: 'center'
                  }}>
                    {getMedalEmoji(index)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                      {record.userName}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      {record.quizType === 'speedChallenge' 
                        ? `${record.questionCount}초` 
                        : record.questionCount === 'infinite' 
                          ? '무제한' 
                          : `${record.questionCount}문제`} • {formatDate(record.date)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {record.quizType === 'speedChallenge' ? (
                      // 스피드 챌린지: 점수(맞춘 개수) 표시
                      <>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#28a745' }}>
                          {record.score}개
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          {formatTime(record.totalTimeMs)}
                        </div>
                      </>
                    ) : record.quizType === 'memoryGame' ? (
                      // 메모리 게임: 이동 횟수와 시간 표시
                      <>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#28a745' }}>
                          {formatTime(record.totalTimeMs)}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          {record.score}회 이동
                        </div>
                      </>
                    ) : (
                      // 다른 게임: 기존 표시
                      <>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#28a745' }}>
                          {formatTime(record.totalTimeMs)}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>
                          {record.score}/{record.totalQuestions}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderQuizRankings = (quizType: RankingRecord['quizType']) => {
    const quizDataList = rankings.filter(r => r.quizType === quizType);
    if (quizDataList.length === 0) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: '#666'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🏆</div>
          <p style={{ fontSize: '16px', fontStyle: 'italic' }}>
            아직 100% 완주 기록이 없습니다
          </p>
          <p style={{ fontSize: '14px', marginTop: '10px' }}>
            첫 번째 완주자가 되어보세요!
          </p>
        </div>
      );
    }

    return (
      <div>
        {quizDataList.map((quizData) => (
          <div key={quizData.quizName} style={{ marginBottom: '30px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px',
              padding: '10px 15px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px'
            }}>
              <h3 style={{ 
                color: '#333', 
                margin: 0,
                fontSize: '20px',
                flex: 1,
                textAlign: 'center'
              }}>
                {quizData.quizName}
              </h3>
              <button 
                onClick={() => {
                  const quizType = quizData.quizName.includes('그림') ? 'imageQuiz' : 
                                 quizData.quizName.includes('철자 보고') ? 'spellingQuiz' :
                                 quizData.quizName.includes('철자 조합') ? 'spellingGame' :
                                 quizData.quizName.includes('빈칸 채우기') ? 'fillBlankGame' : 
                                 quizData.quizName.includes('영어 문장 만들기') ? 'sentenceGame' :
                                 quizData.quizName.includes('보스 레이드') ? 'bossRaid' :
                                 quizData.quizName.includes('단어 메모리') ? 'memoryGame' :
                                 quizData.quizName.includes('단어 스피드') ? 'speedChallenge' :
                                 quizData.quizName.includes('뜻') ? 'meaningQuiz' :
                                 quizData.quizName.includes('듣기') ? 'listeningQuiz' : 'combinedQuiz';
                  let questionCount: number | 'infinite';
                  if (quizType === 'speedChallenge') {
                    // 스피드 챌린지: 시간 제한으로 해석
                    questionCount = quizData.quizName.includes('10초') ? 10 :
                                   quizData.quizName.includes('20초') ? 20 :
                                   quizData.quizName.includes('30초') ? 30 :
                                   quizData.quizName.includes('60초') ? 60 :
                                   quizData.quizName.includes('120초') ? 120 : 60;
                  } else {
                    // 다른 게임: 문제 수로 해석
                    questionCount = quizData.quizName.includes('10문제') ? 10 : 
                                   quizData.quizName.includes('20문제') ? 20 : 
                                   quizData.quizName.includes('30문제') ? 30 : 'infinite';
                  }
                  handleClearQuizCount(quizType, questionCount);
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                🗑️
              </button>
            </div>
            {quizData.records.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '20px',
                color: '#666',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px'
              }}>
                <p style={{ fontSize: '14px', fontStyle: 'italic' }}>
                  아직 이 문제 수의 100% 완주 기록이 없습니다
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {quizData.records.map((record, index) => (
                  <div key={record.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '15px 20px',
                    backgroundColor: index < 3 ? '#fff3cd' : '#ffffff',
                    border: index < 3 ? '3px solid #ffc107' : '2px solid #e9ecef',
                    borderRadius: '12px',
                    gap: '20px',
                    boxShadow: index < 3 ? '0 4px 12px rgba(255, 193, 7, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ 
                      fontSize: '24px', 
                      fontWeight: 'bold',
                      minWidth: '60px',
                      textAlign: 'center'
                    }}>
                      {getMedalEmoji(index)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '4px' }}>
                        {record.userName}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {formatDate(record.date)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {record.quizType === 'speedChallenge' ? (
                        // 스피드 챌린지: 점수(맞춘 개수) 표시
                        <>
                          <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#28a745', marginBottom: '2px' }}>
                            {record.score}개
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>
                            {formatTime(record.totalTimeMs)}
                          </div>
                        </>
                      ) : record.quizType === 'memoryGame' ? (
                        // 메모리 게임: 이동 횟수와 시간 표시
                        <>
                          <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#28a745', marginBottom: '2px' }}>
                            {formatTime(record.totalTimeMs)}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>
                            {record.score}회 이동 (100%)
                          </div>
                        </>
                      ) : (
                        // 다른 게임: 기존 표시
                        <>
                          <div style={{ fontWeight: 'bold', fontSize: '20px', color: '#28a745', marginBottom: '2px' }}>
                            {formatTime(record.totalTimeMs)}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>
                            {record.score}/{record.totalQuestions} (100%)
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="quiz-container">
      <div className="quiz-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        gap: '20px'
      }}>
        <button className="back-button" onClick={onBack}>← 뒤로가기</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: '#333' }}>🏆 순위</h2>
        </div>
        <button 
          onClick={handleClearAll}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          🗑️ 전체 초기화
        </button>
      </div>

      {/* 탭 메뉴 */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '30px',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'all' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'all' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          전체
        </button>
        <button
          onClick={() => setActiveTab('imageQuiz')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'imageQuiz' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'imageQuiz' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          그림
        </button>
        <button
          onClick={() => setActiveTab('spellingQuiz')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'spellingQuiz' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'spellingQuiz' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          철자
        </button>
        <button
          onClick={() => setActiveTab('meaningQuiz')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'meaningQuiz' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'meaningQuiz' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          뜻
        </button>
        <button
          onClick={() => setActiveTab('listeningQuiz')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'listeningQuiz' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'listeningQuiz' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          듣기
        </button>
        <button
          onClick={() => setActiveTab('spellingGame')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'spellingGame' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'spellingGame' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          조합
        </button>
        <button
          onClick={() => setActiveTab('fillBlankGame')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'fillBlankGame' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'fillBlankGame' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          빈칸
        </button>
        <button
          onClick={() => setActiveTab('sentenceGame')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'sentenceGame' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'sentenceGame' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          문장
        </button>
        <button
          onClick={() => setActiveTab('combinedQuiz')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'combinedQuiz' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'combinedQuiz' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          종합
        </button>
        <button
          onClick={() => setActiveTab('bossRaid')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'bossRaid' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'bossRaid' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          외계인 침공
        </button>
        <button
          onClick={() => setActiveTab('memoryGame')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'memoryGame' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'memoryGame' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          메모리
        </button>
        <button
          onClick={() => setActiveTab('speedChallenge')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'speedChallenge' ? '#1976d2' : '#f5f5f5',
            color: activeTab === 'speedChallenge' ? '#fff' : '#333',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          스피드
        </button>
      </div>

      {/* 순위 내용 */}
      <div style={{ 
        backgroundColor: '#ffffff',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 20px' }}></div>
            <p style={{ color: '#666' }}>순위를 불러오는 중...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#dc3545', marginBottom: '20px' }}>{error}</p>
            <button
              onClick={loadRankings}
              style={{
                padding: '10px 20px',
                backgroundColor: '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              다시 시도
            </button>
          </div>
        ) : (
          activeTab === 'all' ? renderAllRankings() : renderQuizRankings(activeTab)
        )}
      </div>

      {/* 안내 문구 */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#1976d2'
      }}>
        💡 100% 정답률로 완주한 기록만 순위에 반영됩니다
      </div>

      {/* 초기화 확인 다이얼로그 */}
      {showClearConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>
              {clearType === 'all' ? '전체 순위 초기화' : 
               clearType === 'quiz' ? `${clearTarget.quizType} 순위 초기화` :
               `${clearTarget.quizType} ${clearTarget.questionCount === 'infinite' ? '무제한' : `${clearTarget.questionCount}문제`} 순위 초기화`}
            </h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              정말로 이 순위를 초기화하시겠습니까?<br/>
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowClearConfirm(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={confirmClear}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ranking;
