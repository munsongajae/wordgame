import React, { useEffect, useMemo, useState } from 'react';
import { logAttempt, saveSession, updateProgress, getWrongWordIdsForSession } from '../services/trackingService';
import { Word } from '../types/word';

// 정답 효과음 재생 함수
const playCorrectSound = () => {
  // 간단한 효과음 생성 (Web Audio API 사용)
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // 높은 음 (띵)
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
  
  // 낮은 음 (동)
  oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.2);
  oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.3);
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.4);
};

// 오답 효과음 재생 함수
const playWrongSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'sawtooth';
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(120, audioContext.currentTime + 0.25);
  
  gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.25);
};

interface MeaningQuizProps {
  words: Word[];
  onBack: () => void;
}

const NUM_QUESTIONS = 10;
const NUM_OPTIONS = 4;

function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export default function MeaningQuiz({ words, onBack }: MeaningQuizProps) {
  const hasEnough = words.length >= NUM_OPTIONS;
  const [questions, setQuestions] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrongQuestions, setWrongQuestions] = useState<Word[]>([]);
  const [finished, setFinished] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(10);

  useEffect(() => {
    if (hasEnough) {
      setQuestions(pickRandom(words, Math.min(NUM_QUESTIONS, words.length)));
      setIndex(0);
      setSelected(null);
      setScore(0);
      setWrongQuestions([]);
      setFinished(false);
      setTimeLeft(10);
    } else {
      setQuestions([]);
      setIndex(0);
      setSelected(null);
      setScore(0);
      setWrongQuestions([]);
      setFinished(false);
      setTimeLeft(10);
    }
  }, [words, hasEnough]);

  useEffect(() => {
    if (finished) return;
    setTimeLeft(10);
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (selected === null && current) {
            const isCorrect = false;
            playWrongSound();
            setWrongQuestions(prevW => (prevW.some(w => w.id === current.id) ? prevW : [...prevW, current]));
            logAttempt({ sessionId, mode: 'meaningQuiz', wordId: current.id, correct: isCorrect });
            updateProgress({ wordId: current.id, correct: isCorrect });
            setSelected(-1 as any);
          }
        }
        return Math.max(0, prev - 1);
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished]);

  const current = questions[index] || null;

  const options = useMemo(() => {
    if (!current) return [] as string[];
    const others = pickRandom(
      words.filter(w => w.id !== current.id),
      Math.max(0, NUM_OPTIONS - 1)
    );
    const pool = [...others.map(w => w.english), current.english];
    return pickRandom(pool, pool.length);
  }, [current, words]);

  const handleSelect = (optIndex: number) => {
    if (selected !== null || !current || timeLeft === 0 || !options[optIndex]) return;
    setSelected(optIndex);
    if (options[optIndex] === current.english) {
      setScore(s => s + 1);
      playCorrectSound(); // 정답 효과음 재생
    } else {
      playWrongSound();
      setWrongQuestions(prev => (prev.some(w => w.id === current.id) ? prev : [...prev, current]));
    }
    // log attempt & SRS
    logAttempt({ sessionId, mode: 'meaningQuiz', wordId: current.id, correct: options[optIndex] === current.english });
    updateProgress({ wordId: current.id, correct: options[optIndex] === current.english });
  };

  const next = () => {
    if (!current) {
      onBack();
      return;
    }
    if (index + 1 >= questions.length) {
      setFinished(true);
      if (!sessionId) {
        saveSession({ mode: 'meaningQuiz', score, total: questions.length }).then(id => setSessionId(id));
      }
      return;
    }
    setIndex(i => i + 1);
    setSelected(null);
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
          <h2 style={{ margin: 0, color: '#333' }}>🇰🇷 뜻 보고 맞추기 {current ? `(${index + 1}/${questions.length})` : ''}</h2>
        </div>
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '8px 16px', 
          borderRadius: '20px',
          fontWeight: 'bold',
          color: '#2196F3',
          minWidth: '80px',
          textAlign: 'center'
        }}>
          ⏱️ {timeLeft}s | 점수: {score}
        </div>
      </div>

      {!hasEnough && (
        <div style={{ textAlign: 'center' }}>
          <p>문제를 만들기 위해 최소 {NUM_OPTIONS}개 이상의 단어가 필요합니다.</p>
        </div>
      )}

      {hasEnough && !finished && current && (
        <>
          <div className="question-card" style={{ textAlign: 'center' }}>
            <div className="question-text">다음 한국어 뜻에 맞는 영어 단어를 고르세요</div>
            <div style={{ fontSize: 28, fontWeight: 700, margin: '12px 0' }}>{current.korean}</div>
          </div>

          <div className="options" style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr', justifyItems: 'center', maxWidth: 520, margin: '0 auto' }}>
            {options.map((opt, i) => {
              const isCorrect = selected !== null && opt === current.english;
              const isWrong = selected === i && opt !== current.english;
              return (
                <button
                  key={`${current.id}_${i}`}
                  onClick={() => handleSelect(i)}
                  className={`option-button ${isCorrect ? 'correct' : ''} ${isWrong ? 'incorrect' : ''}`}
                  disabled={selected !== null || timeLeft === 0}
                  style={{
                    fontSize: 28,
                    lineHeight: '1.2',
                    width: 240,
                    textAlign: 'center',
                    justifySelf: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '10px 20px',
                    borderRadius: 16,
                    border: '2px solid #e0e0e0',
                    backgroundColor: selected === null
                      ? '#fff'
                      : isCorrect
                        ? '#4CAF50'
                        : isWrong
                          ? '#F44336'
                          : '#f5f5f5',
                    color: selected === null
                      ? '#333'
                      : isCorrect || isWrong
                        ? '#fff'
                        : '#666',
                    boxShadow: selected === null ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button 
              className="next-button" 
              onClick={next} 
              disabled={selected === null && timeLeft > 0}
              style={{
                padding: '16px 32px',
                fontSize: '18px',
                fontWeight: 'bold',
                backgroundColor: (selected === null && timeLeft > 0) ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: (selected === null && timeLeft > 0) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: (selected === null && timeLeft > 0) ? 'none' : '0 4px 12px rgba(76, 175, 80, 0.3)',
                minWidth: '120px'
              }}
            >
              다음
            </button>
          </div>
          
          {selected !== null && (
            <div style={{ marginTop: 12, fontWeight: 700, color: selected !== null && options[selected] === current.english ? '#4CAF50' : '#F44336', textAlign: 'center' }}>
              {selected !== null && options[selected] === current.english ? '정답입니다! 🎉' : `오답입니다. 정답: ${current.english}`}
            </div>
          )}
        </>
      )}

      {hasEnough && finished && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <h3 style={{ color: '#333' }}>결과</h3>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2196F3', margin: '12px 0' }}>
            점수: {score} / {questions.length}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
            {(wrongQuestions.length > 0 || sessionId) && (
              <button
                onClick={async () => {
                  let retryWords = wrongQuestions;
                  if (sessionId) {
                    try {
                      const ids = await getWrongWordIdsForSession(sessionId);
                      if (ids.length > 0) {
                        const dict = new Map(words.map(w => [w.id, w] as const));
                        retryWords = ids.map(id => dict.get(id)).filter(Boolean) as typeof words;
                      }
                    } catch {}
                  }
                  if (retryWords.length === 0) return;
                  setQuestions(retryWords);
                  setWrongQuestions([]);
                  setIndex(0);
                  setSelected(null);
                  setScore(0);
                  setFinished(false);
                }}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer'
                }}
              >
                틀린 문제 다시 풀기
              </button>
            )}
            <button
              onClick={onBack}
              style={{
                padding: '12px 20px',
                backgroundColor: '#4CAF50',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer'
              }}
            >
              뒤로가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


