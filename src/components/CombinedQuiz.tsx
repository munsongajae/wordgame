import React, { useEffect, useMemo, useRef, useState } from 'react';
import { logAttempt, saveSession, updateProgress } from '../services/trackingService';
import { addRecord, isNewRecord, createRecordFromQuizResult } from '../services/rankingService';
import { Word } from '../types/word';

type QuizType = 'image' | 'spelling' | 'meaning';

interface CombinedQuizProps {
  words: Word[];
  onBack: () => void;
}

const NUM_OPTIONS = 4;
const AUTO_NEXT_DELAY_MS = 800;
const COUNTDOWN_BEEP_DURATION = 0.12;

function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

const playCorrectSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
  oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.2);
  oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.3);
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.4);
};

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

export default function CombinedQuiz({ words, onBack }: CombinedQuizProps) {
  const [questionCount, setQuestionCount] = useState<null | number | 'infinite'>(null);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [isNewRecordAchieved, setIsNewRecordAchieved] = useState<boolean>(false);
  const [questions, setQuestions] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [finished, setFinished] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const autoNextTimeoutRef = useRef<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const [quizTypes, setQuizTypes] = useState<QuizType[]>([]);

  const wordsWithImage = useMemo(() => words.filter(w => !!w.imageUrl), [words]);
  const hasAny = words.length >= NUM_OPTIONS;

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    if (!hasAny) {
      setQuestions([]);
      setIndex(0);
      setSelected(null);
      setScore(0);
      setFinished(false);
      setTimeLeft(10);
      return;
    }
    if (questionCount === null) return;
    const count = questionCount === 'infinite' ? Math.min(30, words.length) : Math.min(questionCount, words.length);
    const picked = pickRandom(words, count);
    setQuestions(picked);
    // 유형 시퀀스 생성
    const types: QuizType[] = [];
    for (let i = 0; i < count; i++) {
      const choices: QuizType[] = ['spelling', 'meaning', 'image'];
      const cur = picked[i];
      if (!cur?.imageUrl || wordsWithImage.length < NUM_OPTIONS) {
        // 이미지 부족 시 이미지 유형 제외
        const idx = choices.indexOf('image');
        if (idx >= 0) choices.splice(idx, 1);
      }
      types.push(choices[Math.floor(Math.random() * choices.length)]);
    }
    setQuizTypes(types);
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setTimeLeft(10);
    // quizStartTime은 첫 번째 문제 시작 시에 설정
  }, [questionCount, hasAny, words, wordsWithImage.length]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // 타이머 및 3초 비프음
  const playCountdownBeep = () => {
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      const audioContext = new AudioCtx();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + COUNTDOWN_BEEP_DURATION);
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + COUNTDOWN_BEEP_DURATION);
    } catch {}
  };

  const current = questions[index] || null;
  const currentType: QuizType | null = quizTypes[index] || null;

  useEffect(() => {
    if (finished || !current) return;
    setTimeLeft(10);
    // 첫 번째 문제 시작 시에만 퀴즈 시작 시간 기록
    if (index === 0 && quizStartTime === 0) {
      setQuizStartTime(Date.now());
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          const current = questions[index];
          if (selectedRef.current === null && current) {
            playWrongSound();
            logAttempt({ sessionId, mode: 'combinedQuiz', wordId: current.id, correct: false });
            updateProgress({ wordId: current.id, correct: false });
            setSelected(-1 as any);
            // 시간 초과 시에도 자동으로 다음 문제로 이동
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
        if (selectedRef.current === null && nextValue > 0 && nextValue <= 3) {
          playCountdownBeep();
        }
        return nextValue;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished, current]);

  const options = useMemo(() => {
    if (!current) return [] as Word[];
    const pool = pickRandom(
      words.filter(w => w.id !== current.id),
      Math.max(0, NUM_OPTIONS - 1)
    );
    return pickRandom([...pool, current], NUM_OPTIONS);
  }, [current, words]);

  const speakWord = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    try {
      let rate = 1.0 as number;
      let gender: 'default' | 'male' | 'female' = 'default';
      let accent: 'us' | 'uk' = 'us';
      try {
        const raw = localStorage.getItem('ttsSettings');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.rate === 'number') rate = parsed.rate;
          if (parsed.gender === 'male' || parsed.gender === 'female' || parsed.gender === 'default') gender = parsed.gender;
          if (parsed.accent === 'us' || parsed.accent === 'uk') accent = parsed.accent;
        }
      } catch {}
      window.speechSynthesis.cancel();
      
      // 음성 목록을 다시 로드
      const loadVoices = () => {
        return new Promise<SpeechSynthesisVoice[]>((resolve) => {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            resolve(voices);
          } else {
            window.speechSynthesis.onvoiceschanged = () => {
              resolve(window.speechSynthesis.getVoices());
            };
            setTimeout(() => resolve([]), 1000);
          }
        });
      };

      loadVoices().then(voices => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = accent === 'uk' ? 'en-GB' : 'en-US';
        u.rate = rate;
        u.pitch = gender === 'male' ? 0.8 : gender === 'female' ? 1.3 : 1.0;
        
        console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang, localService: v.localService })));
        
        if (voices.length > 0) {
          const preferLang = accent === 'uk' ? 'en-GB' : 'en-US';
          
          let candidates = voices.filter(v => v.lang?.toLowerCase() === preferLang.toLowerCase());
          if (candidates.length === 0) {
            const langCode = preferLang.split('-')[0].toLowerCase();
            candidates = voices.filter(v => v.lang?.toLowerCase().startsWith(langCode));
          }
          if (candidates.length === 0) {
            candidates = voices.filter(v => v.lang?.toLowerCase().includes('en'));
          }
          
          let selectedVoice = null;
          if (candidates.length > 0) {
            if (gender === 'female') {
              selectedVoice = candidates.find(v => 
                /female|woman|amy|emma|olivia|salli|joanna|ivy|kimberly|kendra|zira|susan/i.test(v.name)
              ) || candidates[0];
            } else if (gender === 'male') {
              selectedVoice = candidates.find(v => 
                /male|man|brian|daniel|arthur|matthew|justin|joey|david|mark|alex/i.test(v.name)
              ) || candidates[0];
            } else {
              selectedVoice = candidates[0];
            }
          }
          
          if (selectedVoice) {
            u.voice = selectedVoice;
            console.log('Selected voice:', selectedVoice.name, selectedVoice.lang);
          }
        }
        
        window.speechSynthesis.speak(u);
      }).catch(() => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = accent === 'uk' ? 'en-GB' : 'en-US';
        u.rate = rate;
        u.pitch = gender === 'male' ? 0.8 : gender === 'female' ? 1.3 : 1.0;
        window.speechSynthesis.speak(u);
      });
    } catch {}
  };

  const handleSelect = (optIndex: number) => {
    if (selected !== null || !current || timeLeft === 0 || !options[optIndex]) return;
    setSelected(optIndex);
    const isCorrect = options[optIndex].id === current.id;
    if (isCorrect) {
      setScore(s => s + 1);
      playCorrectSound();
      if (autoNextTimeoutRef.current !== null) {
        clearTimeout(autoNextTimeoutRef.current);
      }
      autoNextTimeoutRef.current = window.setTimeout(() => {
        autoNextTimeoutRef.current = null;
        next();
      }, AUTO_NEXT_DELAY_MS);
    } else {
      playWrongSound();
      if (autoNextTimeoutRef.current !== null) {
        clearTimeout(autoNextTimeoutRef.current);
      }
      autoNextTimeoutRef.current = window.setTimeout(() => {
        autoNextTimeoutRef.current = null;
        next();
      }, AUTO_NEXT_DELAY_MS);
    }
    logAttempt({ sessionId, mode: 'combinedQuiz', wordId: current.id, correct: isCorrect });
    updateProgress({ wordId: current.id, correct: isCorrect });
  };

  const next = () => {
    if (autoNextTimeoutRef.current !== null) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    if (!current) {
      onBack();
      return;
    }
    if (index + 1 >= questions.length) {
      if (questionCount === 'infinite') {
        const count = Math.min(30, words.length);
        setQuestions(pickRandom(words, count));
        // regenerate types
        const types: QuizType[] = [];
        for (let i = 0; i < count; i++) {
          const cur = words[i];
          const choices: QuizType[] = ['spelling', 'meaning', 'image'];
          if (!cur?.imageUrl || wordsWithImage.length < NUM_OPTIONS) {
            const idx = choices.indexOf('image');
            if (idx >= 0) choices.splice(idx, 1);
          }
          types.push(choices[Math.floor(Math.random() * choices.length)]);
        }
        setQuizTypes(types);
        setIndex(0);
        setSelected(null);
        setTimeLeft(10);
        setQuizStartTime(Date.now()); // 무제한 모드에서 새로운 세션 시작 시간 기록
        return;
      } else {
        setFinished(true);
        if (!sessionId) {
          const durationSec = Math.round((Date.now() - quizStartTime) / 1000);
          saveSession({ mode: 'combinedQuiz', score: scoreRef.current, total: questions.length, durationSec }).then(id => setSessionId(id));
        }
        
        // 순위 기록 업데이트
        const totalTimeMs = Date.now() - quizStartTime;
        const finalScore = scoreRef.current; // 최신 점수 사용
        const accuracy = Math.round((finalScore / questions.length) * 100);
        
        if (isNewRecord('combinedQuiz', totalTimeMs, accuracy, questionCount || 'infinite')) {
          const record = createRecordFromQuizResult(
            'combinedQuiz',
            finalScore, // 최신 점수 사용
            questions.length,
            quizStartTime,
            Date.now(),
            questionCount || 'infinite'
          );
          addRecord(record);
          setIsNewRecordAchieved(true);
        }
        
        return;
      }
    }
    setIndex(i => i + 1);
    setSelected(null);
  };

  const renderQuestion = () => {
    if (!current || !currentType) return null;
    if (currentType === 'image') {
      return (
        <>
          <div style={{ textAlign: 'center', margin: 16 }}>
            {current.imageUrl ? (
              <img src={current.imageUrl} alt={current.english} style={{ maxWidth: 360, maxHeight: 240, borderRadius: 12, objectFit: 'cover' }} />
            ) : (
              <div style={{ height: 200 }}>이미지가 없습니다</div>
            )}
          </div>
          <div className="options" style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr', justifyItems: 'center', maxWidth: 560, margin: '0 auto' }}>
            {options.map((w, i) => {
              const isCorrect = selected !== null && w.id === current.id;
              const isWrong = selected === i && w.id !== current.id;
              return (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => handleSelect(i)}
                    className={`option-button ${isCorrect ? 'correct' : ''} ${isWrong ? 'incorrect' : ''}`}
                    disabled={selected !== null || timeLeft === 0}
                    style={{
                      fontSize: 28,
                      lineHeight: '1.2',
                      width: 240,
                      textAlign: 'center',
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
                          : '#666'
                    }}
                  >
                    {w.english}
                  </button>
                  <button type="button" aria-label={`${w.english} 발음 듣기`} onClick={() => speakWord(w.english)}
                    style={{ padding: '8px 10px', fontSize: 18, backgroundColor: '#1976d2', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>🔊</button>
                </div>
              );
            })}
          </div>
        </>
      );
    }
    if (currentType === 'meaning') {
      return (
        <>
          <div className="question-card" style={{ textAlign: 'center' }}>
            <div className="question-text">다음 한국어 뜻에 맞는 영어 단어를 고르세요</div>
            <div style={{ display: 'inline-block', padding: '12px 16px', margin: '12px 0', backgroundColor: '#fff', border: '2px solid #e0e0e0', borderRadius: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#333', lineHeight: 1.3 }}>{current.korean}</div>
            </div>
          </div>
          <div className="options" style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr', justifyItems: 'center', maxWidth: 560, margin: '0 auto' }}>
            {options.map((w, i) => {
              const isCorrect = selected !== null && w.id === current.id;
              const isWrong = selected === i && w.id !== current.id;
              return (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => handleSelect(i)}
                    className={`option-button ${isCorrect ? 'correct' : ''} ${isWrong ? 'incorrect' : ''}`}
                    disabled={selected !== null || timeLeft === 0}
                    style={{
                      fontSize: 28,
                      lineHeight: '1.2',
                      width: 240,
                      textAlign: 'center',
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
                          : '#666'
                    }}
                  >
                    {w.english}
                  </button>
                  <button type="button" aria-label={`${w.english} 발음 듣기`} onClick={() => speakWord(w.english)}
                    style={{ padding: '8px 10px', fontSize: 18, backgroundColor: '#1976d2', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>🔊</button>
                </div>
              );
            })}
          </div>
        </>
      );
    }
    // spelling
    return (
      <>
        <div className="question-card" style={{ textAlign: 'center' }}>
          <div className="question-text">다음 철자를 보고 올바른 단어를 선택하세요</div>
          <div style={{ display: 'inline-block', padding: '12px 16px', margin: '12px 0 6px 0', backgroundColor: '#ffffff', border: '2px solid #e0e0e0', borderRadius: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#1e88e5', lineHeight: 1.2 }}>{current.english}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, margin: '8px auto', maxWidth: 320 }}>
          {options.map((w, i) => {
            const isCorrect = selected !== null && w.id === current.id;
            const isWrong = selected === i && w.id !== current.id;
            return (
              <button key={w.id} onClick={() => handleSelect(i)} disabled={selected !== null || timeLeft === 0}
                className={`option-button ${isCorrect ? 'correct' : ''} ${isWrong ? 'incorrect' : ''}`}
                style={{ padding: 0, width: 140, height: 140, borderRadius: 10, border: '2px solid #e0e0e0', backgroundColor: isCorrect ? '#4CAF50' : isWrong ? '#F44336' : '#fff' }}>
                {w.imageUrl ? (
                  <img src={w.imageUrl} alt={w.english} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', backgroundColor: '#f0f0f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#999' }}>이미지 없음</div>
                )}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="quiz-container">
      <div className="quiz-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', gap: '20px' }}>
        <button className="back-button" onClick={onBack}>← 뒤로가기</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: '#333' }}>🧩 종합 퀴즈 {current && questionCount !== null ? `(${index + 1}/${questions.length})` : ''}</h2>
        </div>
        <div style={{ backgroundColor: '#f5f5f5', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', color: '#2196F3', minWidth: '80px', textAlign: 'center' }}>
          ⏱️ {timeLeft}s | 점수: {score}
        </div>
      </div>

      {questionCount === null && (
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <h3 style={{ color: '#333', fontSize: '24px', marginBottom: '30px' }}>문제 수를 선택하세요</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '20px', 
            maxWidth: '400px', 
            margin: '0 auto',
            padding: '0 20px'
          }}>
            {[10, 20, 30].map(cnt => (
              <button key={cnt}
                onClick={() => setQuestionCount(cnt)}
                style={{ 
                  padding: '24px 20px', 
                  backgroundColor: '#1976d2', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 16, 
                  cursor: 'pointer',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(25,118,210,0.3)',
                  transition: 'all 0.3s ease',
                  minHeight: '80px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(25,118,210,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(25,118,210,0.3)';
                }}>
                {cnt}문제
              </button>
            ))}
            <button onClick={() => setQuestionCount('infinite' as const)}
              style={{ 
                padding: '24px 20px', 
                backgroundColor: '#4CAF50', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 16, 
                cursor: 'pointer',
                fontSize: '20px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
                transition: 'all 0.3s ease',
                minHeight: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(76,175,80,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(76,175,80,0.3)';
              }}>
              무제한
            </button>
          </div>
        </div>
      )}

      {questionCount !== null && !finished && current && (
        <>
          {renderQuestion()}
          {selected !== null && (
            <div style={{ marginTop: 12, fontWeight: 700, color: options[selected]?.id === current.id ? '#4CAF50' : '#F44336', textAlign: 'center' }}>
              {options[selected]?.id === current.id ? '정답입니다! 🎉' : `오답입니다. 정답: ${current.english}`}
            </div>
          )}
        </>
      )}

      {questionCount !== null && finished && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <h3 style={{ color: '#333', fontSize: '28px', marginBottom: '20px' }}>🎯 퀴즈 결과</h3>
          
          {isNewRecordAchieved && (
            <div style={{ 
              backgroundColor: '#fff3cd', 
              border: '2px solid #ffc107', 
              borderRadius: '12px', 
              padding: '15px', 
              margin: '10px 0',
              color: '#856404',
              animation: 'pulse 2s infinite'
            }}>
              🏆 신기록 달성! 순위에 기록되었습니다!
            </div>
          )}

          {/* 점수 표시 */}
          <div style={{ 
            fontSize: 36, 
            fontWeight: 800, 
            color: '#2196F3', 
            margin: '20px 0',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {score} / {questions.length}
          </div>

          {/* 정답률과 시간 표시 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '30px', 
            margin: '20px 0',
            flexWrap: 'wrap'
          }}>
            <div style={{ 
              backgroundColor: '#e3f2fd', 
              padding: '15px 25px', 
              borderRadius: '12px',
              border: '2px solid #2196F3'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>정답률</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                {Math.round((score / questions.length) * 100)}%
              </div>
            </div>
            <div style={{ 
              backgroundColor: '#f3e5f5', 
              padding: '15px 25px', 
              borderRadius: '12px',
              border: '2px solid #9c27b0'
            }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>풀이 시간</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7b1fa2' }}>
                {Math.round((Date.now() - quizStartTime) / 1000)}초
              </div>
            </div>
          </div>

          {/* 점수에 따른 코멘트 */}
          {(() => {
            const accuracy = Math.round((score / questions.length) * 100);
            const timeInSeconds = Math.round((Date.now() - quizStartTime) / 1000);
            const timePerQuestion = Math.round(timeInSeconds / questions.length);
            
            let comment = '';
            let emoji = '';
            let bgColor = '';
            let textColor = '';
            
            if (accuracy === 100) {
              if (timePerQuestion <= 5) {
                comment = '완벽합니다! 🚀 종합 퀴즈를 매우 빠르게 해결하셨네요!';
                emoji = '🏆';
                bgColor = '#d4edda';
                textColor = '#155724';
              } else if (timePerQuestion <= 8) {
                comment = '훌륭합니다! ✨ 모든 유형의 문제를 완벽하게 풀어내셨어요!';
                emoji = '🎉';
                bgColor = '#d1ecf1';
                textColor = '#0c5460';
              } else {
                comment = '잘했습니다! 🎯 종합적인 사고력으로 완벽한 점수를 받으셨네요!';
                emoji = '🌟';
                bgColor = '#fff3cd';
                textColor = '#856404';
              }
            } else if (accuracy >= 80) {
              comment = '좋은 성과입니다! 👍 다양한 유형의 문제를 잘 풀어내고 계시네요!';
              emoji = '💪';
              bgColor = '#e2e3e5';
              textColor = '#383d41';
            } else if (accuracy >= 60) {
              comment = '괜찮습니다! 📚 여러 유형의 문제를 골고루 연습해보세요!';
              emoji = '📖';
              bgColor = '#f8d7da';
              textColor = '#721c24';
            } else {
              comment = '아쉽네요! 🔄 기본기를 다지고 다시 도전해보세요!';
              emoji = '💪';
              bgColor = '#f5c6cb';
              textColor = '#721c24';
            }
            
            return (
              <div style={{ 
                backgroundColor: bgColor, 
                color: textColor,
                padding: '20px', 
                borderRadius: '12px', 
                margin: '20px 0',
                border: '2px solid',
                borderColor: textColor === '#155724' ? '#c3e6cb' : 
                           textColor === '#0c5460' ? '#bee5eb' :
                           textColor === '#856404' ? '#ffeaa7' :
                           textColor === '#383d41' ? '#d6d8db' :
                           '#f1b0b7'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>{emoji}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', lineHeight: '1.4' }}>
                  {comment}
                </div>
                {accuracy !== 100 && (
                  <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
                    💡 그림, 철자, 의미 문제를 골고루 연습해보세요!
                  </div>
                )}
              </div>
            );
          })()}
          
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            justifyContent: 'center', 
            marginTop: '30px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={onBack}
              style={{
                padding: '15px 25px',
                backgroundColor: '#4CAF50',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(76, 175, 80, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#388e3c';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(76, 175, 80, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#4CAF50';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.3)';
              }}
            >
              🏠 메인으로 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


