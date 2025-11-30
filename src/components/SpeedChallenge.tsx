import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Word } from '../types/word';
import { useWords } from '../contexts/WordsContext';
import { logAttempt, saveSession, updateProgress } from '../services/trackingService';
import { createRecordFromQuizResult, isNewRecord, addRecord } from '../services/rankingService';

const BONUS_MULTIPLIER_THRESHOLD = 3; // 연속 3개 정답 시 보너스 시작
const TIME_OPTIONS = [10, 20, 30, 60, 120]; // 선택 가능한 시간 옵션 (초)

function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

const SpeedChallenge: React.FC = () => {
  const navigate = useNavigate();
  const { words } = useWords();
  const eligible = useMemo(() => words.filter(w => !!w.english && !!w.korean), [words]);
  
  const [selectedTimeLimit, setSelectedTimeLimit] = useState<number | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Word | null>(null);
  const [options, setOptions] = useState<Word[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [streak, setStreak] = useState(0); // 연속 정답 횟수
  const [finished, setFinished] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(0);
  const [showNewRecord, setShowNewRecord] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [questionType, setQuestionType] = useState<'meaning' | 'spelling' | 'image'>('meaning');
  
  const timerRef = useRef<number | null>(null);
  const autoNextTimeoutRef = useRef<number | null>(null);

  // 사운드 효과
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

  // 문제 생성
  const generateQuestion = useCallback(() => {
    if (eligible.length < 4) return;
    
    const correct = pickRandom(eligible, 1)[0];
    const wrongOptions = pickRandom(
      eligible.filter(w => w.id !== correct.id),
      3
    );
    const allOptions = [...wrongOptions, correct];
    const shuffled = pickRandom(allOptions, 4);
    
    // 문제 타입 랜덤 선택
    const types: ('meaning' | 'spelling' | 'image')[] = [];
    if (correct.korean) types.push('meaning');
    if (correct.english) types.push('spelling');
    if (correct.imageUrl) types.push('image');
    
    const randomType = types.length > 0 
      ? types[Math.floor(Math.random() * types.length)]
      : 'meaning';
    
    setQuestionType(randomType);
    setCurrentQuestion(correct);
    setOptions(shuffled);
    setSelected(null);
    setIsCorrect(null);
  }, [eligible]);

  // 선택 처리
  const handleSelect = useCallback((index: number) => {
    if (selected !== null || finished || !currentQuestion) return;
    
    setSelected(index);
    const selectedWord = options[index];
    const correct = selectedWord.id === currentQuestion.id;
    
    setIsCorrect(correct);
    
    if (correct) {
      // 정답
      const newStreak = streak + 1;
      setStreak(newStreak);
      
      // 보너스 점수 계산 (연속 정답 시)
      const bonus = newStreak >= BONUS_MULTIPLIER_THRESHOLD 
        ? Math.floor(newStreak / BONUS_MULTIPLIER_THRESHOLD) 
        : 0;
      const points = 1 + bonus;
      
      setScore(prev => prev + points);
      playCorrectSound();
      
      logAttempt({ 
        sessionId, 
        mode: 'speedChallenge', 
        wordId: currentQuestion.id, 
        correct: true 
      });
      updateProgress({ wordId: currentQuestion.id, correct: true });
    } else {
      // 오답 - 연속 정답 초기화
      setStreak(0);
      playWrongSound();
      
      logAttempt({ 
        sessionId, 
        mode: 'speedChallenge', 
        wordId: selectedWord.id, 
        correct: false 
      });
      updateProgress({ wordId: selectedWord.id, correct: false });
    }
    
    // 자동으로 다음 문제로
    if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
    autoNextTimeoutRef.current = window.setTimeout(() => {
      generateQuestion();
    }, correct ? 500 : 1000);
  }, [selected, finished, currentQuestion, options, streak, sessionId, playCorrectSound, playWrongSound, generateQuestion]);

  // 게임 종료
  const finishGame = useCallback(() => {
    setFinished(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    const durationSec = (selectedTimeLimit || 60) - timeLeft;
    saveSession({
      sessionIdHint: sessionId,
      mode: 'speedChallenge',
      score,
      total: score, // 스피드 챌린지는 맞춘 개수가 총 문제 수
      durationSec
    });
    
    const totalTimeMs = durationSec * 1000;
    const accuracy = 100; // 스피드 챌린지는 시간 내 맞춘 것만 기록
    
    // 100% 정답률이면 무조건 기록 저장 (신기록 여부와 관계없이)
    (async () => {
      try {
        if (accuracy === 100) {
          // 스피드 챌린지: questionCount에 시간 제한 저장 (10초 = 10, 20초 = 20 등)
          const record = createRecordFromQuizResult(
            'speedChallenge',
            score, // 맞춘 개수
            score, // 총 문제 수 (맞춘 개수와 동일)
            gameStartTime,
            Date.now(),
            selectedTimeLimit || 60 // questionCount에 시간 제한 저장
          );
          const success = await addRecord(record);
          if (success) {
            // 신기록인지 확인하여 UI 피드백 (score를 moves 파라미터로 전달)
            const isNew = await isNewRecord('speedChallenge', totalTimeMs, accuracy, selectedTimeLimit || 60, score);
            if (isNew) {
              setShowNewRecord(true);
            }
          }
        }
      } catch (e) {
        console.warn('신기록 처리 중 오류(무시 가능):', e);
      }
    })();
  }, [timeLeft, score, sessionId, gameStartTime, selectedTimeLimit]);

  // 게임 시작
  const startGame = useCallback(() => {
    if (selectedTimeLimit === null) return;
    
    setGameStarted(true);
    setTimeLeft(selectedTimeLimit);
    setScore(0);
    setStreak(0);
    setFinished(false);
    setGameStartTime(Date.now());
    generateQuestion();
    
    // 타이머 시작
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) {
          // 시간 종료
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          finishGame();
          return 0;
        }
        return next;
      });
    }, 1000);
  }, [selectedTimeLimit, generateQuestion, finishGame]);

  // 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (autoNextTimeoutRef.current) {
        clearTimeout(autoNextTimeoutRef.current);
      }
    };
  }, []);

  // 게임 시작 전 화면
  if (!gameStarted) {
    return (
      <div className="app-container">
        <div className="app-main">
          <header className="game-header">
            <button className="close-btn" onClick={() => navigate('/game')}>✕</button>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>⚡ 단어 스피드 챌린지</h1>
          </header>

          <div className="question-area" style={{ padding: 20, textAlign: 'center' }}>
            <h2 className="card-title" style={{ marginBottom: 24 }}>시간 선택</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
              gap: 16,
              maxWidth: 500,
              margin: '0 auto 24px'
            }}>
              {TIME_OPTIONS.map(time => (
                <button
                  key={time}
                  onClick={() => setSelectedTimeLimit(time)}
                  className="game-card"
                  style={{
                    padding: 20,
                    fontSize: 20,
                    fontWeight: 700,
                    backgroundColor: selectedTimeLimit === time ? 'var(--color-secondary-light)' : 'white',
                    borderColor: selectedTimeLimit === time ? 'var(--color-secondary)' : 'var(--color-ash)',
                    color: selectedTimeLimit === time ? 'var(--color-secondary-shadow)' : 'var(--color-ink)',
                    cursor: 'pointer'
                  }}
                >
                  {time}초
                </button>
              ))}
            </div>
            
            <div style={{ maxWidth: 500, margin: '0 auto', lineHeight: 1.8, marginBottom: 24 }}>
              <p style={{ fontSize: 16, color: 'var(--color-slate)', marginBottom: 16 }}>
                • 연속으로 정답을 맞추면 보너스 점수를 받습니다
              </p>
              <p style={{ fontSize: 16, color: 'var(--color-slate)', marginBottom: 16 }}>
                • 빠르고 정확하게 답을 선택하세요
              </p>
            </div>
            
            <button 
              className="btn btn-primary" 
              onClick={startGame}
              disabled={selectedTimeLimit === null}
              style={{ 
                fontSize: 20, 
                padding: '16px 32px',
                opacity: selectedTimeLimit === null ? 0.5 : 1,
                cursor: selectedTimeLimit === null ? 'not-allowed' : 'pointer'
              }}
            >
              시작하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 게임 종료 화면
  if (finished) {
    const totalTime = selectedTimeLimit || 60;
    const wordsPerMinute = Math.round((score / totalTime) * 60);
    
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2 className="card-title">⚡ 챌린지 완료!</h2>
          {showNewRecord && (
            <div style={{ color: 'var(--color-accent)', fontWeight: 800, marginBottom: 16 }}>
              🏆 신기록 달성!
            </div>
          )}

          <div className="stats-grid" style={{ marginTop: 24 }}>
            <div className="stat-item">
              <div className="stat-value">{score}</div>
              <div className="stat-label">맞춘 단어</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{wordsPerMinute}</div>
              <div className="stat-label">단어/분</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{streak}</div>
              <div className="stat-label">최종 연속</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button 
              className="btn btn-outline" 
              onClick={() => {
                setGameStarted(false);
                setFinished(false);
                setSelectedTimeLimit(null);
              }}
              style={{ flex: 1 }}
            >
              다시하기
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => navigate('/game')} 
              style={{ flex: 1 }}
            >
              메인으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 게임 화면
  const bonus = streak >= BONUS_MULTIPLIER_THRESHOLD 
    ? Math.floor(streak / BONUS_MULTIPLIER_THRESHOLD) 
    : 0;

  return (
    <div className="app-container">
      <div className="app-main">
        <header className="game-header">
          <button className="close-btn" onClick={() => navigate('/game')}>✕</button>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: timeLeft <= 10 ? 'var(--color-danger)' : 'var(--color-ink)' }}>
              ⏱️ {timeLeft}초
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-primary)' }}>
              점수: {score}
            </div>
            {streak > 0 && (
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-accent)' }}>
                🔥 {streak}연속
                {bonus > 0 && <span style={{ marginLeft: 4 }}>+{bonus}보너스</span>}
              </div>
            )}
          </div>
        </header>

        <div className="question-area" style={{ marginBottom: 24 }}>
          {currentQuestion && (
            <>
              {questionType === 'image' && currentQuestion.imageUrl && (
                <img
                  src={currentQuestion.imageUrl}
                  alt={currentQuestion.english}
                  style={{
                    width: '100%',
                    maxWidth: 400,
                    height: 300,
                    objectFit: 'cover',
                    borderRadius: 12,
                    marginBottom: 16,
                    border: '3px solid var(--color-ash)'
                  }}
                />
              )}
              
              {questionType === 'meaning' && (
                <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--color-primary)', marginBottom: 16 }}>
                  {currentQuestion.korean}
                </div>
              )}
              
              {questionType === 'spelling' && (
                <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--color-primary)', marginBottom: 16 }}>
                  {currentQuestion.english}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600, margin: '0 auto', padding: '0 20px' }}>
          {options.map((word, index) => (
            <button
              key={word.id}
              onClick={() => handleSelect(index)}
              disabled={selected !== null}
              className={`game-card ${selected === index ? (isCorrect ? 'selected' : 'wrong') : ''}`}
              style={{
                padding: 20,
                minHeight: 100,
                fontSize: 24,
                fontWeight: 700,
                backgroundColor: selected === index 
                  ? (isCorrect ? 'var(--color-secondary-light)' : '#FFEBEE')
                  : 'white',
                borderColor: selected === index 
                  ? (isCorrect ? 'var(--color-secondary)' : 'var(--color-danger)')
                  : 'var(--color-ash)',
                color: selected === index 
                  ? (isCorrect ? 'var(--color-secondary-shadow)' : 'var(--color-danger)')
                  : 'var(--color-ink)',
                cursor: selected !== null ? 'default' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {questionType === 'image' ? word.english : questionType === 'meaning' ? word.english : word.korean}
            </button>
          ))}
        </div>

        {/* 피드백 */}
        {isCorrect !== null && (
          <div style={{ 
            textAlign: 'center', 
            marginTop: 24,
            fontSize: 24,
            fontWeight: 800,
            color: isCorrect ? 'var(--color-primary)' : 'var(--color-danger)'
          }}>
            {isCorrect ? '✅ 정답!' : '❌ 오답'}
            {isCorrect && bonus > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--color-accent)' }}>
                +{bonus} 보너스!
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeedChallenge;

