import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Word } from '../types/word';

type FallingQuizProps = {
  words: Word[];
  onBack: () => void;
};

// 게임 상수 (매직 넘버 제거)
const ROUND_TIME_SEC = 10;
const OPTIONS_PER_QUESTION = 4;
const AUTO_NEXT_DELAY_MS = 800;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FALL_DURATION_MS = ROUND_TIME_SEC * 1000;
const OPTIONS_HEIGHT = 120; // 보기 영역 높이
const GAME_AREA_HEIGHT = 500; // 게임 영역 높이 (vh 대신 고정값 사용)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const INVADER_TRAVEL_TIME = 10; // 침공자가 화성에서 지구까지 도착하는 시간 (초)
const INVADER_SPEED = (GAME_AREA_HEIGHT + 150) / 10 / 10 / 5 * 0.7; // 침공자 속도를 30% 더 느리게 (약 700초에 도착)

type GeneratedQuestion = {
  type: 'image' | 'spelling' | 'meaning';
  promptKorean: string;
  correctEnglish: string;
  options: { english: string; imageUrl?: string }[];
};

function sampleDistinct<T>(source: T[], count: number, keySelector: (v: T) => string): T[] {
  const pool = [...source];
  const picked: T[] = [];
  const used = new Set<string>();
  while (pool.length > 0 && picked.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    const cand = pool.splice(idx, 1)[0];
    const key = keySelector(cand);
    if (!used.has(key)) {
      used.add(key);
      picked.push(cand);
    }
  }
  return picked;
}

type Invader = {
  id: string;
  english: string;
  x: number;
  y: number;
  speed: number;
  isCorrect: boolean;
  cardWidth?: number; // 반응형 카드 너비
};

export default function FallingQuiz({ words, onBack }: FallingQuizProps) {
  const eligible = useMemo(() => words.filter(w => !!w.english && !!w.korean), [words]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [questionCount] = useState<number>(10);
  const [timeLeft, setTimeLeft] = useState<number>(ROUND_TIME_SEC);
  const [selected, setSelected] = useState<string | null>(null);
  const [invaders, setInvaders] = useState<Invader[]>([]);
  // gameOver 상태 제거 - 이제 점수 감점으로 처리
  const [gameKey, setGameKey] = useState(0); // 새 게임을 위한 키
  const [explosions, setExplosions] = useState<Array<{id: string, x: number, y: number, timestamp: number}>>([]); // 폭발 효과

  const timerRef = useRef<number | null>(null);
  const autoNextRef = useRef<number | null>(null);
  const selectedRef = useRef<string | null>(null);
  const timeLeftRef = useRef<number>(ROUND_TIME_SEC);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const invaderIdRef = useRef<number>(0);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  const questions: GeneratedQuestion[] = useMemo(() => {
    const total = Math.min(questionCount, Math.max(0, eligible.length));
    const qs: GeneratedQuestion[] = [];
    const pool = [...eligible];
    for (let i = 0; i < total && pool.length >= OPTIONS_PER_QUESTION; i++) {
      const picked = sampleDistinct(pool, OPTIONS_PER_QUESTION, w => w.english);
      // 정답은 첫 번째로 선택된 항목으로 고정 후 셔플
      const correct = picked[0];
      const shuffled = [...picked].sort(() => Math.random() - 0.5);
      const type: 'image' | 'spelling' | 'meaning' = ['image', 'spelling', 'meaning'][Math.floor(Math.random() * 3)] as any;
      qs.push({
        type,
        promptKorean: correct.korean,
        correctEnglish: correct.english,
        options: shuffled.map(w => ({ english: w.english, imageUrl: (w as any).imageUrl }))
      });
    }
    return qs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, questionCount, gameKey]);

  const current = questions[index];

  const playBeep = useCallback((frequency: number, durationMs: number) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.value = 0.1;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, durationMs);
    } catch {}
  }, []);

  // 오답 사운드 (사용자 제공 파일 사용)
  const playWrongSound = useCallback(() => {
    try {
      console.log('화성 침공 오답 사운드 재생 시도 - wrong.mp3 파일 사용');
      
      // 사용자가 제공한 wrong.mp3 파일 재생
      const audio = new Audio('/wrong.mp3');
      audio.volume = 0.7;
      
      audio.play()
        .then(() => {
          console.log('화성 침공 오답 사운드 재생 완료 - wrong.mp3');
        })
        .catch((error) => {
          console.error('wrong.mp3 재생 실패, 폴백 사운드 재생:', error);
          
          // 실패 시 기본 Web Audio API 소리 재생
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            
            setTimeout(() => {
              osc.stop();
              ctx.close();
            }, 250);
            
            console.log('화성 침공 폴백 오답 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('화성 침공 폴백 오답 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('화성 침공 오답 사운드 재생 전체 실패:', error);
    }
  }, []);

  // 신기록 달성 사운드 (사용자 제공 파일 사용)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const playRecordSound = useCallback(() => {
    try {
      console.log('화성 침공 신기록 사운드 재생 시도 - record.mp3 파일 사용');
      
      // 사용자가 제공한 record.mp3 파일 재생
      const audio = new Audio('/record.mp3');
      audio.volume = 0.7;
      
      audio.play()
        .then(() => {
          console.log('화성 침공 신기록 사운드 재생 완료 - record.mp3');
        })
        .catch((error) => {
          console.error('record.mp3 재생 실패, 폴백 사운드 재생:', error);
          
          // 실패 시 기본 Web Audio API 소리 재생 (축하하는 느낌의 소리)
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            
            // 화음으로 축하하는 느낌
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523, ctx.currentTime); // C5
            osc1.frequency.setValueAtTime(659, ctx.currentTime + 0.1); // E5
            osc1.frequency.setValueAtTime(784, ctx.currentTime + 0.2); // G5

            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659, ctx.currentTime); // E5
            osc2.frequency.setValueAtTime(784, ctx.currentTime + 0.1); // G5
            osc2.frequency.setValueAtTime(1047, ctx.currentTime + 0.2); // C6

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            gain.gain.setValueAtTime(0.4, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

            osc1.start();
            osc2.start();

            setTimeout(() => {
              osc1.stop();
              osc2.stop();
              ctx.close();
            }, 800);
            
            console.log('화성 침공 폴백 신기록 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('화성 침공 폴백 신기록 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('화성 침공 신기록 사운드 재생 전체 실패:', error);
    }
  }, []);

  // 정답 사운드 (사용자 제공 파일 사용)
  const playCorrectSound = useCallback(() => {
    try {
      console.log('정답 사운드 재생 시도 - success.mp3 파일 사용');
      
      // 사용자가 제공한 success.mp3 파일 재생
      const audio = new Audio('/success.mp3');
      audio.volume = 0.7;
      
      audio.play()
        .then(() => {
          console.log('정답 사운드 재생 완료 - success.mp3');
        })
        .catch((error) => {
          console.error('success.mp3 재생 실패, 폴백 사운드 재생:', error);
          
          // 실패 시 기본 Web Audio API 소리 재생
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523, ctx.currentTime);
            osc1.frequency.exponentialRampToValueAtTime(659, ctx.currentTime + 0.1);
            osc1.frequency.exponentialRampToValueAtTime(784, ctx.currentTime + 0.2);
            
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659, ctx.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(784, ctx.currentTime + 0.1);
            osc2.frequency.exponentialRampToValueAtTime(1047, ctx.currentTime + 0.2);
            
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
            
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);
            
            osc1.start();
            osc2.start();
            
            setTimeout(() => {
              osc1.stop();
              osc2.stop();
              ctx.close();
            }, 1000);
            
            console.log('폴백 정답 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('폴백 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('정답 사운드 재생 전체 실패:', error);
    }
  }, []);


  // 4개 선택지 침공자 한꺼번에 생성 함수
  const spawnAllInvaders = useCallback(() => {
    if (!current || !gameAreaRef.current) return;
    
    const gameAreaWidth = gameAreaRef.current.offsetWidth;
    const cardWidth = Math.min(280, gameAreaWidth * 0.2); // 화면 크기에 따라 카드 너비 조정
    const cardSpacing = Math.max(10, (gameAreaWidth - (4 * cardWidth)) / 3); // 카드 간격 계산
    
    const newInvaders: Invader[] = [];
    
    // 4개 선택지를 모두 침공자로 생성
    current.options.forEach((option, index) => {
      const isCorrect = option.english === current.correctEnglish;
      
      // 반응형 위치 계산
      const startX = cardWidth / 2 + (index * (cardWidth + cardSpacing));
      const xPercentage = (startX / gameAreaWidth) * 100;
      
      const newInvader: Invader = {
        id: `invader-${invaderIdRef.current++}`,
        english: option.english,
        x: xPercentage, // 반응형 위치
        y: -150, // 화성에서 시작
        speed: INVADER_SPEED, // 매우 천천히 이동
        isCorrect,
        cardWidth // 카드 너비 정보 저장
      };
      newInvaders.push(newInvader);
    });
    
    setInvaders(prev => [...prev, ...newInvaders]);
  }, [current]);

  // 침공자 업데이트 (위치 이동 및 충돌 검사)
  const updateInvaders = useCallback(() => {
    if (!gameAreaRef.current) return;
    
    const gameAreaHeight = GAME_AREA_HEIGHT;
    const optionsAreaTop = gameAreaHeight - OPTIONS_HEIGHT;
    
    setInvaders(prev => {
      const updated = prev.map(invader => ({
        ...invader,
        y: invader.y + invader.speed
      }));
      
      // 보기 영역에 닿은 침공자들 확인
      const reachedOptions = updated.filter(invader => invader.y >= optionsAreaTop);
      
      if (reachedOptions.length > 0) {
        // 정답이 아닌 침공자가 도달했으면 점수 감점
        const wrongInvaders = reachedOptions.filter(invader => !invader.isCorrect);
        if (wrongInvaders.length > 0) {
          // 점수 감점 (최소 0점)
          setScore(prev => {
            const newScore = Math.max(0, prev - wrongInvaders.length);
            console.log(`💥 화성인 지구 도착! 점수 감점: ${prev} → ${newScore} (-${wrongInvaders.length})`);
            return newScore;
          });
          playWrongSound(); // 오답 사운드 재생
          
          // 도달한 오답 침공자들 제거
          return updated.filter(invader => !reachedOptions.includes(invader) || invader.isCorrect);
        }
      }
      
      // 화면을 벗어난 침공자들 제거
      return updated.filter(invader => invader.y < gameAreaHeight + 100);
    });
  }, [playWrongSound]);

  // 게임 루프 (침공자 생성, 업데이트, 타이머)
  useEffect(() => {
    if (finished || !current) return;
    
    setTimeLeft(ROUND_TIME_SEC);
    timeLeftRef.current = ROUND_TIME_SEC;
    setInvaders([]); // 새로운 문제 시작 시 침공자 초기화

    // 4개 선택지 침공자 한꺼번에 생성 (게임 시작 시 한 번만)
    spawnAllInvaders();
    
    // 침공자 업데이트 타이머 (60fps)
    const updateInterval = setInterval(updateInvaders, 16);
    
    // 게임 타이머
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    timerRef.current = window.setInterval(() => {
      const next = Math.max(0, timeLeftRef.current - 1);
      setTimeLeft(next);
      timeLeftRef.current = next;
      if (next <= 3 && next > 0) playBeep(880, 120);
      if (next === 0) {
        // 시간 종료 시 - 점수 없음, 사운드 없음 (시간초과는 실패로 처리)
        console.log('⏰ 시간초과! 정답이 있어도 점수 없음');
        
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (autoNextRef.current) { clearTimeout(autoNextRef.current); }
        autoNextRef.current = window.setTimeout(() => {
          goNext();
        }, AUTO_NEXT_DELAY_MS);
      }
    }, 1000);

    return () => {
      clearInterval(updateInterval);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (autoNextRef.current) { clearTimeout(autoNextRef.current); autoNextRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished, current, spawnAllInvaders, updateInvaders]);

  // 브라우저 크기 변경 시 침공자 위치 재조정
  useEffect(() => {
    const handleResize = () => {
      if (invaders.length > 0 && current) {
        // 기존 침공자들을 새로운 위치로 재배치
        setInvaders(prev => prev.map(invader => {
          if (!gameAreaRef.current) return invader;
          
          const gameAreaWidth = gameAreaRef.current.offsetWidth;
          const cardWidth = Math.min(280, gameAreaWidth * 0.2);
          const cardSpacing = Math.max(10, (gameAreaWidth - (4 * cardWidth)) / 3);
          
          // 현재 침공자의 인덱스 찾기 (x 위치로 추정)
          const currentIndex = Math.round((invader.x / 100) * 4);
          const clampedIndex = Math.max(0, Math.min(3, currentIndex));
          
          const startX = cardWidth / 2 + (clampedIndex * (cardWidth + cardSpacing));
          const xPercentage = (startX / gameAreaWidth) * 100;
          
          return {
            ...invader,
            x: xPercentage,
            cardWidth
          };
        }));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [invaders.length, current]);

  // 폭발 효과 생성 함수
  const createExplosion = useCallback((x: number, y: number) => {
    const explosionId = `explosion-${Date.now()}-${Math.random()}`;
    const newExplosion = {
      id: explosionId,
      x: x,
      y: y,
      timestamp: Date.now()
    };
    
    setExplosions(prev => [...prev, newExplosion]);
    
    // 1초 후 폭발 효과 제거
    setTimeout(() => {
      setExplosions(prev => prev.filter(exp => exp.id !== explosionId));
    }, 1000);
  }, []);

  // 침공자 클릭 처리
  const handleInvaderClick = (invader: Invader) => {
    if (selectedRef.current) return;
    
    setSelected(invader.english);
    
    // 폭발 효과 생성 (침공자 위치에서)
    createExplosion(invader.x, invader.y);
    
    // 침공자 제거
    setInvaders(prev => prev.filter(inv => inv.id !== invader.id));
    
    if (invader.isCorrect) {
      setScore(s => s + 1);
      playCorrectSound(); // 고품질 정답 효과음
    } else {
      playBeep(200, 300); // 오답 효과음
    }
    
    // 즉시 다음 문제로 예약
    if (autoNextRef.current) { clearTimeout(autoNextRef.current); }
    autoNextRef.current = window.setTimeout(() => { goNext(); }, AUTO_NEXT_DELAY_MS);
  };

  const goNext = () => {
    setSelected(null);
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex(i => i + 1);
  };

  const resetAll = () => {
    setIndex(0);
    setScore(0);
    setFinished(false);
    setSelected(null);
    setTimeLeft(ROUND_TIME_SEC);
    setInvaders([]);
    setExplosions([]); // 폭발 효과 초기화
    // setGameOver(false); // gameOver 상태 제거됨
  };

  const startNewGame = () => {
    // 새로운 문제 세트 생성 (gameKey를 증가시켜 useMemo 재실행)
    setGameKey(prev => prev + 1);
    resetAll();
  };

  // 낙하 아이템 수평 위치 생성
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const xPositions = useMemo(() => {
    return current ? current.options.map(() => Math.random() * 80 + 10) : [];
  }, [current]);

  if (!current || questions.length === 0) {
    return (
      <div className="quiz-container">
        <button className="back-button" onClick={onBack}>← 뒤로가기</button>
        <p>🚀 화성 침공을 막을 수 있는 문제가 부족합니다!</p>
      </div>
    );
  }

  // 게임 오버 조건 제거 - 이제 점수 감점으로 처리하여 게임을 계속 진행

  if (finished) {
    return (
      <div className="quiz-container" style={{ textAlign: 'center', background: 'linear-gradient(135deg, #4CAF50, #2E7D32)' }}>
        <button className="back-button" onClick={onBack}>← 뒤로가기</button>
        <h2 style={{ color: '#fff', marginTop: 20 }}>🎉 지구 방어 성공!</h2>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: '20px 0' }}>{score} / {questions.length}</div>
        <div style={{ fontSize: 18, color: '#fff', margin: '20px 0' }}>
          화성 침공을 성공적으로 막아냈습니다!<br />
          지구는 안전합니다! 🌍
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={resetAll} style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: '#fff', color: '#2E7D32', cursor: 'pointer', fontWeight: 'bold' }}>🔄 다시 도전</button>
          <button onClick={startNewGame} style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: '#fff', color: '#2E7D32', cursor: 'pointer', fontWeight: 'bold' }}>🎮 새 게임</button>
          <button onClick={onBack} style={{ padding: '12px 20px', borderRadius: 10, border: 'none', background: '#fff', color: '#2E7D32', cursor: 'pointer', fontWeight: 'bold' }}>🏠 메인으로</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container" style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: '#fff' }}>
      <button className="back-button" onClick={onBack} style={{ color: '#fff', borderColor: '#fff' }}>← 뒤로가기</button>
      
      {/* 게임 헤더 */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ color: '#ff6b6b', margin: '10px 0', fontSize: 28 }}>🚀 화성 침공 방어 작전</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 30, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 18, fontWeight: 'bold' }}>
            🎯 점수: <span style={{ color: '#4CAF50' }}>{score}</span> / {questions.length}
          </div>
          <div style={{ fontSize: 18, fontWeight: 'bold' }}>
            ⏱️ 시간: <span style={{ color: timeLeft <= 3 ? '#ff4444' : '#fff' }}>{timeLeft}s</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 'bold' }}>
            👽 남은 화성인: <span style={{ 
              color: (questions.length - index) === 0 ? '#4CAF50' : 
                     (questions.length - index) <= 1 ? '#ff8800' : 
                     (questions.length - index) <= 2 ? '#ffaa00' : '#4CAF50' 
            }}>
              {questions.length - index}
            </span>
          </div>
        </div>
      </div>

      {/* 문제 영역 */}
      <div style={{ textAlign: 'center', marginBottom: 20, padding: 20, background: 'rgba(255,255,255,0.1)', borderRadius: 15, backdropFilter: 'blur(10px)' }}>
        {current.type === 'image' && (
          <>
            <div style={{ fontSize: 16, color: '#ffeb3b', marginBottom: 10 }}>🖼️ 그림에 맞는 화성인을 찾아 격추하세요!</div>
            <img 
              src={current.options.find(o => o.english === current.correctEnglish)?.imageUrl} 
              alt={current.correctEnglish} 
              style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 15, border: '3px solid #ff6b6b', boxShadow: '0 0 20px rgba(255,107,107,0.5)' }} 
            />
          </>
        )}
        {current.type === 'spelling' && (
          <>
            <div style={{ fontSize: 16, color: '#ffeb3b', marginBottom: 10 }}>🔤 철자에 맞는 화성인을 찾아 격추하세요!</div>
            <img 
              src={current.options.find(o => o.english === current.correctEnglish)?.imageUrl} 
              alt={current.correctEnglish} 
              style={{ width: 150, height: 150, objectFit: 'cover', borderRadius: 15, border: '3px solid #ff6b6b', boxShadow: '0 0 20px rgba(255,107,107,0.5)' }} 
            />
          </>
        )}
        {current.type === 'meaning' && (
          <>
            <div style={{ fontSize: 16, color: '#ffeb3b', marginBottom: 10 }}>🇰🇷 뜻에 맞는 화성인을 찾아 격추하세요!</div>
            <div style={{ display: 'inline-block', padding: '15px 20px', border: '3px solid #ff6b6b', background: 'rgba(255,107,107,0.2)', borderRadius: 15, fontSize: 24, fontWeight: 800, color: '#fff', boxShadow: '0 0 20px rgba(255,107,107,0.3)' }}>{current.promptKorean}</div>
          </>
        )}
      </div>

      {/* 게임 영역 */}
      <div 
        ref={gameAreaRef}
        style={{ 
          position: 'relative', 
          height: `${GAME_AREA_HEIGHT}px`, 
          background: 'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
          borderRadius: 15,
          overflow: 'hidden',
          border: '2px solid #ff6b6b'
        }}
      >
        {/* 별 배경 효과 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(2px 2px at 20px 30px, #fff, transparent),
            radial-gradient(2px 2px at 40px 70px, #fff, transparent),
            radial-gradient(1px 1px at 90px 40px, #fff, transparent),
            radial-gradient(1px 1px at 130px 80px, #fff, transparent),
            radial-gradient(2px 2px at 160px 30px, #fff, transparent)
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 100px',
          animation: 'twinkle 3s linear infinite'
        }} />
        
        {/* 침공자들 */}
        {invaders.map((invader) => (
          <button
            key={invader.id}
            onClick={() => handleInvaderClick(invader)}
            style={{
              position: 'absolute',
              left: `${invader.x}%`,
              top: `${invader.y}px`,
              transform: 'translateX(-50%)',
              width: invader.cardWidth || 280,
              height: Math.round((invader.cardWidth || 280) * 0.6), // 높이를 늘려서 텍스트 공간 확보
              borderRadius: 15,
              border: '4px solid #2196F3',
              background: 'linear-gradient(135deg, #2196F3, #1976D2)',
              color: '#fff',
              fontWeight: 'bold',
              cursor: selected ? 'default' : 'pointer',
              boxShadow: '0 0 20px rgba(33,150,243,0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '8px 8px', // 상하 패딩을 줄여서 텍스트 공간 확보
              zIndex: 10,
              animation: 'invaderGlow 1s ease-in-out infinite alternate'
            }}
          >
            <div style={{ 
              fontSize: Math.round((invader.cardWidth || 280) * 0.12), // 이모지 크기 약간 축소
              marginBottom: Math.round((invader.cardWidth || 280) * 0.01), // 마진을 절반으로 줄임
              lineHeight: 1.2,
              flexShrink: 0
            }}>
              👽
            </div>
            <div style={{ 
              fontSize: (() => {
                // 카드 크기와 단어 길이에 따라 폰트 크기 동적 조정
                const cardWidth = invader.cardWidth || 280;
                const wordLength = invader.english.length;
                const baseFontSize = Math.round(cardWidth * 0.22); // 기본 폰트 크기 약간 축소
                
                // 단어 길이에 따른 조정
                if (wordLength <= 6) return baseFontSize;
                if (wordLength <= 8) return Math.round(baseFontSize * 0.86);
                if (wordLength <= 10) return Math.round(baseFontSize * 0.71);
                if (wordLength <= 12) return Math.round(baseFontSize * 0.64);
                if (wordLength <= 15) return Math.round(baseFontSize * 0.57);
                if (wordLength <= 18) return Math.round(baseFontSize * 0.5);
                if (wordLength <= 22) return Math.round(baseFontSize * 0.43);
                return Math.round(baseFontSize * 0.36);
              })(),
              fontWeight: 'bold', 
              textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
              lineHeight: 1.3, // lineHeight 증가로 텍스트 잘림 방지
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
              padding: '2px 8px', // 상하 패딩을 줄임
              margin: '0',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: Math.round((invader.cardWidth || 280) * 0.12), // 최소 높이를 줄임
              flex: 1 // 남은 공간을 모두 사용
            }}>
              {invader.english}
            </div>
          </button>
        ))}
        
        {/* 폭발 효과들 */}
        {explosions.map((explosion) => (
          <div
            key={explosion.id}
            style={{
              position: 'absolute',
              left: `${explosion.x}%`,
              top: `${explosion.y}px`,
              transform: 'translateX(-50%)',
              fontSize: 60,
              color: '#ff4444',
              pointerEvents: 'none',
              zIndex: 20,
              animation: 'explosion 1s ease-out forwards'
            }}
          >
            💥
          </div>
        ))}
        
        {/* 보기 영역 (지구 방어선) */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${OPTIONS_HEIGHT}px`,
          background: 'linear-gradient(180deg, rgba(76,175,80,0.3), rgba(46,125,50,0.8))',
          borderTop: '3px solid #4CAF50',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>🛡️ 지구 방어선</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>정답 화성인만 격추시키세요!</div>
          </div>
        </div>
      </div>

      {/* CSS 애니메이션 */}
      <style>
        {`
          @keyframes twinkle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          
          @keyframes invaderGlow {
            0% { box-shadow: 0 0 15px rgba(255,68,68,0.6); }
            100% { box-shadow: 0 0 25px rgba(255,68,68,0.8); }
          }
          
          @keyframes explosion {
            0% { 
              transform: translateX(-50%) scale(0.5);
              opacity: 1;
            }
            50% { 
              transform: translateX(-50%) scale(1.2);
              opacity: 0.8;
            }
            100% { 
              transform: translateX(-50%) scale(1.5);
              opacity: 0;
            }
          }
        `}
      </style>
    </div>
  );
}


