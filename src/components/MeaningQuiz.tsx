import React, { useMemo, useState } from 'react';
import { Word } from '../types/word';

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
  const questions = useMemo(() => (hasEnough ? pickRandom(words, Math.min(NUM_QUESTIONS, words.length)) : []), [words, hasEnough]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);

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
    if (selected !== null || !current) return;
    setSelected(optIndex);
    if (options[optIndex] === current.english) setScore(s => s + 1);
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
          점수: {score}
        </div>
      </div>

      {!hasEnough && (
        <div style={{ textAlign: 'center' }}>
          <p>문제를 만들기 위해 최소 {NUM_OPTIONS}개 이상의 단어가 필요합니다.</p>
        </div>
      )}

      {hasEnough && current && (
        <>
          <div className="question-card" style={{ textAlign: 'center' }}>
            <div className="question-text">다음 한국어 뜻에 맞는 영어 단어를 고르세요</div>
            <div style={{ fontSize: 28, fontWeight: 700, margin: '12px 0' }}>{current.korean}</div>
          </div>

          <div className="options" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, 1fr)', justifyItems: 'center', maxWidth: 480, margin: '0 auto' }}>
            {options.map((opt, i) => {
              const isCorrect = selected !== null && opt === current.english;
              const isWrong = selected === i && opt !== current.english;
              return (
                <button
                  key={`${current.id}_${i}`}
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
                  {opt}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <button className="next-button" onClick={next} disabled={selected === null}>다음</button>
          </div>
          
          {selected !== null && (
            <div style={{ marginTop: 12, fontWeight: 700, color: selected !== null && options[selected] === current.english ? '#4CAF50' : '#F44336', textAlign: 'center' }}>
              {selected !== null && options[selected] === current.english ? '정답입니다! 🎉' : `오답입니다. 정답: ${current.english}`}
            </div>
          )}
        </>
      )}
    </div>
  );
}


