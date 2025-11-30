import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Word } from '../types/word';
import { useWords } from '../contexts/WordsContext';
import { logAttempt, saveSession, updateProgress } from '../services/trackingService';
import { addRecord, createRecordFromQuizResult, isNewRecord } from '../services/rankingService';
import './BossRaid.css';

type PhaseType = 'meaning' | 'image' | 'listening' | 'spelling';

const PHASE_TIME_SEC = 10;
const AUTO_NEXT_DELAY_MS = 1500;
const GAME_AREA_HEIGHT = 700;
const INVADER_SPEED = 1.2; // Slightly faster for excitement
const BOSS_MAX_HP = 10;

type Invader = {
  id: string;
  word: Word;
  x: number; // Percentage
  y: number; // Pixels
  isCorrect: boolean;
  isDestroyed: boolean;
};

type Laser = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

const BossRaid: React.FC = () => {
  const navigate = useNavigate();
  const { words } = useWords();
  const eligible = useMemo(() => words.filter(w => !!w.english && !!w.korean), [words]);
  const [bossHp, setBossHp] = useState(BOSS_MAX_HP);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(PHASE_TIME_SEC);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0); // 점수를 ref로도 추적하여 비동기 업데이트 문제 해결
  const [finished, setFinished] = useState(false);
  const [questionCount] = useState(10);
  const [quizStartTime, setQuizStartTime] = useState(0);
  const [showNewRecord, setShowNewRecord] = useState(false);
  const [invaders, setInvaders] = useState<Invader[]>([]);
  const [explosions, setExplosions] = useState<Array<{ id: string; x: number; y: number; timestamp: number }>>([]);
  const [isDamaged, setIsDamaged] = useState(false);
  const [lasers, setLasers] = useState<Laser[]>([]);

  const sessionIdRef = useRef<string | null>(null);
  const autoNextTimeoutRef = useRef<number | null>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const invaderIdRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  const phases: PhaseType[] = useMemo(() => {
    const base: PhaseType[] = ['meaning', 'image', 'listening', 'spelling'];
    const seq: PhaseType[] = [];
    for (let i = 0; i < questionCount; i++) seq.push(base[i % base.length]);
    return seq;
  }, [questionCount]);

  const currentType = phases[phaseIndex] || null;

  // Current Question Generation
  const currentQuestion = useMemo(() => {
    if (!currentType || eligible.length < 4) return null;
    const correct = pickRandom(eligible, 1)[0];
    const wrongOptions = pickRandom(
      eligible.filter(w => w.id !== correct.id),
      3
    );
    const allOptions = [...wrongOptions, correct];
    return {
      correct,
      options: pickRandom(allOptions, 4),
      type: currentType
    };
  }, [eligible, currentType, phaseIndex]);

  // TTS
  const speakWord = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    } catch { }
  }, []);

  // Sounds
  const playSound = useCallback((type: 'correct' | 'wrong' | 'record' | 'explosion' | 'laser') => {
    try {
      let src = '';
      if (type === 'correct') src = '/success.mp3';
      else if (type === 'wrong') src = '/wrong.mp3';
      else if (type === 'record') src = '/record.mp3';
      else if (type === 'explosion') src = '/explosion.mp3';
      else if (type === 'laser') src = '/laser.mp3';

      if (src) {
        const audio = new Audio(src);
        audio.volume = 0.6;
        audio.play().catch(() => { });
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  const startMission = useCallback(() => {
    setPhaseIndex(0);
    setFinished(false);
    setScore(0);
    scoreRef.current = 0; // ref도 초기화
    setBossHp(BOSS_MAX_HP);
    setSelected(null);
    setInvaders([]);
    if (bgmRef.current) {
      bgmRef.current.currentTime = 0;
      bgmRef.current.play().catch(() => { });
    }
  }, []);

  const stopBgm = useCallback(() => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
    }
  }, []);

  const handleAbort = useCallback(() => {
    stopBgm();
    navigate('/game');
  }, [navigate, stopBgm]);

  useEffect(() => {
    const bgm = new Audio('/boss_bgm.mp3');
    bgm.loop = true;
    bgm.volume = 0.25;
    bgmRef.current = bgm;
    return () => {
      bgm.pause();
      bgmRef.current = null;
    };
  }, []);

  // Spawn Invaders
  const spawnInvaders = useCallback(() => {
    if (!currentQuestion || !gameAreaRef.current) return;

    const gameAreaWidth = gameAreaRef.current.offsetWidth;
    // Use fixed percentages for better distribution
    const positions = [15, 38, 62, 85]; // Percentages

    const newInvaders: Invader[] = currentQuestion.options.map((word, index) => {
      return {
        id: `invader-${invaderIdRef.current++}`,
        word,
        x: positions[index % positions.length],
        y: 40, // Launch just under the plane
        isCorrect: word.id === currentQuestion.correct.id,
        isDestroyed: false
      };
    });

    setInvaders(newInvaders);
  }, [currentQuestion]);

  // Update Invaders Loop
  const updateInvaders = useCallback(() => {
    if (!gameAreaRef.current || finished) return;

    setInvaders(prev => {
      const updated = prev.map(invader => {
        if (invader.isDestroyed) return invader;
        return {
          ...invader,
          y: invader.y + INVADER_SPEED
        };
      });

      // Check collision with Earth
      const earthY = GAME_AREA_HEIGHT - 100;
      const reachedInvaders = updated.filter(invader =>
        !invader.isDestroyed && invader.y >= earthY
      );

      if (reachedInvaders.length > 0) {
        const wrongInvaders = reachedInvaders.filter(inv => !inv.isCorrect);
        if (wrongInvaders.length > 0) {
          setBossHp(prev => Math.max(0, prev - wrongInvaders.length));
          playSound('wrong');

          // Trigger damage flash
          setIsDamaged(true);
          setTimeout(() => setIsDamaged(false), 300);

          // Explosions at bottom
          wrongInvaders.forEach(inv => {
            playSound('explosion');
            setExplosions(prev => [...prev, {
              id: `explosion-${Date.now()}-${Math.random()}`,
              x: inv.x,
              y: earthY,
              timestamp: Date.now()
            }]);
          });

          // Remove reached invaders
          return updated.map(inv =>
            reachedInvaders.some(r => r.id === inv.id)
              ? { ...inv, isDestroyed: true }
              : inv
          );
        }
      }

      return updated.filter(inv => inv.y < GAME_AREA_HEIGHT + 200);
    });

    animationFrameRef.current = requestAnimationFrame(() => updateInvaders());
  }, [finished, playSound]);

  // Handle Click
  const handleInvaderClick = useCallback((invaderId: string) => {
    if (selected !== null || finished || !gameAreaRef.current) return;

    const invader = invaders.find(inv => inv.id === invaderId);
    if (!invader || invader.isDestroyed) return;

    setSelected(invaderId);

    const isCorrect = invader.isCorrect;

    // Calculate laser coordinates
    const gameArea = gameAreaRef.current;
    const startX = gameArea.offsetWidth / 2;
    const startY = gameArea.offsetHeight - 50; // Turret position
    const endX = (invader.x / 100) * gameArea.offsetWidth;
    const endY = invader.y + 70; // Center of invader (approx)

    // Fire laser
    playSound('laser'); // 레이저 발사 효과음
    const laserId = `laser-${Date.now()}`;
    setLasers(prev => [...prev, {
      id: laserId,
      x1: startX,
      y1: startY,
      x2: endX,
      y2: endY
    }]);

    // Remove laser after animation
    setTimeout(() => {
      setLasers(prev => prev.filter(l => l.id !== laserId));
    }, 200);

    if (isCorrect) {
      setBossHp(prev => Math.max(0, prev - 1));
      setScore(prev => {
        const newScore = prev + 1;
        scoreRef.current = newScore; // ref도 동시에 업데이트
        return newScore;
      });

      // Delay explosion slightly to match laser hit
      setTimeout(() => {
        playSound('explosion');
        setExplosions(prev => [...prev, {
          id: `explosion-${Date.now()}-${Math.random()}`,
          x: invader.x,
          y: invader.y,
          timestamp: Date.now()
        }]);

        setInvaders(prev => prev.map(inv =>
          inv.id === invaderId ? { ...inv, isDestroyed: true } : inv
        ));
      }, 100);

      logAttempt({
        sessionId: sessionIdRef.current,
        mode: 'bossRaid',
        wordId: invader.word.id,
        correct: true
      });
      updateProgress({ wordId: invader.word.id, correct: true });
    } else {
      playSound('wrong');
      setIsDamaged(true);
      setTimeout(() => setIsDamaged(false), 300);

      // Delay explosion slightly
      setTimeout(() => {
        playSound('explosion');
        setExplosions(prev => [...prev, {
          id: `explosion-${Date.now()}-${Math.random()}`,
          x: invader.x,
          y: invader.y,
          timestamp: Date.now()
        }]);

        setInvaders(prev => prev.map(inv =>
          inv.id === invaderId ? { ...inv, isDestroyed: true } : inv
        ));
      }, 100);

      logAttempt({
        sessionId: sessionIdRef.current,
        mode: 'bossRaid',
        wordId: invader.word.id,
        correct: false
      });
      updateProgress({ wordId: invader.word.id, correct: false });
    }

    if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
    autoNextTimeoutRef.current = window.setTimeout(() => {
      setSelected(null);
      goNextPhase();
    }, AUTO_NEXT_DELAY_MS);
  }, [selected, finished, invaders, playSound, gameAreaRef]);

  const goNextPhase = () => {
    if (bossHp <= 0 || phaseIndex + 1 >= questionCount) {
      finishRaid();
    } else {
      setPhaseIndex(prev => prev + 1);
      setSelected(null);
      setInvaders([]);
    }
  };

  const finishRaid = () => {
    setFinished(true);
    stopBgm();
    const durationSec = Math.round((Date.now() - quizStartTime) / 1000);
    // ref에서 최신 점수를 가져와서 사용 (비동기 상태 업데이트 문제 해결)
    const finalScore = scoreRef.current || score;
    saveSession({ mode: 'bossRaid', score: finalScore, total: questionCount, durationSec }).then(id => {
      sessionIdRef.current = id;
    });
    const totalTimeMs = durationSec * 1000;
    const accuracy = Math.round((finalScore / questionCount) * 100);
    // 100% 정답률이면 무조건 기록 저장 (신기록 여부와 관계없이)
    (async () => {
      try {
        if (accuracy === 100) {
          const record = createRecordFromQuizResult(
            'bossRaid',
            finalScore,
            questionCount,
            quizStartTime,
            Date.now(),
            questionCount
          );
          const success = await addRecord(record);
          if (success) {
            // 신기록인지 확인하여 UI 피드백
            const isNew = await isNewRecord('bossRaid', totalTimeMs, accuracy, questionCount);
            if (isNew) {
              setShowNewRecord(true);
            }
          }
        }
      } catch (err) {
        console.error('랭킹 기록 실패:', err);
      }
    })();
    playSound('record');
  };

  useEffect(() => {
    if (finished) return;
    setTimeLeft(PHASE_TIME_SEC);
    setInvaders([]);
    setSelected(null);
    if (phaseIndex === 0) {
      setQuizStartTime(Date.now());
      setBossHp(BOSS_MAX_HP);
      setScore(0);
      scoreRef.current = 0; // ref도 초기화
    }
  }, [phaseIndex, finished]);

  useEffect(() => {
    if (finished) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = Math.max(0, prev - 1);
        if (next === 0) goNextPhase();
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [finished, phaseIndex]);

  useEffect(() => {
    if (finished || !currentQuestion) return;
    spawnInvaders();
    animationFrameRef.current = requestAnimationFrame(() => updateInvaders());
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [currentQuestion, finished, spawnInvaders, updateInvaders]);

  useEffect(() => {
    const cleanup = setInterval(() => {
      setExplosions(prev => prev.filter(exp => Date.now() - exp.timestamp < 500));
    }, 100);
    return () => clearInterval(cleanup);
  }, []);

  // Start Screen
  if (!currentQuestion && !finished) {
    return (
      <div className="boss-raid-container">
        <div className="boss-raid-overlay">
          <div className="start-screen">
            <h2>👽 Alien Invasion</h2>
            <p style={{ marginBottom: 24, fontSize: 18 }}>Defend Earth from the incoming word invaders!</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button className="btn-space-outline" onClick={() => navigate('/game')}>BACK</button>
            <button className="btn-space" onClick={startMission}>START MISSION</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // End Screen
  if (finished) {
    // ref에서 최신 점수를 가져와서 사용 (비동기 상태 업데이트 문제 해결)
    const finalScore = scoreRef.current || score;
    const accuracy = Math.round((finalScore / questionCount) * 100);
    const isVictory = bossHp > 0; // If HP > 0 after all questions, or if we define victory differently. Actually usually bossHp <= 0 means we killed the boss, but here bossHp is OUR hp?
    // Wait, original logic: bossHp was "Boss HP". "오답 침공자가 지구에 도달하면 보스 HP 감소" -> This implies bossHp is actually Earth's HP or Player's HP.
    // However, `setBossHp(prev => Math.max(0, prev - 1))` when CORRECT answer implies damaging the BOSS.
    // The original code had mixed metaphors.
    // Let's stick to: We are defending Earth. Correct answer destroys invader.
    // If we want a "Boss" bar, maybe it represents the Invasion Force Strength.
    // Let's treat `bossHp` as "Invasion Force" remaining.
    // Victory if we survive? Or if we get high score?
    // Let's say Victory if Score > 5.

    return (
      <div className="boss-raid-container">
        <div className="boss-raid-overlay">
          <div className="end-screen">
            <h2>{finalScore >= 7 ? '🎉 MISSION ACCOMPLISHED' : '💥 MISSION FAILED'}</h2>
            {showNewRecord && <div style={{ color: '#ffd700', fontWeight: 800, marginBottom: 16 }}>🏆 NEW RECORD!</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, margin: '24px 0' }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 'bold', color: '#00d2ff' }}>{finalScore}</div>
                <div style={{ color: '#aaa' }}>SCORE</div>
              </div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 'bold', color: '#00d2ff' }}>{accuracy}%</div>
                <div style={{ color: '#aaa' }}>ACCURACY</div>
              </div>
            </div>

            <button className="btn-space" onClick={() => navigate('/game')}>RETURN TO BASE</button>
          </div>
        </div>
      </div>
    );
  }

  const hpPercentage = (bossHp / BOSS_MAX_HP) * 100;

  return (
    <div className={`boss-raid-container ${isDamaged ? 'damage-flash' : ''}`}>
      <div className="boss-raid-overlay">
        <div className="boss-top">
          <div className="boss-side-column">
            <button className="btn-space-outline boss-abort-btn" onClick={handleAbort}>뒤로가기</button>
            <div className="boss-score-panel boss-score-compact">
              <span>SCORE</span>
              <strong>{score}</strong>
            </div>
          </div>

          {/* Question Display */}
          <div className="question-display">
            {currentType === 'listening' && (
              <button className="btn-space" onClick={() => speakWord(currentQuestion!.correct.english)}>
                🎧 LISTEN
              </button>
            )}
            {currentType === 'image' && currentQuestion?.correct.imageUrl && (
              <img
                src={currentQuestion.correct.imageUrl}
                alt="Target"
                style={{ width: 220, height: 160, objectFit: 'cover', borderRadius: 10, border: '2px solid #00d2ff' }}
              />
            )}
            {currentType === 'meaning' && (
              <div className="boss-question-text">{currentQuestion!.correct.korean}</div>
            )}
            {currentType === 'spelling' && (
              <div className="boss-question-text">{currentQuestion!.correct.english}</div>
            )}
          </div>

          <div className="boss-side-column">
            <div className="boss-hp-bar-container">
              <div className="boss-hp-bar-fill" style={{ width: `${hpPercentage}%` }}></div>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div ref={gameAreaRef} className="game-area">
          <div className="invader-plane" />
          {/* Lasers */}
          <svg className="laser-container">
            {lasers.map(laser => (
              <line
                key={laser.id}
                x1={laser.x1}
                y1={laser.y1}
                x2={laser.x2}
                y2={laser.y2}
                className="laser-beam"
              />
            ))}
          </svg>

          {/* Invaders */}
          {invaders.map(invader => {
            if (invader.isDestroyed) return null;
            return (
              <div
                key={invader.id}
                className="word-missile"
                style={{ left: `${invader.x}%`, top: `${invader.y}px` }}
                onClick={() => handleInvaderClick(invader.id)}
              >
                <div className="missile-word">
                  {currentType === 'spelling' ? invader.word.korean : invader.word.english}
                </div>
              </div>
            );
          })}

          {/* Explosions */}
          {explosions.map(exp => (
            <div
              key={exp.id}
              className="explosion"
              style={{ left: `${exp.x}%`, top: `${exp.y}px` }}
            />
          ))}

          {/* Earth Defense */}
          <div className="earth-defense"></div>
        </div>
      </div>
    </div>
  );
};

export default BossRaid;
