import React, { useEffect, useMemo, useRef, useState } from 'react';
import { logAttempt, saveSession, updateProgress, getWrongWordIdsForSession } from '../services/trackingService';
import { addRecord, isNewRecord, createRecordFromQuizResult } from '../services/rankingService';
import { Word } from '../types/word';

// 정답 효과음 재생 함수 (사용자 제공 파일 사용)
const playCorrectSound = () => {
  try {
    console.log('뜻 퀴즈 정답 사운드 재생 시도 - success.mp3 파일 사용');
    
    // 사용자가 제공한 success.mp3 파일 재생
    const audio = new Audio('/success.mp3');
    audio.volume = 0.7;
    
    audio.play()
      .then(() => {
        console.log('뜻 퀴즈 정답 사운드 재생 완료 - success.mp3');
      })
      .catch((error) => {
        console.error('success.mp3 재생 실패, 폴백 사운드 재생:', error);
        
        // 실패 시 기본 Web Audio API 소리 재생
        try {
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
          
          console.log('뜻 퀴즈 폴백 정답 사운드 재생 완료');
        } catch (fallbackError) {
          console.error('뜻 퀴즈 폴백 사운드도 실패:', fallbackError);
        }
      });
  } catch (error) {
    console.error('뜻 퀴즈 정답 사운드 재생 전체 실패:', error);
  }
};

// 신기록 달성 사운드 재생 함수 (사용자 제공 파일 사용)
const playRecordSound = () => {
  try {
    console.log('뜻 퀴즈 신기록 사운드 재생 시도 - record.mp3 파일 사용');
    
    // 사용자가 제공한 record.mp3 파일 재생
    const audio = new Audio('/record.mp3');
    audio.volume = 0.7;
    
    audio.play()
      .then(() => {
        console.log('뜻 퀴즈 신기록 사운드 재생 완료 - record.mp3');
      })
      .catch((error) => {
        console.error('record.mp3 재생 실패, 폴백 사운드 재생:', error);
        
        // 실패 시 기본 Web Audio API 소리 재생 (축하하는 느낌의 소리)
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator1 = audioContext.createOscillator();
          const oscillator2 = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          // 화음으로 축하하는 느낌
          oscillator1.type = 'sine';
          oscillator1.frequency.setValueAtTime(523, audioContext.currentTime); // C5
          oscillator1.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
          oscillator1.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5

          oscillator2.type = 'sine';
          oscillator2.frequency.setValueAtTime(659, audioContext.currentTime); // E5
          oscillator2.frequency.setValueAtTime(784, audioContext.currentTime + 0.1); // G5
          oscillator2.frequency.setValueAtTime(1047, audioContext.currentTime + 0.2); // C6

          oscillator1.connect(gainNode);
          oscillator2.connect(gainNode);
          gainNode.connect(audioContext.destination);

          gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);

          oscillator1.start(audioContext.currentTime);
          oscillator2.start(audioContext.currentTime);

          setTimeout(() => {
            oscillator1.stop();
            oscillator2.stop();
            audioContext.close();
          }, 800);
          
          console.log('뜻 퀴즈 폴백 신기록 사운드 재생 완료');
        } catch (fallbackError) {
          console.error('뜻 퀴즈 폴백 신기록 사운드도 실패:', fallbackError);
        }
      });
  } catch (error) {
    console.error('뜻 퀴즈 신기록 사운드 재생 전체 실패:', error);
  }
};

// 오답 효과음 재생 함수 (사용자 제공 파일 사용)
const playWrongSound = () => {
  try {
    console.log('뜻 퀴즈 오답 사운드 재생 시도 - wrong.mp3 파일 사용');
    
    // 사용자가 제공한 wrong.mp3 파일 재생
    const audio = new Audio('/wrong.mp3');
    audio.volume = 0.7;
    
    audio.play()
      .then(() => {
        console.log('뜻 퀴즈 오답 사운드 재생 완료 - wrong.mp3');
      })
      .catch((error) => {
        console.error('wrong.mp3 재생 실패, 폴백 사운드 재생:', error);
        
        // 실패 시 기본 Web Audio API 소리 재생
        try {
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
          
          console.log('뜻 퀴즈 폴백 오답 사운드 재생 완료');
        } catch (fallbackError) {
          console.error('뜻 퀴즈 폴백 오답 사운드도 실패:', fallbackError);
        }
      });
  } catch (error) {
    console.error('뜻 퀴즈 오답 사운드 재생 전체 실패:', error);
  }
};

interface MeaningQuizProps {
  words: Word[];
  onBack: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NUM_QUESTIONS = 10; // 기본값(선택 전 표시용)
const NUM_OPTIONS = 4;
const AUTO_NEXT_DELAY_MS = 800; // 정답 시 자동 진행 지연 시간
const COUNTDOWN_BEEP_DURATION = 0.12; // 마지막 3초 비프음 길이(초)

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
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const scoreRef = useRef(0);
  const [wrongQuestions, setWrongQuestions] = useState<Word[]>([]);
  const [finished, setFinished] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const autoNextTimeoutRef = React.useRef<number | null>(null);
  const [questionCount, setQuestionCount] = useState<null | number | 'infinite'>(null);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [isNewRecordAchieved, setIsNewRecordAchieved] = useState<boolean>(false);

  // 마지막 3초 카운트다운 비프음
  const playCountdownBeep = () => {
    try {
      console.log('뜻 퀴즈 타이머 사운드 재생 시도 - timer.mp3 파일 사용');
      
      // 사용자가 제공한 timer.mp3 파일 재생
      const audio = new Audio('/timer.mp3');
      audio.volume = 0.5;
      
      audio.play()
        .then(() => {
          console.log('뜻 퀴즈 타이머 사운드 재생 완료 - timer.mp3');
        })
        .catch((error) => {
          console.error('timer.mp3 재생 실패, 폴백 사운드 재생:', error);
          
          // 실패 시 기본 Web Audio API 소리 재생
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
            
            console.log('뜻 퀴즈 폴백 타이머 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('뜻 퀴즈 폴백 타이머 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('뜻 퀴즈 타이머 사운드 재생 전체 실패:', error);
    }
  };
  const speakWord = (text: string) => {
    if (!("speechSynthesis" in window)) {
      alert('이 브라우저에서는 음성 합성이 지원되지 않습니다.');
      return;
    }
    try {
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

      // 전역 TTS 설정 읽기
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

      loadVoices().then(voices => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
        utterance.rate = rate;
        utterance.pitch = gender === 'male' ? 0.8 : gender === 'female' ? 1.3 : 1.0;
        
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
            utterance.voice = selectedVoice;
            console.log('Selected voice:', selectedVoice.name, selectedVoice.lang);
          }
        }
        
        window.speechSynthesis.speak(utterance);
      }).catch(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
        utterance.rate = rate;
        utterance.pitch = gender === 'male' ? 0.8 : gender === 'female' ? 1.3 : 1.0;
        window.speechSynthesis.speak(utterance);
      });
    } catch (e) {
      console.error('발음 재생 오류:', e);
    }
  };

  const current = questions[index] || null;

  useEffect(() => {
    if (!hasEnough) {
      setQuestions([]);
      setIndex(0);
      setSelected(null);
      setScore(0);
      setWrongQuestions([]);
      setFinished(false);
      setTimeLeft(10);
      return;
    }
    if (questionCount === null) return; // 아직 선택 전이면 초기화하지 않음
    const count = questionCount === 'infinite' ? Math.min(30, words.length) : Math.min(questionCount, words.length);
    setQuestions(pickRandom(words, count));
    setIndex(0);
    setSelected(null);
    setScore(0);
    setWrongQuestions([]);
    setFinished(false);
    setTimeLeft(10);
    // quizStartTime은 첫 번째 문제 시작 시에 설정
  }, [words, hasEnough, questionCount]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

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
          if (selected === null && current) {
            const isCorrect = false;
            playWrongSound();
            setWrongQuestions(prevW => (prevW.some(w => w.id === current.id) ? prevW : [...prevW, current]));
            logAttempt({ sessionId, mode: 'meaningQuiz', wordId: current.id, correct: isCorrect });
            updateProgress({ wordId: current.id, correct: isCorrect });
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
        // 3초에서만 비프음. 이미 선택했다면 재생하지 않음
        if (selected === null && nextValue === 3) {
          playCountdownBeep();
        }
        return nextValue;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished, current]);

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
    if (selected !== null || !current || timeLeft === 0 || !options[optIndex] || isCorrect !== null) return;
    setSelected(optIndex);
  };

  const handleCheckAnswer = () => {
    if (selected === null || !current || !options[selected] || isCorrect !== null) return;
    
    const correct = options[selected] === current.english;
    setIsCorrect(correct);
    
    if (correct) {
      setScore(s => s + 1);
      playCorrectSound(); // 정답 효과음 재생
    } else {
      playWrongSound();
      setWrongQuestions(prev => (prev.some(w => w.id === current.id) ? prev : [...prev, current]));
    }
    
    // log attempt & SRS
    logAttempt({ sessionId, mode: 'meaningQuiz', wordId: current.id, correct });
    updateProgress({ wordId: current.id, correct });
    
    // 2초 후 다음 문제로 자동 이동
    setTimeout(() => {
      next();
    }, 2000);
  };

  const next = () => {
    // 중복 이동 방지: 수동 이동 시 예약된 자동 이동 취소
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
        setIndex(0);
        setSelected(null);
        setIsCorrect(null);
        setTimeLeft(10);
        setQuizStartTime(Date.now()); // 무제한 모드에서 새로운 세션 시작 시간 기록
        return;
      } else {
        setFinished(true);
        if (!sessionId) {
          const durationSec = Math.round((Date.now() - quizStartTime) / 1000);
          saveSession({ mode: 'meaningQuiz', score: scoreRef.current, total: questions.length, durationSec }).then(id => setSessionId(id));
        }
        
        // 순위 기록 업데이트
        const totalTimeMs = Date.now() - quizStartTime;
        const finalScore = scoreRef.current; // 최신 점수 사용
        const accuracy = Math.round((finalScore / questions.length) * 100);
        
        if (isNewRecord('meaningQuiz', totalTimeMs, accuracy, questionCount || 'infinite')) {
          const record = createRecordFromQuizResult(
            'meaningQuiz',
            finalScore, // 최신 점수 사용
            questions.length,
            quizStartTime,
            Date.now(),
            questionCount || 'infinite'
          );
          addRecord(record);
          setIsNewRecordAchieved(true);
          playRecordSound(); // 신기록 달성 사운드 재생
        }
        
        return;
      }
    }
    setIndex(i => i + 1);
    setSelected(null);
    setIsCorrect(null);
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

      {/* 시작 옵션 선택 */}
      {hasEnough && questionCount === null && (
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

      {hasEnough && questionCount !== null && !finished && current && (
        <>
          <div className="question-card" style={{ textAlign: 'center' }}>
            <div className="question-text">다음 한국어 뜻에 맞는 영어 단어를 고르세요</div>
            <div
              style={{
                display: 'inline-block',
                padding: '12px 16px',
                margin: '12px 0',
                backgroundColor: '#ffffff',
                border: '2px solid #e0e0e0',
                borderRadius: '14px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: '#333', lineHeight: 1.3 }}>
                {current.korean}
              </div>
            </div>
          </div>

          <div className="options" style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr', justifyItems: 'center', maxWidth: 560, margin: '0 auto' }}>
            {options.map((opt, i) => {
              const isThisCorrect = selected !== null && opt === current.english;
              const isThisWrong = selected === i && isCorrect !== null && !isCorrect;
              return (
                <div key={`${current.id}_${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => handleSelect(i)}
                    className={`option-button ${isThisCorrect ? 'correct' : ''} ${isThisWrong ? 'incorrect' : ''}`}
                    disabled={selected !== null || timeLeft === 0 || isCorrect !== null}
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
                        : isCorrect !== null
                          ? (isThisCorrect ? '#4CAF50' : (isThisWrong ? '#F44336' : '#f5f5f5'))
                          : (selected === i ? '#2196F3' : '#f5f5f5'),
                      color: selected === null
                        ? '#333'
                        : isCorrect !== null
                          ? (isThisCorrect || isThisWrong ? '#fff' : '#666')
                          : (selected === i ? '#fff' : '#666'),
                      boxShadow: selected === null ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {opt}
                  </button>
                  <button
                    type="button"
                    aria-label={`${opt} 발음 듣기`}
                    onClick={() => speakWord(opt)}
                    style={{
                      padding: '8px 10px',
                      fontSize: 18,
                      backgroundColor: '#1976d2',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(25,118,210,0.25)'
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
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              marginTop: '20px' 
            }}>
              <button
                onClick={handleCheckAnswer}
                disabled={selected === null}
                style={{
                  padding: '15px 30px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selected === null ? 'not-allowed' : 'pointer',
                  opacity: selected === null ? 0.6 : 1,
                  minHeight: '60px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={(e) => {
                  if (selected !== null) {
                    e.currentTarget.style.backgroundColor = '#F57C00';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selected !== null) {
                    e.currentTarget.style.backgroundColor = '#FF9800';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                ✅ 정답 확인
              </button>
            </div>
          )}

          {/* 정답/오답 표시 */}
          {isCorrect !== null && (
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              margin: '20px 0',
              padding: '15px',
              borderRadius: '10px',
              backgroundColor: isCorrect ? '#e8f5e8' : '#fde8e8',
              color: isCorrect ? '#2e7d32' : '#c62828',
              textAlign: 'center'
            }}>
              {isCorrect ? '정답입니다! 🎉' : `오답입니다. 정답: ${current.english}`}
            </div>
          )}
        </>
      )}

      {hasEnough && finished && (
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
              if (timePerQuestion <= 3) {
                comment = '완벽합니다! 🚀 단어의 뜻을 매우 빠르게 파악하셨네요!';
                emoji = '🏆';
                bgColor = '#d4edda';
                textColor = '#155724';
              } else if (timePerQuestion <= 6) {
                comment = '훌륭합니다! ✨ 모든 단어의 의미를 정확하게 맞추셨어요!';
                emoji = '🎉';
                bgColor = '#d1ecf1';
                textColor = '#0c5460';
              } else {
                comment = '잘했습니다! 🎯 신중하게 생각해서 완벽한 점수를 받으셨네요!';
                emoji = '🌟';
                bgColor = '#fff3cd';
                textColor = '#856404';
              }
            } else if (accuracy >= 80) {
              comment = '좋은 성과입니다! 👍 단어의 뜻을 잘 이해하고 계시네요!';
              emoji = '💪';
              bgColor = '#e2e3e5';
              textColor = '#383d41';
            } else if (accuracy >= 60) {
              comment = '괜찮습니다! 📚 단어의 의미를 조금 더 공부해보세요!';
              emoji = '📖';
              bgColor = '#f8d7da';
              textColor = '#721c24';
            } else {
              comment = '아쉽네요! 🔄 단어의 뜻을 더 자세히 학습해보세요!';
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
                    💡 틀린 단어들의 의미를 다시 확인해보세요!
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
                  padding: '15px 25px',
                  backgroundColor: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#1565c0';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(25, 118, 210, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#1976d2';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(25, 118, 210, 0.3)';
                }}
              >
                🔄 틀린 문제 다시 풀기
              </button>
            )}
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


