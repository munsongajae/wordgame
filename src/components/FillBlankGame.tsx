import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Word } from '../types/word';
import { useWords } from '../contexts/WordsContext';
import { logAttempt, saveSession, updateProgress } from '../services/trackingService';
import { createRecordFromQuizResult, isNewRecord, addRecord } from '../services/rankingService';

type DifficultyLevel = 'easy' | 'medium' | 'hard';

interface BlankInfo {
  position: number;
  correctLetter: string;
  userAnswer: string | null;
}

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

// 빈칸 생성 함수 (난이도별)
function createBlanks(word: string, difficulty: DifficultyLevel): BlankInfo[] {
  const wordLength = word.length;
  let blankCount: number;
  let useSequential: boolean;

  switch (difficulty) {
    case 'easy':
      blankCount = 1;
      useSequential = true;
      break;
    case 'medium':
      blankCount = Math.min(2, Math.max(1, Math.floor(wordLength * 0.3)));
      useSequential = true;
      break;
    case 'hard':
      blankCount = Math.min(Math.max(2, Math.floor(wordLength * 0.4)), Math.floor(wordLength * 0.6));
      useSequential = false;
      break;
  }

  const possiblePositions = [];
  for (let i = 0; i < wordLength; i++) {
    possiblePositions.push(i);
  }

  let selectedPositions: number[];

  if (useSequential) {
    selectedPositions = pickRandom(possiblePositions, blankCount).sort((a, b) => a - b);
  } else {
    selectedPositions = pickRandom(possiblePositions, blankCount);
  }

  return selectedPositions.map(position => ({
    position,
    correctLetter: word[position].toUpperCase(),
    userAnswer: null
  }));
}

// 잘못된 선택지 생성
function generateWrongOptions(correctLetters: string[], allWords: Word[]): string[] {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const usedInOtherWords = allWords
    .flatMap(word => word.english.toUpperCase().split(''))
    .filter(letter => !correctLetters.includes(letter));

  const allCandidates = [...usedInOtherWords, ...alphabet];
  const uniqueCandidates: string[] = [];

  for (const letter of allCandidates) {
    if (!uniqueCandidates.includes(letter)) {
      uniqueCandidates.push(letter);
    }
  }

  return pickRandom(uniqueCandidates.filter(letter => !correctLetters.includes(letter)), 10);
}

const FillBlankGame: React.FC = () => {
  const navigate = useNavigate();
  const { words } = useWords();
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | null>(null);
  const [questions, setQuestions] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [quizStartTime, setQuizStartTime] = useState(0);
  const [showNewRecord, setShowNewRecord] = useState(false);

  // 게임 상태
  const [blanks, setBlanks] = useState<BlankInfo[]>([]);
  const [currentBlankIndex, setCurrentBlankIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const scoreRef = useRef(0);
  const autoNextTimeoutRef = useRef<number | null>(null);

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

  const handleQuestionCountSelect = (count: number | 'infinite') => {
    if (count === 'infinite') {
      setQuestionCount(null);
      setQuestions(pickRandom(words, Math.min(words.length, 50)));
    } else {
      setQuestionCount(count);
      setQuestions(pickRandom(words, count));
    }
  };

  useEffect(() => {
    if (current && questions.length > 0 && difficulty) {
      const newBlanks = createBlanks(current.english, difficulty);
      setBlanks(newBlanks);
      setCurrentBlankIndex(0);
      setIsCorrect(null);

      const currentCorrectLetter = newBlanks[0].correctLetter;
      const allCorrectLetters = newBlanks.map(blank => blank.correctLetter);
      const wrongOptions = generateWrongOptions(allCorrectLetters, words);

      const selectedWrongOptions = wrongOptions.slice(0, NUM_OPTIONS - 1);
      const allOptions = [currentCorrectLetter, ...selectedWrongOptions];
      setOptions(shuffleArray(allOptions));

      const baseTime = Math.max(15, current.english.length * 2 + newBlanks.length * 5);
      setTimeLeft(baseTime);
    }
  }, [current, questions.length, words, difficulty]);

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
            logAttempt({ sessionId, mode: 'fillBlankGame', wordId: current.id, correct: false });
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

  const handleOptionClick = (letter: string) => {
    if (isCorrect !== null || currentBlankIndex >= blanks.length) return;

    const currentBlank = blanks[currentBlankIndex];
    const newBlanks = [...blanks];
    newBlanks[currentBlankIndex] = { ...currentBlank, userAnswer: letter };
    setBlanks(newBlanks);

    if (currentBlankIndex + 1 >= blanks.length) {
      setCurrentBlankIndex(blanks.length);
    } else {
      const nextBlankIndex = currentBlankIndex + 1;
      setCurrentBlankIndex(nextBlankIndex);

      const nextCorrectLetter = newBlanks[nextBlankIndex].correctLetter;
      const allCorrectLetters = newBlanks.map(blank => blank.correctLetter);
      const wrongOptions = generateWrongOptions(allCorrectLetters, words);

      const selectedWrongOptions = wrongOptions.slice(0, NUM_OPTIONS - 1);
      const allOptions = [nextCorrectLetter, ...selectedWrongOptions];
      setOptions(shuffleArray(allOptions));
    }
  };

  const handleBlankClick = (blankIdx: number) => {
    if (isCorrect !== null || finished) return;
    const targetBlank = blanks[blankIdx];
    if (!targetBlank || !targetBlank.userAnswer) return;

    const newBlanks = [...blanks];
    newBlanks[blankIdx] = { ...targetBlank, userAnswer: null };
    setBlanks(newBlanks);
    setCurrentBlankIndex(blankIdx);

    const nextCorrectLetter = newBlanks[blankIdx].correctLetter;
    const allCorrectLetters = newBlanks.map(blank => blank.correctLetter);
    const wrongOptions = generateWrongOptions(allCorrectLetters, words);
    const selectedWrongOptions = wrongOptions.slice(0, NUM_OPTIONS - 1);
    const allOptions = [nextCorrectLetter, ...selectedWrongOptions];
    setOptions(shuffleArray(allOptions));
  };

  const handleCheckAnswer = () => {
    if (isCorrect !== null || !current) return;

    const allCorrect = blanks.every(blank =>
      blank.userAnswer === blank.correctLetter
    );

    setIsCorrect(allCorrect);

    if (allCorrect) {
      playCorrectSound();
      setScore(prev => prev + 1);
      logAttempt({ sessionId, mode: 'fillBlankGame', wordId: current.id, correct: true });
      updateProgress({ wordId: current.id, correct: true });
    } else {
      playWrongSound();
      logAttempt({ sessionId, mode: 'fillBlankGame', wordId: current.id, correct: false });
      updateProgress({ wordId: current.id, correct: false });
    }

    setTimeout(() => {
      next();
    }, 2000);
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      const finalScore = scoreRef.current;
      const accuracy = Math.round((finalScore / questions.length) * 100);
      const durationSec = Math.round((Date.now() - quizStartTime) / 1000);
      const totalTimeMs = durationSec * 1000;

      try {
        const isNewRecordResult = isNewRecord('fillBlankGame', totalTimeMs, accuracy, questionCount || 'infinite');
        if (isNewRecordResult) {
          const record = createRecordFromQuizResult(
            'fillBlankGame',
            finalScore,
            questions.length,
            quizStartTime,
            Date.now(),
            questionCount || 'infinite'
          );
          addRecord(record);
          setShowNewRecord(true);
        } else {
          setShowNewRecord(false);
        }
      } catch (e) {
        console.warn('신기록 처리 중 오류(무시 가능):', e);
      }

      saveSession({
        sessionIdHint: sessionId,
        mode: 'fillBlankGame',
        score: finalScore,
        total: questions.length,
        durationSec
      });

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

  const renderWordWithBlanks = () => {
    if (!current) return null;

    const wordArray = current.english.toUpperCase().split('');
    const blankPositions = blanks.map(blank => blank.position);

    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        marginBottom: '30px'
      }}>
        {wordArray.map((letter, index) => {
          const blankIndex = blankPositions.indexOf(index);
          const isBlank = blankIndex !== -1;
          const isCurrentBlank = isBlank && blankIndex === currentBlankIndex && isCorrect === null;

          if (isBlank) {
            const blank = blanks[blankIndex];
            return (
              <div
                key={index}
                style={{
                  width: '50px',
                  height: '50px',
                  border: `3px solid ${isCurrentBlank ? 'var(--color-accent)' : 'var(--color-secondary)'}`,
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  backgroundColor: isCurrentBlank ? '#FFF3E0' : (blank.userAnswer ? 'var(--color-secondary-light)' : 'white'),
                  color: blank.userAnswer ? 'var(--color-secondary-shadow)' : 'var(--color-slate)',
                  cursor: blank.userAnswer ? 'pointer' : 'default',
                  boxShadow: isCurrentBlank ? '0 0 0 4px rgba(255, 152, 0, 0.2)' : 'none',
                  transition: 'all 0.2s'
                }}
                onClick={() => {
                  if (blank.userAnswer) handleBlankClick(blankIndex);
                }}
              >
                {blank.userAnswer || ''}
              </div>
            );
          } else {
            return (
              <div
                key={index}
                style={{
                  width: '50px',
                  height: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: 'var(--color-ink)'
                }}
              >
                {letter}
              </div>
            );
          }
        })}
      </div>
    );
  };

  if (difficulty === null) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 500 }}>
          <h2 className="card-title">📝 빈칸 채우기 게임</h2>
          <p className="card-subtitle" style={{ marginBottom: 24 }}>난이도를 선택하세요</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <button className="btn btn-primary" onClick={() => setDifficulty('easy')}>
              🟢 하 (빈칸 1개)
            </button>
            <button className="btn btn-secondary" onClick={() => setDifficulty('medium')}>
              🟡 중 (빈칸 최대 2개)
            </button>
            <button className="btn btn-danger" onClick={() => setDifficulty('hard')}>
              🔴 상 (빈칸 2개 이상)
            </button>
          </div>
          <button className="btn btn-outline" onClick={() => navigate('/quiz')} style={{ marginTop: 24 }}>
            뒤로가기
          </button>
        </div>
      </div>
    );
  }

  if (questionCount === null && questions.length === 0) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 500 }}>
          <h2 className="card-title">문제 수 선택</h2>
          <p className="card-subtitle" style={{ marginBottom: 24 }}>풀고 싶은 문제 수를 선택하세요</p>

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
              <h2 className="question-text">{current.korean}</h2>
              {renderWordWithBlanks()}
              <div style={{ color: 'var(--color-slate)', fontWeight: 700 }}>
                ⏰ {timeLeft}초
              </div>
            </>
          )}
        </div>

        {/* Options Area */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 500, margin: '0 auto' }}>
          {options.map((option, i) => (
            <button
              key={i}
              className="btn btn-outline"
              onClick={() => handleOptionClick(option)}
              disabled={isCorrect !== null || currentBlankIndex >= blanks.length}
              style={{
                height: 80,
                fontSize: 32,
                backgroundColor: 'white',
                borderColor: 'var(--color-ash)',
                color: 'var(--color-ink)'
              }}
            >
              {option}
            </button>
          ))}
        </div>

        {/* Check Button */}
        {current && blanks.every(b => b.userAnswer) && isCorrect === null && (
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

export default FillBlankGame;
