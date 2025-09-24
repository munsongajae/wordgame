import React, { useMemo, useState } from 'react';
import { Word } from '../types/word';

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
  const [showEnglish, setShowEnglish] = useState(true); // true: 영어, false: 한글

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
    if (options[optIndex].id === current.id) setScore(s => s + 1);
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
    setShowEnglish(true); // 다음 문제로 넘어갈 때 영어로 초기화
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

          {/* 언어 선택 버튼 */}
          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <div style={{ display: 'inline-flex', gap: '8px', backgroundColor: '#f5f5f5', padding: '4px', borderRadius: '8px' }}>
              <button
                onClick={() => setShowEnglish(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: showEnglish ? '#2196F3' : 'transparent',
                  color: showEnglish ? 'white' : '#666',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                영어
              </button>
              <button
                onClick={() => setShowEnglish(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: showEnglish ? 'transparent' : '#2196F3',
                  color: showEnglish ? '#666' : 'white',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                한글
              </button>
            </div>
          </div>

          <div className="options" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, 1fr)', justifyItems: 'center', maxWidth: 480, margin: '0 auto' }}>
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
                    fontSize: 20,
                    lineHeight: '1.2',
                    width: 200,
                    textAlign: 'center',
                    justifySelf: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '16px'
                  }}
                >
                  {showEnglish ? w.english : w.korean}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button className="next-button" onClick={next} disabled={selected === null}>다음</button>
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


