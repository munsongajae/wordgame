import React, { useEffect, useMemo, useState } from 'react';
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

interface SpellingQuizProps {
  words: Word[];
  onBack: () => void;
}

const NUM_QUESTIONS = 10;

function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function SpellingQuiz({ words, onBack }: SpellingQuizProps) {
  const [questions, setQuestions] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [showImage, setShowImage] = useState(true); // true: 그림, false: 한글
  const [wrongQuestions, setWrongQuestions] = useState<Word[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const qs = pickRandom(words, Math.min(NUM_QUESTIONS, words.length));
    setQuestions(qs);
    setIndex(0);
    setSelectedAnswer(null);
    setChecked(null);
    setScore(0);
    setShowImage(true);
    setWrongQuestions([]);
    setFinished(false);
  }, [words]);

  // 4지 선다형 선택지 생성
  const currentQuestion = useMemo(() => {
    if (questions.length === 0) return null;
    
    const current = questions[index];
    const correctAnswer = current.english;
    
    // 다른 단어들에서 3개를 랜덤하게 선택
    const otherWords = words.filter(word => word.english !== correctAnswer);
    const availableWrongAnswers = Math.min(3, otherWords.length);
    const wrongAnswers = pickRandom(otherWords, availableWrongAnswers);
    
    // 정답과 오답들을 섞어서 4지 선다형 만들기
    const allOptions = shuffleArray([current, ...wrongAnswers]);
    
    return {
      word: current,
      options: allOptions,
      correctAnswer
    };
  }, [questions, index, words]);

  if (words.length === 0 || !currentQuestion) {
    return (
      <div className="quiz-container">
        <button className="back-button" onClick={onBack}>← 뒤로가기</button>
        <p>단어가 없습니다.</p>
      </div>
    );
  }

  const handleAnswerSelect = (option: Word) => {
    if (checked !== null) return; // 이미 답을 확인한 경우
    
    setSelectedAnswer(option.english);
    const isCorrect = option.english === currentQuestion.correctAnswer;
    setChecked(isCorrect);
    if (isCorrect) {
      setScore(s => s + 1);
      playCorrectSound(); // 정답 효과음 재생
    } else {
      playWrongSound();
      setWrongQuestions(prev => (prev.some(w => w.id === currentQuestion.word.id) ? prev : [...prev, currentQuestion.word]));
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex(i => i + 1);
    setSelectedAnswer(null);
    setChecked(null);
    setShowImage(true); // 다음 문제로 넘어갈 때 그림으로 초기화
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
          <h2 style={{ margin: 0, color: '#333' }}>🔤 철자 보고 맞추기 ({index + 1}/{questions.length})</h2>
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

      {!finished && (
        <div className="question-card" style={{ textAlign: 'center' }}>
        <div className="question-text">다음 철자를 보고 올바른 단어를 선택하세요</div>
          <div style={{ fontSize: 48, fontWeight: 800, margin: '12px 0', color: '#1e88e5' }}>{currentQuestion.word.english}</div>
        
        {/* 표시 방식 선택 버튼 */}
        <div style={{ textAlign: 'center', margin: '16px 0' }}>
          <div style={{ display: 'inline-flex', gap: '8px', backgroundColor: '#f5f5f5', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => setShowImage(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: showImage ? '#2196F3' : 'transparent',
                color: showImage ? 'white' : '#666',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              그림
            </button>
            <button
              onClick={() => setShowImage(false)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: showImage ? 'transparent' : '#2196F3',
                color: showImage ? '#666' : 'white',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              한글
            </button>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', margin: '16px auto', maxWidth: '520px' }}>
          {currentQuestion.options.map((option, optionIndex) => {
            const isCorrect = checked !== null && option.english === currentQuestion.correctAnswer;
            const isWrong = selectedAnswer === option.english && option.english !== currentQuestion.correctAnswer;
            
            return (
              <button
                key={optionIndex}
                onClick={() => handleAnswerSelect(option)}
                disabled={checked !== null}
                style={{
                  padding: '10px 20px',
                  fontSize: '26px',
                  fontWeight: '800',
                  borderRadius: '16px',
                  border: '2px solid #e0e0e0',
                  backgroundColor: checked === null 
                    ? '#fff' 
                    : isCorrect
                      ? '#4CAF50' 
                      : isWrong
                        ? '#F44336' 
                        : '#f5f5f5',
                  color: checked === null 
                    ? '#333' 
                    : isCorrect
                      ? '#fff' 
                      : isWrong
                        ? '#fff' 
                        : '#666',
                  cursor: checked === null ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  boxShadow: checked === null ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {showImage && option.imageUrl ? (
                  <img 
                    src={option.imageUrl} 
                    alt={option.english}
                    style={{ 
                      width: '80px', 
                      height: '80px', 
                      objectFit: 'cover', 
                      borderRadius: '8px' 
                    }}
                  />
                ) : (
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    backgroundColor: '#f0f0f0', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#999'
                  }}>
                    {showImage ? '이미지 없음' : ''}
                  </div>
                )}
                {!showImage && <span style={{ fontSize: 20 }}>{option.korean}</span>}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 20, display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button 
            className="next-button" 
            onClick={next} 
            disabled={checked === null}
            style={{
              padding: '16px 32px',
              fontSize: '18px',
              fontWeight: 'bold',
              backgroundColor: checked === null ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: checked === null ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: checked === null ? 'none' : '0 4px 12px rgba(76, 175, 80, 0.3)',
              minWidth: '120px'
            }}
          >
            다음
          </button>
        </div>
        
        {checked !== null && (
          <div style={{ marginTop: 12, fontWeight: 700, color: checked ? '#4CAF50' : '#F44336' }}>
            {checked ? '정답입니다! 🎉' : `오답입니다. 정답: ${currentQuestion.correctAnswer}`}
          </div>
        )}
      </div>
      )}

      {finished && (
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <h3 style={{ color: '#333' }}>결과</h3>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2196F3', margin: '12px 0' }}>
            점수: {score} / {questions.length}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
            {wrongQuestions.length > 0 && (
              <button
                onClick={() => {
                  setQuestions(wrongQuestions);
                  setWrongQuestions([]);
                  setIndex(0);
                  setSelectedAnswer(null);
                  setChecked(null);
                  setScore(0);
                  setShowImage(true);
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
                틀린 문제 다시 풀기 ({wrongQuestions.length})
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


