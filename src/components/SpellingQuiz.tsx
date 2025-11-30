import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Word } from '../types/word';
import { pickRandom } from '../utils/array';
import { QUIZ_CONSTANTS } from '../utils/constants';
import { useSound } from '../hooks/useSound';
import { useTTS } from '../hooks/useTTS';
import { useTimer } from '../hooks/useTimer';
import { useTracking } from '../hooks/useTracking';
import { useWords } from '../contexts/WordsContext';

import { QuizResult } from './common/QuizResult';
import { addRecord, isNewRecord, createRecordFromQuizResult } from '../services/rankingService';

export default function SpellingQuiz() {
  const navigate = useNavigate();
  const { words } = useWords();
  const hasEnough = words.length >= QUIZ_CONSTANTS.NUM_OPTIONS;

  // 퀴즈 설정
  const [questionCount, setQuestionCount] = useState<null | number | 'infinite'>(null);
  const [questions, setQuestions] = useState<Word[]>([]);
  const [quizStartTime, setQuizStartTime] = useState(0);

  // 퀴즈 상태
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0); // 점수를 ref로도 추적하여 비동기 업데이트 문제 해결
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [finished, setFinished] = useState(false);
  const [wrongQuestions, setWrongQuestions] = useState<Word[]>([]);
  const [isNewRecordAchieved, setIsNewRecordAchieved] = useState(false);

  // Hooks
  const { playCorrect, playWrong, playRecord, playTimer } = useSound();
  const { speak } = useTTS();
  const { logAnswer, updateWordProgress, saveQuizSession, sessionId } = useTracking('spellingQuiz');

  const currentQuestion = questions[index] || null;

  // 타이머
  const { timeLeft, reset: resetTimer } = useTimer({
    onExpire: useCallback(() => {
      if (selected === null && currentQuestion) {
        handleTimeExpire();
      }
    }, [selected, currentQuestion]),
    onThreeSeconds: playTimer,
  });

  // 퀴즈 초기화
  useEffect(() => {
    if (!hasEnough || questionCount === null) return;

    const count = questionCount === 'infinite'
      ? Math.min(30, words.length)
      : Math.min(questionCount, words.length);

    setQuestions(pickRandom(words, count));
    setIndex(0);
    setSelected(null);
    setScore(0);
    scoreRef.current = 0; // ref도 초기화
    setIsCorrect(null);
    setFinished(false);
    setWrongQuestions([]);
    setIsNewRecordAchieved(false);
  }, [words, hasEnough, questionCount]);

  // 문제 변경 시 타이머 리셋 및 시작 시간 기록
  useEffect(() => {
    if (finished || !currentQuestion) return;

    resetTimer();

    // 첫 문제 시작 시 시간 기록
    if (index === 0 && quizStartTime === 0) {
      setQuizStartTime(Date.now());
    }
  }, [index, finished, currentQuestion, resetTimer]);

  // 옵션 생성 (철자 퀴즈는 영어 단어 옵션)
  const options = useMemo(() => {
    if (!currentQuestion) return [] as Word[];

    const others = pickRandom(
      words.filter(w => w.id !== currentQuestion.id),
      QUIZ_CONSTANTS.NUM_OPTIONS - 1
    );
    const pool = [...others, currentQuestion];
    return pickRandom(pool, pool.length);
  }, [currentQuestion, words]);

  // 시간 초과 처리
  const handleTimeExpire = () => {
    if (!currentQuestion) return;

    playWrong();
    setWrongQuestions(prev =>
      prev.some(w => w.id === currentQuestion.id) ? prev : [...prev, currentQuestion]
    );
    logAnswer(currentQuestion.id, false);
    updateWordProgress(currentQuestion.id, false);
    setSelected(-1);

    // 자동으로 다음 문제로
    setTimeout(() => nextQuestion(), QUIZ_CONSTANTS.AUTO_NEXT_DELAY_MS);
  };

  // 선택
  const handleSelect = (option: Word) => {
    if (!currentQuestion || timeLeft === 0 || isCorrect !== null) return;
    const optIndex = options.findIndex(w => w.id === option.id);
    if (optIndex === -1) return;
    // 같은 선택지를 다시 클릭하면 해제
    if (selected === optIndex) {
      setSelected(null);
    } else {
      // 다른 선택지 클릭 시 변경
      setSelected(optIndex);
    }
  };

  // 정답 확인
  const handleCheckAnswer = () => {
    if (selected === null || !currentQuestion || !options[selected] || isCorrect !== null) return;

    const correct = options[selected].id === currentQuestion.id;
    setIsCorrect(correct);

    if (correct) {
      setScore(s => {
        const newScore = s + 1;
        scoreRef.current = newScore; // ref도 동시에 업데이트
        return newScore;
      });
      playCorrect();
    } else {
      playWrong();
      setWrongQuestions(prev =>
        prev.some(w => w.id === currentQuestion.id) ? prev : [...prev, currentQuestion]
      );
    }

    logAnswer(currentQuestion.id, correct);
    updateWordProgress(currentQuestion.id, correct);

    // 2초 후 다음 문제로
    setTimeout(() => nextQuestion(), 2000);
  };

  // 다음 문제
  const nextQuestion = () => {
    if (!currentQuestion) {
      navigate(-1);
      return;
    }

    if (index + 1 >= questions.length) {
      // 무제한 모드
      if (questionCount === 'infinite') {
        const count = Math.min(30, words.length);
        setQuestions(pickRandom(words, count));
        setIndex(0);
        setSelected(null);
        setIsCorrect(null);
        resetTimer();
        setQuizStartTime(Date.now());
        return;
      }

      // 퀴즈 종료
      setFinished(true);
      const totalTimeMs = Date.now() - quizStartTime;
      const durationSec = Math.round(totalTimeMs / 1000);
      // ref에서 최신 점수를 가져와서 사용 (비동기 상태 업데이트 문제 해결)
      const finalScore = scoreRef.current || score;
      const accuracy = Math.round((finalScore / questions.length) * 100);

      saveQuizSession(finalScore, questions.length, durationSec);

      // 100% 정답률이면 무조건 기록 저장 (신기록 여부와 관계없이)
      (async () => {
        if (accuracy === 100) {
          const record = createRecordFromQuizResult(
            'spellingQuiz',
            finalScore,
            questions.length,
            quizStartTime,
            Date.now(),
            questionCount || 'infinite'
          );
          const success = await addRecord(record);
          if (success) {
            // 신기록인지 확인하여 UI 피드백
            const isNew = await isNewRecord('spellingQuiz', totalTimeMs, accuracy, questionCount || 'infinite');
            if (isNew) {
              setIsNewRecordAchieved(true);
            }
          }
        }
      })();
      
      // 엔딩 사운드 재생 (신기록 여부와 관계없이)
      playRecord();
      return;
    }

    setIndex(i => i + 1);
    setSelected(null);
    setIsCorrect(null);
  };

  // 재시작
  const handleRestart = () => {
    setQuestionCount(null);
    setScore(0);
    setIndex(0);
    setSelected(null);
    setIsCorrect(null);
    setFinished(false);
    setWrongQuestions([]);
    setIsNewRecordAchieved(false);
  };

  // 문제 수가 부족한 경우
  if (!hasEnough) {
    return (
      <div className="app-container">
        <div className="app-main">
          <header className="game-header">
            <button className="close-btn" onClick={() => navigate(-1)}>✕</button>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: '0%' }}></div>
            </div>
            <div style={{ fontWeight: 800, color: 'var(--color-primary)' }}>0</div>
          </header>
          <div className="question-area">
            <h2 className="question-text">✍️ 철자 맞추기</h2>
            <p>문제를 만들기 위해 최소 {QUIZ_CONSTANTS.NUM_OPTIONS}개 이상의 단어가 필요합니다.</p>
          </div>
        </div>
      </div>
    );
  }

  // 문제 수 선택
  if (questionCount === null) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 500 }}>
          <h2 className="card-title">🔤 철자 맞추기</h2>
          <p className="card-subtitle" style={{ marginBottom: 24 }}>단어의 철자를 맞추세요</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button className="btn btn-outline" onClick={() => setQuestionCount(10)}>10문제</button>
            <button className="btn btn-outline" onClick={() => setQuestionCount(20)}>20문제</button>
            <button className="btn btn-outline" onClick={() => setQuestionCount(30)}>30문제</button>
            <button className="btn btn-outline" onClick={() => setQuestionCount(null)}>전체</button>
          </div>
          <button className="btn btn-secondary" onClick={() => setQuestionCount('infinite')} style={{ marginTop: 12, width: '100%' }}>무제한 모드</button>
          <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ marginTop: 24 }}>뒤로가기</button>
        </div>
      </div>
    );
  }

  // 결과 화면
  if (finished) {
    const duration = Math.round((Date.now() - quizStartTime) / 1000);
    return (
      <div className="app-container">
        <QuizResult
          score={score}
          total={questions.length}
          duration={duration}
          isNewRecord={isNewRecordAchieved}
          wrongWords={wrongQuestions}
          onRestart={handleRestart}
          onBack={() => navigate(-1)}
        />
      </div>
    );
  }

  // 영어 단어 보여주고 철자 맞추기
  const progress = questions.length > 0 ? ((index + 1) / questions.length) * 100 : 0;

  return (
    <div className="app-container">
      <div className="app-main">
        {/* Header */}
        <header className="game-header">
          <button className="close-btn" onClick={() => navigate(-1)}>✕</button>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{score}</div>
        </header>

        {currentQuestion && (
          <>
            {/* Question Area */}
            <div className="question-area">
              <div className="question-text">다음 한국어 뜻에 맞는 영어 철자를 고르세요</div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '12px 16px',
                  margin: '12px 0',
                  backgroundColor: '#ffffff',
                  border: '2px solid #e0e0e0',
                  borderRadius: '14px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: '#333', lineHeight: 1.3 }}>
                  {currentQuestion.korean}
                </div>
              </div>
              <div style={{ color: 'var(--color-slate)', fontWeight: 700 }}>
                ⏰ {timeLeft}초
              </div>
            </div>

            {/* 옵션 */}
            <div
              className="options"
              style={{
                display: 'grid',
                gap: 8,
                gridTemplateColumns: '1fr',
                justifyItems: 'center',
                maxWidth: 560,
                margin: '0 auto',
              }}
            >
              {options.map((w, i) => {
                const isThisCorrect = selected !== null && w.id === currentQuestion.id;
                const isThisWrong = selected === i && isCorrect !== null && !isCorrect;

                return (
                  <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => handleSelect(w)}
                      className={`option-button ${isThisCorrect ? 'correct' : ''} ${isThisWrong ? 'incorrect' : ''
                        }`}
                      disabled={timeLeft === 0 || isCorrect !== null}
                      style={{
                        fontSize: 28,
                        lineHeight: '1.2',
                        width: 240,
                        textAlign: 'center',
                        padding: '10px 20px',
                        borderRadius: 16,
                        border: '2px solid #e0e0e0',
                        backgroundColor:
                          selected === null
                            ? '#fff'
                            : isCorrect !== null
                              ? isThisCorrect
                                ? '#4CAF50'
                                : isThisWrong
                                  ? '#F44336'
                                  : '#f5f5f5'
                              : selected === i
                                ? '#2196F3'
                                : '#f5f5f5',
                        color:
                          selected === null
                            ? '#333'
                            : isCorrect !== null
                              ? isThisCorrect || isThisWrong
                                ? '#fff'
                                : '#666'
                              : selected === i
                                ? '#fff'
                                : '#666',
                        boxShadow: selected === null ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.2s ease',
                        cursor: timeLeft === 0 || isCorrect !== null ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {w.english}
                    </button>
                    <button
                      type="button"
                      aria-label={`${w.english} 발음 듣기`}
                      onClick={() => speak(w.english)}
                      style={{
                        padding: '8px 10px',
                        fontSize: 18,
                        backgroundColor: '#1976d2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(25,118,210,0.25)',
                      }}
                    >
                      🔊
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 확인 버튼 */}
            {selected !== null && isCorrect === null && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <button
                  onClick={handleCheckAnswer}
                  style={{
                    padding: '15px 30px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    backgroundColor: '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    minHeight: '60px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  ✅ 정답 확인
                </button>
              </div>
            )}

            {/* 정답/오답 표시 */}
            {isCorrect !== null && (
              <div className={`feedback-overlay ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`}>
                <div className="feedback-content" style={{ justifyContent: 'center' }}>
                  <div className="feedback-message">
                    {isCorrect ? '정답입니다! 🎉' : '아쉽네요!'}
                    {!isCorrect && <div style={{ fontSize: 18, marginTop: 8, fontWeight: 600 }}>정답: {currentQuestion.english}</div>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
