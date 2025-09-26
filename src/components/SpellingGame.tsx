import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Word } from '../types/word';
import { logAttempt, saveSession, updateProgress } from '../services/trackingService';
import { createRecordFromQuizResult, isNewRecord, addRecord } from '../services/rankingService';

interface SpellingGameProps {
  words: Word[];
  onBack: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NUM_OPTIONS = 4;
const COUNTDOWN_BEEP_DURATION = 0.2;
const AUTO_NEXT_DELAY_MS = 1500;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pickRandom<T>(array: T[], count: number): T[] {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, count);
}

const SpellingGame: React.FC<SpellingGameProps> = ({ words, onBack }) => {
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [quizStartTime, setQuizStartTime] = useState(0);
  const [showNewRecord, setShowNewRecord] = useState(false);
  
  // 게임 상태
  const [shuffledLetters, setShuffledLetters] = useState<string[]>([]);
  const [userAnswer, setUserAnswer] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  
  const scoreRef = useRef(0);
  const autoNextTimeoutRef = useRef<number | null>(null);

  // 점수 동기화
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // 사운드 효과들
  const playCorrectSound = useCallback(() => {
    try {
      console.log('철자 게임 정답 사운드 재생 시도 - success.mp3 파일 사용');
      
      const audio = new Audio('/success.mp3');
      audio.volume = 0.7;
      
      audio.play()
        .then(() => {
          console.log('철자 게임 정답 사운드 재생 완료 - success.mp3');
        })
        .catch((error) => {
          console.error('success.mp3 재생 실패, 폴백 사운드 재생:', error);
          
          try {
            const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
            const audioContext = new AudioCtx();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
            
            console.log('철자 게임 폴백 정답 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('철자 게임 폴백 정답 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('철자 게임 정답 사운드 재생 전체 실패:', error);
    }
  }, []);

  const playWrongSound = useCallback(() => {
    try {
      console.log('철자 게임 오답 사운드 재생 시도 - wrong.mp3 파일 사용');
      
      const audio = new Audio('/wrong.mp3');
      audio.volume = 0.7;
      
      audio.play()
        .then(() => {
          console.log('철자 게임 오답 사운드 재생 완료 - wrong.mp3');
        })
        .catch((error) => {
          console.error('wrong.mp3 재생 실패, 폴백 사운드 재생:', error);
          
          try {
            const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
            const audioContext = new AudioCtx();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
            
            console.log('철자 게임 폴백 오답 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('철자 게임 폴백 오답 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('철자 게임 오답 사운드 재생 전체 실패:', error);
    }
  }, []);

  const playRecordSound = useCallback(() => {
    try {
      console.log('철자 게임 신기록 사운드 재생 시도 - record.mp3 파일 사용');
      
      const audio = new Audio('/record.mp3');
      audio.volume = 0.8;
      
      audio.play()
        .then(() => {
          console.log('철자 게임 신기록 사운드 재생 완료 - record.mp3');
        })
        .catch((error) => {
          console.error('record.mp3 재생 실패, 폴백 사운드 재생:', error);
          
          try {
            const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
            const audioContext = new AudioCtx();
            
            const frequencies = [523.25, 659.25, 783.99, 1046.50];
            frequencies.forEach((freq, i) => {
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
              
              gainNode.gain.setValueAtTime(0, audioContext.currentTime + i * 0.1);
              gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + i * 0.1 + 0.05);
              gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + i * 0.1 + 0.4);
              
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              oscillator.start(audioContext.currentTime + i * 0.1);
              oscillator.stop(audioContext.currentTime + i * 0.1 + 0.4);
            });
            
            console.log('철자 게임 폴백 신기록 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('철자 게임 폴백 신기록 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('철자 게임 신기록 사운드 재생 전체 실패:', error);
    }
  }, []);

  const playCountdownBeep = () => {
    try {
      console.log('철자 게임 타이머 사운드 재생 시도 - timer.mp3 파일 사용');
      
      const audio = new Audio('/timer.mp3');
      audio.volume = 0.5;
      
      audio.play()
        .then(() => {
          console.log('철자 게임 타이머 사운드 재생 완료 - timer.mp3');
        })
        .catch((error) => {
          console.error('timer.mp3 재생 실패, 폴백 사운드 재생:', error);
          
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
            
            console.log('철자 게임 폴백 타이머 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('철자 게임 폴백 타이머 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('철자 게임 타이머 사운드 재생 전체 실패:', error);
    }
  };

  const current = questions[index] || null;

  // 문제 수 선택
  const handleQuestionCountSelect = (count: number | 'infinite') => {
    if (count === 'infinite') {
      setQuestionCount(null);
      setQuestions(pickRandom(words, Math.min(words.length, 50)));
    } else {
      setQuestionCount(count);
      setQuestions(pickRandom(words, count));
    }
  };

  // 문제 초기화
  useEffect(() => {
    if (current && questions.length > 0) {
      const letters = current.english.toUpperCase().split('');
      setShuffledLetters(shuffleArray(letters));
      setUserAnswer([]);
      setSelectedIndices([]);
      setIsCorrect(null);
      
      // 단어 길이에 따른 시간 설정
      const baseTime = Math.max(15, current.english.length * 3);
      setTimeLeft(baseTime);
    }
  }, [current, questions.length]);

  // 타이머
  useEffect(() => {
    if (finished || !current) return;
    
    // 첫 번째 문제 시작 시에만 퀴즈 시작 시간 기록
    if (index === 0 && quizStartTime === 0) {
      setQuizStartTime(Date.now());
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (isCorrect === null && current) {
            playWrongSound();
            logAttempt({ sessionId, mode: 'spellingGame', wordId: current.id, correct: false });
            updateProgress({ wordId: current.id, correct: false });
            setIsCorrect(false);
            
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
        if (isCorrect === null && nextValue === 3) {
          playCountdownBeep();
        }
        return nextValue;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, finished, current, isCorrect]);

  // 글자 선택
  const handleLetterClick = (letterIndex: number) => {
    if (isCorrect !== null || selectedIndices.includes(letterIndex)) return;
    
    const newSelectedIndices = [...selectedIndices, letterIndex];
    const newUserAnswer = [...userAnswer, shuffledLetters[letterIndex]];
    
    setSelectedIndices(newSelectedIndices);
    setUserAnswer(newUserAnswer);
    
    // 모든 글자를 선택했으면 확인 버튼 활성화
    if (newUserAnswer.length === current!.english.length) {
      console.log('🎯 모든 글자 선택 완료! 확인 버튼 활성화');
    }
  };

  // 입력된 글자 제거
  const handleAnswerLetterClick = (answerIndex: number) => {
    if (isCorrect !== null) return;
    
    // 해당 위치의 글자를 제거하고 뒤의 글자들을 앞으로 당김
    const newUserAnswer = userAnswer.filter((_, index) => index !== answerIndex);
    
    // 선택된 인덱스도 업데이트 (제거된 글자의 원래 인덱스를 찾아서 제거)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const removedLetterIndex = selectedIndices[answerIndex];
    const newSelectedIndices = selectedIndices.filter((_, index) => index !== answerIndex);
    
    setUserAnswer(newUserAnswer);
    setSelectedIndices(newSelectedIndices);
  };


  // 정답 확인 버튼 핸들러
  const handleCheckAnswer = () => {
    if (isCorrect !== null || !current) return;
    
    const answer = userAnswer.join('');
    const correct = answer.toLowerCase() === current.english.toLowerCase();
    setIsCorrect(correct);
    
    if (correct) {
      playCorrectSound();
      setScore(prev => prev + 1);
      logAttempt({ sessionId, mode: 'spellingGame', wordId: current.id, correct: true });
      updateProgress({ wordId: current.id, correct: true });
    } else {
      playWrongSound();
      logAttempt({ sessionId, mode: 'spellingGame', wordId: current.id, correct: false });
      updateProgress({ wordId: current.id, correct: false });
    }
    
    // 2초 후 다음 문제로 자동 이동
    setTimeout(() => {
      next();
    }, 2000);
  };

  // 다음 문제
  const next = () => {
    if (index + 1 >= questions.length) {
      const finalScore = scoreRef.current;
      const accuracy = Math.round((finalScore / questions.length) * 100);
      const durationSec = Math.round((Date.now() - quizStartTime) / 1000);
      const totalTimeMs = durationSec * 1000;
      
      console.log('철자 게임 완료 - 순위 기록 확인:', {
        score: finalScore,
        total: questions.length,
        accuracy: accuracy,
        questionCount: questionCount || 'infinite'
      });
      
      // 표준: 세션 저장
      saveSession({
        sessionIdHint: sessionId,
        mode: 'spellingGame',
        score: finalScore,
        total: questions.length,
        durationSec
      });
      
      // 표준: 신기록 판정 및 기록 (정확도 100% 조건 제거)
      try {
        const isNewRecordResult = isNewRecord('spellingGame', totalTimeMs, accuracy, questionCount || 'infinite');
        console.log('신기록 여부:', isNewRecordResult);
        if (isNewRecordResult) {
          const record = createRecordFromQuizResult(
            'spellingGame',
            finalScore,
            questions.length,
            quizStartTime,
            Date.now(),
            questionCount || 'infinite'
          );
          addRecord(record);
          setShowNewRecord(true);
          playRecordSound();
          console.log('새로운 기록이 추가되었습니다!');
        } else {
          setShowNewRecord(false);
        }
      } catch (e) {
        console.warn('신기록 처리 중 오류(무시 가능):', e);
      }
      
      setFinished(true);
      
      if (questionCount === null) {
        setQuestions(pickRandom(words, Math.min(words.length, 50)));
        setQuizStartTime(0);
      }
    } else {
      setIndex(prev => prev + 1);
    }
  };

  // 문제 수 선택 화면
  if (questionCount === null && questions.length === 0) {
    return (
      <div className="quiz-container">
        <div className="quiz-header" style={{ textAlign: 'center' }}>
          <h2>🔤 철자 조합 게임</h2>
          <p>섞인 글자를 올바른 순서로 배열하세요!</p>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <h3 style={{ marginBottom: '30px', color: '#333' }}>문제 수를 선택하세요</h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            {[10, 20, 30].map(count => (
              <button
                key={count}
                onClick={() => handleQuestionCountSelect(count)}
                style={{
                  padding: '20px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  border: '3px solid #2196F3',
                  borderRadius: '15px',
                  background: 'linear-gradient(135deg, #E3F2FD, #BBDEFB)',
                  color: '#1976D2',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  minHeight: '80px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(33,150,243,0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {count}문제
              </button>
            ))}
            <button
              onClick={() => handleQuestionCountSelect('infinite')}
              style={{
                padding: '20px',
                fontSize: '18px',
                fontWeight: 'bold',
                border: '3px solid #FF9800',
                borderRadius: '15px',
                background: 'linear-gradient(135deg, #FFF3E0, #FFE0B2)',
                color: '#F57C00',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                minHeight: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gridColumn: 'span 2'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(255,152,0,0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              무제한
            </button>
          </div>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <button onClick={onBack} style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}>
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  // 단어가 없는 경우
  if (words.length === 0) {
    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <h2>단어가 없습니다</h2>
          <p>먼저 단어를 추가해주세요.</p>
        </div>
        <button onClick={onBack}>뒤로 가기</button>
      </div>
    );
  }

  // 퀴즈 완료 화면
  if (finished) {
    const accuracy = Math.round((scoreRef.current / questions.length) * 100);
    const durationSec = Math.round((Date.now() - quizStartTime) / 1000);

    return (
      <div className="quiz-container" style={{ textAlign: 'center', marginTop: 20 }}>
        <h3 style={{ color: '#333', fontSize: '28px', marginBottom: '20px' }}>🎯 퀴즈 결과</h3>

        {showNewRecord && (
          <div className="new-record-notification" style={{
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
          {scoreRef.current} / {questions.length}
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
              {accuracy}%
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
              {durationSec}초
            </div>
          </div>
        </div>

        {/* 코멘트 */}
        <div style={{ 
          backgroundColor: accuracy === 100 ? '#d4edda' : accuracy >= 80 ? '#e2e3e5' : accuracy >= 60 ? '#f8d7da' : '#f5c6cb',
          color: accuracy === 100 ? '#155724' : accuracy >= 80 ? '#383d41' : '#721c24',
          padding: '20px', 
          borderRadius: '12px', 
          margin: '20px 0',
          border: '2px solid #ddd'
        }}>
          {accuracy === 100 ? '🎉 완벽합니다!' : accuracy >= 80 ? '👍 좋은 성과입니다!' : accuracy >= 60 ? '🙂 괜찮습니다!' : '💪 다시 도전해보세요!'}
        </div>

        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setQuestions(pickRandom(words, questionCount || 50));
              setIndex(0);
              setScore(0);
              setFinished(false);
              setQuizStartTime(0);
              setShowNewRecord(false);
            }}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            다시 도전
          </button>
          <button
            onClick={() => {
              setQuestionCount(null);
              setQuestions([]);
              setIndex(0);
              setScore(0);
              setFinished(false);
              setQuizStartTime(0);
              setShowNewRecord(false);
            }}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            새 게임
          </button>
          <button
            onClick={onBack}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            메인으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <div className="quiz-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <button 
          onClick={onBack}
          style={{
            padding: '10px 15px',
            fontSize: '16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          ← 뒤로
        </button>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '20px',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          <div>
            {index + 1}/{questions.length}
            {questionCount && (
              <span style={{ marginLeft: '10px', color: '#666', fontSize: '14px' }}>
                ({questionCount}문제)
              </span>
            )}
          </div>
          <div>
            점수: {score}
          </div>
          <div style={{ 
            color: timeLeft <= 5 ? '#f44336' : timeLeft <= 10 ? '#ff9800' : '#4CAF50'
          }}>
            ⏰ {timeLeft}초
          </div>
        </div>
        
        <div style={{ width: '80px' }}></div> {/* 균형을 위한 빈 공간 */}
      </div>

      {current && (
        <div style={{ textAlign: 'center' }}>
          {/* 힌트 영역 */}
          <div style={{ marginBottom: '30px' }}>
            {current.imageUrl && (
              <img 
                src={current.imageUrl} 
                alt={current.english}
                style={{ 
                  width: '200px', 
                  height: '200px', 
                  objectFit: 'cover',
                  borderRadius: '15px',
                  marginBottom: '15px',
                  border: '3px solid #ddd'
                }}
              />
            )}
          </div>

          {/* 정답 표시 영역 */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ 
              fontSize: '16px', 
              color: '#666', 
              marginBottom: '10px' 
            }}>
              정답:
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              minHeight: '60px',
              alignItems: 'center'
            }}>
              {Array.from({ length: current.english.length }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => userAnswer[i] ? handleAnswerLetterClick(i) : undefined}
                  disabled={isCorrect !== null || !userAnswer[i]}
                  style={{
                    width: '50px',
                    height: '50px',
                    border: '3px solid #ddd',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    backgroundColor: userAnswer[i] ? '#E3F2FD' : '#f8f9fa',
                    color: userAnswer[i] ? '#1976D2' : '#666',
                    cursor: userAnswer[i] && isCorrect === null ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    transform: 'scale(1)'
                  }}
                  onMouseOver={(e) => {
                    if (userAnswer[i] && isCorrect === null) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.backgroundColor = '#FFCDD2';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (userAnswer[i] && isCorrect === null) {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.backgroundColor = '#E3F2FD';
                    }
                  }}
                >
                  {userAnswer[i] || ''}
                </button>
              ))}
            </div>
          </div>

          {/* 확인 버튼 */}
          {userAnswer.length === current.english.length && isCorrect === null && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              marginBottom: '20px' 
            }}>
              <button
                onClick={handleCheckAnswer}
                disabled={userAnswer.length !== current.english.length}
                style={{
                  padding: '15px 30px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: userAnswer.length !== current.english.length ? 'not-allowed' : 'pointer',
                  opacity: userAnswer.length !== current.english.length ? 0.6 : 1,
                  minHeight: '60px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={(e) => {
                  if (userAnswer.length === current.english.length) {
                    e.currentTarget.style.backgroundColor = '#F57C00';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (userAnswer.length === current.english.length) {
                    e.currentTarget.style.backgroundColor = '#FF9800';
                    e.currentTarget.style.transform = 'scale(1)';
                  }
                }}
              >
                ✅ 정답 확인
              </button>
            </div>
          )}

          {/* 섞인 글자들 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              fontSize: '16px', 
              color: '#666', 
              marginBottom: '10px' 
            }}>
              글자를 순서대로 선택하세요:
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              flexWrap: 'wrap'
            }}>
              {shuffledLetters.map((letter, index) => (
                <button
                  key={index}
                  onClick={() => handleLetterClick(index)}
                  disabled={isCorrect !== null || selectedIndices.includes(index)}
                  style={{
                    width: '60px',
                    height: '60px',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    border: '3px solid',
                    borderRadius: '12px',
                    cursor: selectedIndices.includes(index) || isCorrect !== null ? 'not-allowed' : 'pointer',
                    borderColor: selectedIndices.includes(index) ? '#4CAF50' : '#2196F3',
                    backgroundColor: selectedIndices.includes(index) ? '#E8F5E8' : '#ffffff',
                    color: selectedIndices.includes(index) ? '#2E7D32' : '#1976D2',
                    opacity: selectedIndices.includes(index) ? 0.6 : 1,
                    transition: 'all 0.3s ease',
                    transform: selectedIndices.includes(index) ? 'scale(0.9)' : 'scale(1)'
                  }}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>


          {/* 결과 표시 */}
          {isCorrect !== null && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              borderRadius: '10px',
              fontSize: '18px',
              fontWeight: 'bold',
              backgroundColor: isCorrect ? '#E8F5E8' : '#FFEBEE',
              color: isCorrect ? '#2E7D32' : '#C62828',
              border: `3px solid ${isCorrect ? '#4CAF50' : '#f44336'}`
            }}>
              {isCorrect ? (
                <>
                  🎉 정답입니다! <br />
                  <span style={{ fontSize: '16px', fontWeight: 'normal' }}>
                    "{current.english.toUpperCase()}" = {current.korean}
                  </span>
                </>
              ) : (
                <>
                  ❌ 틀렸습니다! <br />
                  <span style={{ fontSize: '16px', fontWeight: 'normal' }}>
                    정답: "{current.english.toUpperCase()}" = {current.korean}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpellingGame;
