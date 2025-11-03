import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Word } from '../types/word';
import { logAttempt, saveSession, updateProgress } from '../services/trackingService';
import { addRecord, createRecordFromQuizResult, isNewRecord } from '../services/rankingService';

interface BossRaidProps {
  words: Word[];
  onBack: () => void;
}

type PhaseType = 'meaning' | 'image' | 'listening' | 'spelling';

const PHASE_TIME_SEC = 20;
const AUTO_NEXT_DELAY_MS = 800;

function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

const BossRaid: React.FC<BossRaidProps> = ({ words, onBack }) => {
  const eligible = useMemo(() => words.filter(w => !!w.english && !!w.korean), [words]);
  const [bossHp, setBossHp] = useState(10);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(PHASE_TIME_SEC);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [questionCount] = useState(10);
  const [quizStartTime, setQuizStartTime] = useState(0);
  const [showNewRecord, setShowNewRecord] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const autoNextTimeoutRef = useRef<number | null>(null);

  const phases: PhaseType[] = useMemo(() => {
    const base: PhaseType[] = ['meaning', 'image', 'listening', 'spelling'];
    const seq: PhaseType[] = [];
    for (let i = 0; i < questionCount; i++) seq.push(base[i % base.length]);
    return seq;
  }, [questionCount]);

  const currentType = phases[phaseIndex] || null;
  const options = useMemo(() => {
    const current = eligible[Math.floor(Math.random() * eligible.length)];
    if (!current) return [] as Word[];
    const pool = pickRandom(eligible.filter(w => w.id !== current.id), 3);
    return pickRandom([...pool, current], 4);
  }, [eligible, phaseIndex]);

  const currentAnswer = useMemo(() => options.find(o => eligible.some(e => e.id === o.id) && options.every(opt => opt.id !== undefined)) && options.find(o => o), [options]);
  const current = useMemo(() => options.find(w => w && w.english), [options]);

  // simple TTS for listening
  const speakWord = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  useEffect(() => {
    if (finished) return;
    setTimeLeft(PHASE_TIME_SEC);
    if (phaseIndex === 0) setQuizStartTime(Date.now());
  }, [phaseIndex, finished]);

  useEffect(() => {
    if (finished) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const next = Math.max(0, prev - 1);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [finished, phaseIndex]);

  useEffect(() => {
    if (timeLeft === 0 && !finished) {
      // time over -> move next phase, small penalty
      setBossHp(hp => Math.max(0, hp - 0));
      goNextPhase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const handleSelect = (i: number) => {
    if (selected !== null || finished) return;
    setSelected(i);
    setChecked(null);
  };

  const handleCheck = () => {
    if (selected === null || finished) return;
    const cur = options[selected];
    const correct = (() => {
      switch (currentType) {
        case 'meaning':
          return !!(cur?.english && cur.english === options.find(o => o.english)?.english);
        case 'image':
          return !!(cur?.id && cur.id === options.find(o => o.id === cur.id)?.id && !!cur.imageUrl);
        case 'listening':
          return !!(cur?.english && cur.english === options.find(o => o.english)?.english);
        case 'spelling':
          return !!(cur?.english && cur.english === options.find(o => o.english)?.english);
        default:
          return false;
      }
    })();

    setChecked(correct);
    if (correct) {
      setScore(s => s + 1);
      setBossHp(hp => Math.max(0, hp - 1));
      logAttempt({ sessionId: sessionIdRef.current, mode: 'combinedQuiz', wordId: cur?.id || 'unknown', correct: true });
      updateProgress({ wordId: cur?.id || 'unknown', correct: true });
    } else {
      logAttempt({ sessionId: sessionIdRef.current, mode: 'combinedQuiz', wordId: cur?.id || 'unknown', correct: false });
      updateProgress({ wordId: cur?.id || 'unknown', correct: false });
    }

    if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
    autoNextTimeoutRef.current = window.setTimeout(() => {
      setSelected(null);
      setChecked(null);
      goNextPhase();
    }, AUTO_NEXT_DELAY_MS);
  };

  const goNextPhase = () => {
    if (bossHp <= 0 || phaseIndex + 1 >= questionCount) {
      finishRaid();
    } else {
      setPhaseIndex(p => p + 1);
    }
  };

  const finishRaid = () => {
    setFinished(true);
    const durationSec = Math.round((Date.now() - quizStartTime) / 1000);
    saveSession({ mode: 'combinedQuiz', score, total: questionCount, durationSec }).then(() => {});
    const totalTimeMs = durationSec * 1000;
    const accuracy = Math.round((score / questionCount) * 100);
    try {
      if (isNewRecord('combinedQuiz', totalTimeMs, accuracy, questionCount)) {
        const record = createRecordFromQuizResult('combinedQuiz', score, questionCount, quizStartTime, Date.now(), questionCount);
        addRecord(record);
        setShowNewRecord(true);
      }
    } catch {}
  };

  // UI
  if (finished) {
    const accuracy = Math.round((score / questionCount) * 100);
    const durationSec = Math.round((Date.now() - quizStartTime) / 1000);
    return (
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <h3 style={{ color: '#333', fontSize: '28px', marginBottom: '20px' }}>👹 보스 레이드 결과</h3>
        {showNewRecord && (
          <div style={{ backgroundColor: '#fff3cd', border: '2px solid #ffc107', borderRadius: 12, padding: 15, margin: '10px 0', color: '#856404', animation: 'pulse 2s infinite' }}>
            🏆 신기록 달성! 순위에 기록되었습니다!
          </div>
        )}
        <div style={{ fontSize: 36, fontWeight: 800, color: '#2196F3', margin: '20px 0' }}>{score} / {questionCount}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 30, margin: '20px 0', flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: '#e3f2fd', padding: '15px 25px', borderRadius: 12, border: '2px solid #2196F3' }}>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 5 }}>정답률</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1976d2' }}>{accuracy}%</div>
          </div>
          <div style={{ backgroundColor: '#f3e5f5', padding: '15px 25px', borderRadius: 12, border: '2px solid #9c27b0' }}>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 5 }}>클리어 시간</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#7b1fa2' }}>{durationSec}초</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 15, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{ padding: '15px 30px', fontSize: 18, backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 'bold' }}>메인으로</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="quiz-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button className="back-button" onClick={onBack}>← 뒤로가기</button>
        <div style={{ fontWeight: 'bold' }}>👹 보스 HP: {bossHp} / 10</div>
        <div style={{ backgroundColor: '#f5f5f5', padding: '8px 16px', borderRadius: 20, fontWeight: 'bold', color: '#2196F3' }}>⏱️ {timeLeft}s</div>
      </div>

      {/* 안내 카드 */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ display: 'inline-block', padding: '12px 16px', margin: '12px 0', backgroundColor: '#fff', border: '2px solid #e0e0e0', borderRadius: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 18, color: '#333', fontWeight: 700 }}>패턴: {currentType === 'meaning' ? '뜻 고르기' : currentType === 'image' ? '그림 고르기' : currentType === 'listening' ? '발음 듣고 고르기' : '철자 고르기'}</div>
        </div>
      </div>

      {currentType === 'listening' && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <button onClick={() => speakWord(options.find(o => o)?.english || '')} style={{ padding: '12px 24px', fontSize: 18, backgroundColor: '#FF9800', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 'bold' }}>🎧 듣기</button>
        </div>
      )}

      {/* 선택지 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, justifyItems: 'center', maxWidth: 600, margin: '0 auto' }}>
        {options.map((w, i) => (
          <button key={w.id || i} onClick={() => handleSelect(i)} disabled={selected !== null}
            style={{ width: 260, minHeight: 80, padding: 12, borderRadius: 12, border: '2px solid #e0e0e0', backgroundColor: selected === i ? '#E8F5E9' : '#fff', cursor: selected !== null ? 'default' : 'pointer', fontSize: 20, fontWeight: 700 }}>
            {currentType === 'image' && w.imageUrl ? (
              <img src={w.imageUrl} alt={w.english} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
            ) : null}
            {currentType === 'meaning' ? w.english : currentType === 'spelling' ? w.english : w.english}
          </button>
        ))}
      </div>

      {/* 확인 버튼 / 판정 */}
      {selected !== null && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={handleCheck} disabled={checked !== null} style={{ padding: '12px 24px', fontSize: 18, backgroundColor: '#FF9800', color: '#fff', border: 'none', borderRadius: 10, cursor: checked !== null ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>✅ 정답 확인</button>
        </div>
      )}

      {checked !== null && (
        <div style={{ marginTop: 12, fontWeight: 700, color: checked ? '#4CAF50' : '#F44336', textAlign: 'center' }}>
          {checked ? '정답입니다! 🎉' : `오답입니다.`}
        </div>
      )}
    </div>
  );
};

export default BossRaid;

