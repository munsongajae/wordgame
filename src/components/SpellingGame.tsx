import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Word } from '../types/word';
import { useWords } from '../contexts/WordsContext';
import { logAttempt, saveSession, updateProgress } from '../services/trackingService';
import { createRecordFromQuizResult, isNewRecord, addRecord } from '../services/rankingService';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NUM_OPTIONS = 4;
const COUNTDOWN_BEEP_DURATION = 0.2;
const AUTO_NEXT_DELAY_MS = 1500;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pickRandom<T>(array: T[], count: number): T[] {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, count);
}

const SpellingGame: React.FC = () => {
  const navigate = useNavigate();
  const { words } = useWords();
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [quizStartTime, setQuizStartTime] = useState(0);
  const [showNewRecord, setShowNewRecord] = useState(false);

  // 게임 상태
  const [shuffledLetters, setShuffledLetters] = useState<string[]>([]);
  const [userAnswer, setUserAnswer] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const scoreRef = useRef(0);
  const autoNextTimeoutRef = useRef<number | null>(null);

  // 점수 동기화
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // 사운드 효과들 (기존 로직 유지)
  const playCorrectSound = useCallback(() => {
    try {
      const audio = new Audio('/success.mp3');
      audio.volume = 0.7;
      audio.play().catch(console.error);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const playWrongSound = useCallback(() => {
    try {
      const audio = new Audio('/wrong.mp3');
      audio.volume = 0.7;
      audio.play().catch(console.error);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const playRecordSound = useCallback(() => {
    try {
      const audio = new Audio('/record.mp3');
      audio.volume = 0.8;
      audio.play().catch(console.error);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const playCountdownBeep = () => {
    try {
      const audio = new Audio('/timer.mp3');
      audio.volume = 0.5;
      audio.play().catch(console.error);
    } catch (error) {
      console.error(error);
    }
  };

  const current = questions[index] || null;

  // 문제 수 선택
  const handleQuestionCountSelect = (count: number | 'infinite') => {
    if (count === 'infinite') {
      setQuestionCount(null);
      setQuestions(pickRandom(words, Math.min(words.length, 50)));
    } else {
      setQuestionCount(count);
      setQuestions(pickRandom(words, count));
    }
  };

  // 문제 초기화
  useEffect(() => {
    if (current && questions.length > 0) {
      const letters = current.english.toUpperCase().split('');
      setShuffledLetters(shuffleArray(letters));
      setUserAnswer([]);
      setSelectedIndices([]);
      setIsCorrect(null);

      // 단어 길이에 따른 시간 설정
      const baseTime = Math.max(15, current.english.length * 3);
      setTimeLeft(baseTime);
    }
  }, [current, questions.length]);

  // 타이머
  useEffect(() => {
    if (finished || !current) return;

    if (index === 0 && quizStartTime === 0) {
      setQuizStartTime(Date.now());
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (isCorrect === null && current) {
            playWrongSound();
            logAttempt({ sessionId, mode: 'spellingGame', wordId: current.id, correct: false });
            updateProgress({ wordId: current.id, correct: false });
            setIsCorrect(false);

            if (autoNextTimeoutRef.current !== null) {
              clearTimeout(autoNextTimeoutRef.current);
            }
            autoNextTimeoutRef.current = window.setTimeout(() => {
              autoNextTimeoutRef.current = null;
              next();
            }, AUTO_NEXT_DELAY_MS);
          }
        }
        const nextValue = Math.max(0, prev - 1);
        if (isCorrect === null && nextValue === 3) {
          playCountdownBeep();
        }
        return nextValue;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished, current, isCorrect]);

  // 글자 선택
  const handleLetterClick = (letterIndex: number) => {
    if (isCorrect !== null || selectedIndices.includes(letterIndex)) return;

    const newSelectedIndices = [...selectedIndices, letterIndex];
    const newUserAnswer = [...userAnswer, shuffledLetters[letterIndex]];

    setSelectedIndices(newSelectedIndices);
    setUserAnswer(newUserAnswer);
  };

  // 입력된 글자 제거
  const handleAnswerLetterClick = (answerIndex: number) => {
    if (isCorrect !== null) return;

    const newUserAnswer = userAnswer.filter((_, index) => index !== answerIndex);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const removedLetterIndex = selectedIndices[answerIndex];
    const newSelectedIndices = selectedIndices.filter((_, index) => index !== answerIndex);

    setUserAnswer(newUserAnswer);
    setSelectedIndices(newSelectedIndices);
  };

  // 정답 확인 버튼 핸들러
  const handleCheckAnswer = () => {
    if (isCorrect !== null || !current) return;

    const answer = userAnswer.join('');
    const correct = answer.toLowerCase() === current.english.toLowerCase();
    setIsCorrect(correct);

    if (correct) {
      playCorrectSound();
      setScore(prev => prev + 1);
      logAttempt({ sessionId, mode: 'spellingGame', wordId: current.id, correct: true });
      updateProgress({ wordId: current.id, correct: true });
    } else {
      playWrongSound();
      logAttempt({ sessionId, mode: 'spellingGame', wordId: current.id, correct: false });
      updateProgress({ wordId: current.id, correct: false });
    }

    setTimeout(() => {
      next();
    }, 2000);
  };

  // 다음 문제
  const next = () => {
    if (index + 1 >= questions.length) {
      const finalScore = scoreRef.current;
      const accuracy = Math.round((finalScore / questions.length) * 100);
      const durationSec = Math.round((Date.now() - quizStartTime) / 1000);
      const totalTimeMs = durationSec * 1000;

      saveSession({
        sessionIdHint: sessionId,
        mode: 'spellingGame',
        score: finalScore,
        total: questions.length,
        durationSec
      });

      // 100% 정답률이면 무조건 기록 저장 (신기록 여부와 관계없이)
      (async () => {
        try {
          if (accuracy === 100) {
            const record = createRecordFromQuizResult(
              'spellingGame',
              finalScore,
              questions.length,
              quizStartTime,
              Date.now(),
              questionCount || 'infinite'
            );
            const success = await addRecord(record);
            if (success) {
              // 신기록인지 확인하여 UI 피드백
              const isNewRecordResult = await isNewRecord('spellingGame', totalTimeMs, accuracy, questionCount || 'infinite');
              if (isNewRecordResult) {
                setShowNewRecord(true);
              } else {
                setShowNewRecord(false);
              }
            }
          } else {
            setShowNewRecord(false);
          }
        } catch (e) {
          console.warn('신기록 처리 중 오류(무시 가능):', e);
        }
      })();

      setFinished(true);
      
      // 엔딩 사운드 재생 (신기록 여부와 관계없이)
      playRecordSound();

      if (questionCount === null) {
        setQuestions(pickRandom(words, Math.min(words.length, 50)));
        setQuizStartTime(0);
      }
    } else {
      setIndex(index + 1);
    }
  };

  // 문제 수 선택 화면
  if (questionCount === null && questions.length === 0) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 500 }}>
          <h2 className="card-title">🔤 철자 조합 게임</h2>
          <p className="card-subtitle" style={{ marginBottom: 24 }}>섞인 글자를 올바른 순서로 배열하세요!</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[10, 20, 30].map(count => (
              <button key={count} className="btn btn-outline" onClick={() => handleQuestionCountSelect(count)}>
                {count}문제
              </button>
            ))}
            <button className="btn btn-outline" onClick={() => handleQuestionCountSelect('infinite')}>
              전체
            </button>
          </div>
          <button className="btn btn-secondary" onClick={() => handleQuestionCountSelect('infinite')} style={{ marginTop: 12, width: '100%' }}>
            무제한 모드
          </button>
          <button className="btn btn-outline" onClick={() => navigate('/quiz')} style={{ marginTop: 24 }}>
            뒤로가기
          </button>
        </div>
      </div>
    );
  }

  // 단어가 없는 경우
  if (words.length === 0) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2 className="card-title">단어가 없습니다</h2>
          <p className="card-subtitle">먼저 단어를 추가해주세요.</p>
          <button className="btn btn-primary" onClick={() => navigate('/quiz')}>뒤로 가기</button>
        </div>
      </div>
    );
  }

  // 퀴즈 완료 화면
  if (finished) {
    const accuracy = Math.round((scoreRef.current / questions.length) * 100);
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2 className="card-title">🎉 퀴즈 완료!</h2>
          {showNewRecord && <div style={{ color: 'var(--color-accent)', fontWeight: 800, marginBottom: 16 }}>🏆 신기록 달성!</div>}

          <div className="stats-grid" style={{ marginTop: 24 }}>
            <div className="stat-item">
              <div className="stat-value">{scoreRef.current}</div>
              <div className="stat-label">점수</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{accuracy}%</div>
              <div className="stat-label">정답률</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => {
              setQuestions(pickRandom(words, questionCount || 50));
              setIndex(0);
              setScore(0);
              setFinished(false);
              setQuizStartTime(0);
              setShowNewRecord(false);
            }} style={{ flex: 1 }}>다시 도전</button>
            <button className="btn btn-secondary" onClick={() => {
              setQuestionCount(null);
              setQuestions([]);
              setIndex(0);
              setScore(0);
              setFinished(false);
              setQuizStartTime(0);
              setShowNewRecord(false);
            }} style={{ flex: 1 }}>새 게임</button>
          </div>
          <button className="btn btn-outline" onClick={() => navigate('/quiz')} style={{ marginTop: 12, width: '100%' }}>메인으로</button>
        </div>
      </div>
    );
  }

  const progress = questions.length ? ((index) / questions.length) * 100 : 0;

  return (
    <div className="app-container">
      <div className="app-main">
        {/* Header */}
        <header className="game-header">
          <button className="close-btn" onClick={() => navigate('/quiz')}>✕</button>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{score}</div>
        </header>

        {/* Question Area */}
        <div className="question-area">
          {current && (
            <>
              {current.imageUrl && (
                <img
                  src={current.imageUrl}
                  alt="Hint"
                  style={{
                    width: 200,
                    height: 200,
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-lg)',
                    marginBottom: 24,
                    border: '4px solid var(--color-ash)'
                  }}
                />
              )}
              <h2 className="question-text">{current.korean}</h2>
              <div style={{ color: 'var(--color-slate)', fontWeight: 700 }}>
                ⏰ {timeLeft}초
              </div>
            </>
          )}
        </div>

        {/* Answer Area */}
        <div className="answer-area" style={{ borderBottom: 'none', gap: 8 }}>
          {current && Array.from({ length: current.english.length }).map((_, i) => (
            <button
              key={i}
              onClick={() => userAnswer[i] ? handleAnswerLetterClick(i) : undefined}
              disabled={isCorrect !== null || !userAnswer[i]}
              className="word-chip"
              style={{
                width: 48,
                height: 48,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: userAnswer[i] ? 'var(--color-primary-light)' : 'var(--color-ash)',
                color: userAnswer[i] ? 'var(--color-primary-shadow)' : 'transparent',
                borderColor: userAnswer[i] ? 'var(--color-primary)' : 'var(--color-ash)',
                cursor: userAnswer[i] ? 'pointer' : 'default'
              }}
            >
              {userAnswer[i] || ''}
            </button>
          ))}
        </div>

        {/* Letter Bank */}
        <div className="word-bank">
          {shuffledLetters.map((letter, i) => {
            const isSelected = selectedIndices.includes(i);
            return (
              <button
                key={i}
                className={`word-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => handleLetterClick(i)}
                disabled={isCorrect !== null || isSelected}
                style={{ width: 48, height: 48, padding: 0 }}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Check Button */}
        {current && userAnswer.length === current.english.length && isCorrect === null && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button className="btn btn-primary" onClick={handleCheckAnswer} style={{ width: '100%', maxWidth: 300 }}>
              확인하기
            </button>
          </div>
        )}

        {/* Feedback Overlay */}
        {isCorrect !== null && (
          <div className={`feedback-overlay ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`}>
            <div className="feedback-content" style={{ justifyContent: 'center' }}>
              <div className="feedback-message">
                {isCorrect ? '정답입니다! 🎉' : '아쉽네요!'}
                {!isCorrect && <div style={{ fontSize: 18, marginTop: 8, fontWeight: 600 }}>정답: {current?.english}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpellingGame;
