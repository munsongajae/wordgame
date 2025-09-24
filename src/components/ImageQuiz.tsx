import React, { useMemo, useState } from 'react';
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

interface ImageQuizProps {
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

export default function ImageQuiz({ words, onBack }: ImageQuizProps) {
  const eligible = useMemo(() => words.filter(w => !!w.imageUrl), [words]);
  const hasEnough = eligible.length >= NUM_OPTIONS;
  const questions = useMemo(
    () => (hasEnough ? pickRandom(eligible, Math.min(NUM_QUESTIONS, eligible.length)) : []),
    [eligible, hasEnough]
  );
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  // 옵션 표시는 항상 영어로 표시
  const [isSpeaking, setIsSpeaking] = useState(false);

  const current = questions[index] || null;

  const options = useMemo(() => {
    if (!current) return [] as Word[];
    const others = pickRandom(
      eligible.filter(w => w.id !== current.id),
      Math.max(0, NUM_OPTIONS - 1)
    );
    const pool = [...others, current];
    return pickRandom(pool, pool.length);
  }, [current, eligible]);

  const handleSelect = (optIndex: number) => {
    if (selected !== null || !current) return;
    setSelected(optIndex);
    if (options[optIndex].id === current.id) {
      setScore(s => s + 1);
      playCorrectSound(); // 정답 효과음 재생
    }
  };

  const next = () => {
    if (!current) {
      onBack();
      return;
    }
    if (index + 1 >= questions.length) {
      alert(`완료! 점수: ${score} / ${questions.length}`);
      onBack();
      return;
    }
    setIndex(i => i + 1);
    setSelected(null);
  };

  const speakOptions = () => {
    if (!current) return;
    if (!("speechSynthesis" in window)) {
      alert('이 브라우저에서는 음성 합성이 지원되지 않습니다.');
      return;
    }
    try {
      window.speechSynthesis.cancel();
      setIsSpeaking(true);
      let i = 0;
      const playNext = () => {
        if (i >= options.length) {
          setIsSpeaking(false);
          return;
        }
        const word = options[i].english;
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 1.0; // 더 빠르게
        utterance.pitch = 1;
        utterance.onend = () => {
          i += 1;
          // 즉시 다음 발음 재생
          setTimeout(playNext, 0);
        };
        window.speechSynthesis.speak(utterance);
      };
      playNext();
    } catch (e) {
      console.error('발음 재생 오류:', e);
      setIsSpeaking(false);
    }
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
          <h2 style={{ margin: 0, color: '#333' }}>🖼️ 그림 보고 맞추기 {current ? `(${index + 1}/${questions.length})` : ''}</h2>
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
          점수: {score}
        </div>
      </div>

      {!hasEnough && (
        <div style={{ textAlign: 'center' }}>
          <p>이미지 URL이 있는 단어가 최소 {NUM_OPTIONS}개 필요합니다.</p>
        </div>
      )}

      {hasEnough && current && (
        <>
          <div style={{ textAlign: 'center', margin: 16 }}>
            {current.imageUrl ? (
              <img src={current.imageUrl} alt={current.english} style={{ maxWidth: 360, maxHeight: 240, borderRadius: 12, objectFit: 'cover' }} />
            ) : (
              <div style={{ height: 200 }}>이미지가 없습니다</div>
            )}
          </div>

          {/* 발음 듣기 버튼 (옵션 4개를 순서대로 재생) */}
          <div style={{ textAlign: 'center', margin: '12px 0' }}>
            <button
              onClick={speakOptions}
              disabled={isSpeaking}
              style={{
                padding: '10px 18px',
                fontSize: 16,
                backgroundColor: isSpeaking ? '#ccc' : '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                cursor: isSpeaking ? 'not-allowed' : 'pointer',
                boxShadow: isSpeaking ? 'none' : '0 4px 12px rgba(25,118,210,0.25)'
              }}
            >
              🔊 발음 듣기
            </button>
          </div>

          <div className="options" style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr', justifyItems: 'center', maxWidth: 480, margin: '0 auto' }}>
            {options.map((w, i) => {
              const isCorrect = selected !== null && w.id === current.id;
              const isWrong = selected === i && w.id !== current.id;
              return (
                <button
                  key={w.id}
                  onClick={() => handleSelect(i)}
                  className={`option-button ${isCorrect ? 'correct' : ''} ${isWrong ? 'incorrect' : ''}`}
                  disabled={selected !== null}
                  style={{
                    fontSize: 28,
                    lineHeight: '1.2',
                    width: 240,
                    textAlign: 'center',
                    justifySelf: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '20px',
                    borderRadius: 14,
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
                  {w.english}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button 
              className="next-button" 
              onClick={next} 
              disabled={selected === null}
              style={{
                padding: '16px 32px',
                fontSize: '18px',
                fontWeight: 'bold',
                backgroundColor: selected === null ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: selected === null ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: selected === null ? 'none' : '0 4px 12px rgba(76, 175, 80, 0.3)',
                minWidth: '120px'
              }}
            >
              다음
            </button>
          </div>
          
          {selected !== null && (
            <div style={{ marginTop: 12, fontWeight: 700, color: selected !== null && options[selected].id === current.id ? '#4CAF50' : '#F44336', textAlign: 'center' }}>
              {selected !== null && options[selected].id === current.id ? '정답입니다! 🎉' : `오답입니다. 정답: ${current.english}`}
            </div>
          )}
        </>
      )}
    </div>
  );
}


