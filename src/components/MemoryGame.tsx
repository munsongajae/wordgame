import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Word } from '../types/word';
import { useWords } from '../contexts/WordsContext';
import { logAttempt, saveSession, updateProgress } from '../services/trackingService';
import { createRecordFromQuizResult, isNewRecord, addRecord } from '../services/rankingService';

type CardType = {
  id: string;
  word: Word;
  type: 'english' | 'korean';
  isFlipped: boolean;
  isMatched: boolean;
};

const MemoryGame: React.FC = () => {
  const navigate = useNavigate();
  const { words } = useWords();
  const eligible = useMemo(() => words.filter(w => !!w.english && !!w.korean), [words]);
  
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [cards, setCards] = useState<CardType[]>([]);
  const [flippedCards, setFlippedCards] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [finished, setFinished] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(0);
  const [showNewRecord, setShowNewRecord] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // 사운드 효과
  const playCorrectSound = useCallback(() => {
    try {
      const audio = new Audio('/success.mp3');
      audio.volume = 0.7;
      audio.play().catch(console.error);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const playWrongSound = useCallback(() => {
    try {
      const audio = new Audio('/wrong.mp3');
      audio.volume = 0.7;
      audio.play().catch(console.error);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const playClickSound = useCallback(() => {
    try {
      // 간단한 클릭 효과음 (Web Audio API 사용)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.error('클릭 사운드 재생 실패:', error);
    }
  }, []);

  // 카드 생성 및 셔플
  const initializeCards = useCallback((count: number) => {
    const selectedWords = eligible
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
    
    const newCards: CardType[] = [];
    
    selectedWords.forEach((word, index) => {
      // 영어 카드
      newCards.push({
        id: `english-${word.id}`,
        word,
        type: 'english',
        isFlipped: false,
        isMatched: false
      });
      
      // 한글 카드
      newCards.push({
        id: `korean-${word.id}`,
        word,
        type: 'korean',
        isFlipped: false,
        isMatched: false
      });
    });
    
    // 카드 섞기
    const shuffled = newCards.sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setFlippedCards([]);
    setMatchedPairs(0);
    setMoves(0);
    setFinished(false);
    setGameStartTime(Date.now());
  }, [eligible]);

  // 카드 클릭 처리
  const handleCardClick = useCallback((cardId: string) => {
    if (finished) return;
    
    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;
    
    // 이미 2장이 뒤집혀 있으면 무시
    if (flippedCards.length >= 2) return;
    
    // 같은 카드를 다시 클릭하면 무시
    if (flippedCards.includes(cardId)) return;
    
    // 카드 클릭 효과음
    playClickSound();
    
    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);
    
    // 카드 뒤집기
    setCards(prev => prev.map(c => 
      c.id === cardId ? { ...c, isFlipped: true } : c
    ));
    
    // 2장이 뒤집혔을 때 매칭 확인
    if (newFlipped.length === 2) {
      setMoves(prev => prev + 1);
      
      const [firstId, secondId] = newFlipped;
      const firstCard = cards.find(c => c.id === firstId);
      const secondCard = cards.find(c => c.id === secondId);
      
      if (firstCard && secondCard && firstCard.word.id === secondCard.word.id) {
        // 매칭 성공 - 정답 사운드
        playCorrectSound();
        
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            c.word.id === firstCard.word.id 
              ? { ...c, isMatched: true, isFlipped: false }
              : c
          ));
          setMatchedPairs(prev => prev + 1);
          setFlippedCards([]);
          
          // 정답 기록
          logAttempt({ 
            sessionId, 
            mode: 'memoryGame', 
            wordId: firstCard.word.id, 
            correct: true 
          });
          updateProgress({ wordId: firstCard.word.id, correct: true });
        }, 500);
      } else {
        // 매칭 실패 - 오답 사운드
        playWrongSound();
        
        setTimeout(() => {
          setCards(prev => prev.map(c => 
            newFlipped.includes(c.id) 
              ? { ...c, isFlipped: false }
              : c
          ));
          setFlippedCards([]);
          
          // 오답 기록
          if (firstCard) {
            logAttempt({ 
              sessionId, 
              mode: 'memoryGame', 
              wordId: firstCard.word.id, 
              correct: false 
            });
            updateProgress({ wordId: firstCard.word.id, correct: false });
          }
        }, 1000);
      }
    }
  }, [cards, flippedCards, finished, sessionId, playClickSound, playCorrectSound, playWrongSound]);

  // 게임 완료 확인
  useEffect(() => {
    if (questionCount && matchedPairs === questionCount && !finished) {
      setFinished(true);
      const durationSec = Math.round((Date.now() - gameStartTime) / 1000);
      
      saveSession({
        sessionIdHint: sessionId,
        mode: 'memoryGame',
        score: matchedPairs,
        total: questionCount,
        durationSec
      });
      
      const totalTimeMs = durationSec * 1000;
      const accuracy = 100; // 메모리 게임은 완료 시 100%
      
      // 100% 정답률이면 무조건 기록 저장 (신기록 여부와 관계없이)
      (async () => {
        try {
          if (accuracy === 100) {
            const record = createRecordFromQuizResult(
              'memoryGame',
              matchedPairs,
              questionCount,
              gameStartTime,
              Date.now(),
              questionCount
            );
            const success = await addRecord(record);
            if (success) {
              // 신기록인지 확인하여 UI 피드백
              const isNew = await isNewRecord('memoryGame', totalTimeMs, accuracy, questionCount);
              if (isNew) {
                setShowNewRecord(true);
              }
            }
          }
        } catch (e) {
          console.warn('신기록 처리 중 오류(무시 가능):', e);
        }
      })();
    }
  }, [matchedPairs, questionCount, finished, gameStartTime, sessionId]);

  // 문제 수 선택 화면
  if (questionCount === null) {
    const questionCounts = [4, 6, 8, 10, 12];
    
    return (
      <div className="app-container">
        <div className="app-main">
          <header className="game-header">
            <button className="close-btn" onClick={() => navigate('/game')}>✕</button>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>🎴 단어 메모리 게임</h1>
          </header>

          <div className="question-area" style={{ padding: 20 }}>
            <h2 className="card-title" style={{ marginBottom: 24 }}>문제 수 선택</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
              gap: 16,
              maxWidth: 600,
              margin: '0 auto'
            }}>
              {questionCounts.map(count => (
                <button
                  key={count}
                  onClick={() => {
                    if (eligible.length >= count) {
                      setQuestionCount(count);
                      initializeCards(count);
                    } else {
                      alert(`단어가 부족합니다. 최소 ${count}개의 단어가 필요합니다.`);
                    }
                  }}
                  className="game-card"
                  style={{
                    padding: 24,
                    fontSize: 24,
                    fontWeight: 700,
                    backgroundColor: eligible.length >= count ? 'white' : '#f5f5f5',
                    borderColor: eligible.length >= count ? 'var(--color-secondary)' : 'var(--color-ash)',
                    cursor: eligible.length >= count ? 'pointer' : 'not-allowed',
                    opacity: eligible.length >= count ? 1 : 0.5
                  }}
                >
                  {count}
                </button>
              ))}
            </div>
            <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--color-slate)' }}>
              영어와 한글 카드를 맞춰보세요!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 게임 완료 화면
  if (finished) {
    const durationSec = Math.round((Date.now() - gameStartTime) / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2 className="card-title">🎉 게임 완료!</h2>
          {showNewRecord && (
            <div style={{ color: 'var(--color-accent)', fontWeight: 800, marginBottom: 16 }}>
              🏆 신기록 달성!
            </div>
          )}

          <div className="stats-grid" style={{ marginTop: 24 }}>
            <div className="stat-item">
              <div className="stat-value">{matchedPairs}</div>
              <div className="stat-label">맞춘 쌍</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{moves}</div>
              <div className="stat-label">시도 횟수</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">
                {minutes > 0 ? `${minutes}분 ` : ''}{seconds}초
              </div>
              <div className="stat-label">소요 시간</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button 
              className="btn btn-outline" 
              onClick={() => {
                setQuestionCount(null);
                setFinished(false);
              }}
              style={{ flex: 1 }}
            >
              다시하기
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => navigate('/game')} 
              style={{ flex: 1 }}
            >
              메인으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 게임 화면
  const gridCols = questionCount <= 6 ? 4 : questionCount <= 8 ? 4 : 6;

  return (
    <div className="app-container">
      <div className="app-main">
        <header className="game-header">
          <button className="close-btn" onClick={() => navigate('/game')}>✕</button>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              쌍: {matchedPairs} / {questionCount}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-slate)' }}>
              시도: {moves}
            </div>
          </div>
        </header>

        <div style={{ padding: 20 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: 12,
            maxWidth: 800,
            margin: '0 auto'
          }}>
            {cards.map(card => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className="game-card"
                style={{
                  aspectRatio: '1',
                  padding: 12,
                  fontSize: card.type === 'english' ? 32 : 28,
                  fontWeight: 700,
                  backgroundColor: card.isMatched 
                    ? 'var(--color-secondary-light)' 
                    : card.isFlipped 
                    ? 'white' 
                    : 'var(--color-secondary)',
                  borderColor: card.isMatched 
                    ? 'var(--color-secondary)' 
                    : card.isFlipped 
                    ? 'var(--color-secondary)' 
                    : 'var(--color-secondary)',
                  color: card.isMatched 
                    ? 'var(--color-secondary-shadow)' 
                    : card.isFlipped 
                    ? 'var(--color-ink)' 
                    : 'white',
                  cursor: card.isMatched ? 'default' : 'pointer',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                disabled={card.isMatched}
              >
                {card.isMatched ? (
                  <span>{card.type === 'english' ? card.word.english : card.word.korean}</span>
                ) : card.isFlipped ? (
                  <span>{card.type === 'english' ? card.word.english : card.word.korean}</span>
                ) : (
                  <span style={{ fontSize: 32 }}>?</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoryGame;

