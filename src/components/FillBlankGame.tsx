import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Word } from '../types/word';
import { logAttempt, saveSession, updateProgress } from '../services/trackingService';
import { createRecordFromQuizResult, isNewRecord, addRecord } from '../services/rankingService';

interface FillBlankGameProps {
  words: Word[];
  onBack: () => void;
}

interface BlankInfo {
  position: number;
  correctLetter: string;
  userAnswer: string | null;
}

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

// 빈칸 생성 함수
function createBlanks(word: string): BlankInfo[] {
  const wordLength = word.length;
  let blankCount: number;
  
  // 단어 길이에 따른 빈칸 개수 결정
  if (wordLength <= 3) {
    blankCount = 1;
  } else if (wordLength <= 5) {
    blankCount = Math.min(2, Math.floor(wordLength * 0.4));
  } else {
    blankCount = Math.min(3, Math.floor(wordLength * 0.5));
  }
  
  // 랜덤 위치 선택 (첫 글자와 마지막 글자는 제외)
  const possiblePositions = [];
  for (let i = 1; i < wordLength - 1; i++) {
    possiblePositions.push(i);
  }
  
  // 단어가 너무 짧으면 첫 글자나 마지막 글자도 포함
  if (possiblePositions.length < blankCount) {
    for (let i = 0; i < wordLength; i++) {
      if (!possiblePositions.includes(i)) {
        possiblePositions.push(i);
      }
    }
  }
  
  const selectedPositions = pickRandom(possiblePositions, blankCount);
  
  return selectedPositions.map(position => ({
    position,
    correctLetter: word[position].toUpperCase(),
    userAnswer: null
  }));
}

// 잘못된 선택지 생성
function generateWrongOptions(correctLetters: string[], allWords: Word[]): string[] {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const usedInOtherWords = allWords
    .flatMap(word => word.english.toUpperCase().split(''))
    .filter(letter => !correctLetters.includes(letter));
  
  // 중복 제거를 위한 배열 합치기
  const allCandidates = [...usedInOtherWords, ...alphabet];
  const uniqueCandidates: string[] = [];
  
  for (const letter of allCandidates) {
    if (!uniqueCandidates.includes(letter)) {
      uniqueCandidates.push(letter);
    }
  }
  
  return pickRandom(uniqueCandidates.filter(letter => !correctLetters.includes(letter)), 10);
}

const FillBlankGame: React.FC<FillBlankGameProps> = ({ words, onBack }) => {
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
  const [blanks, setBlanks] = useState<BlankInfo[]>([]);
  const [currentBlankIndex, setCurrentBlankIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
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
      console.log('빈칸 게임 정답 사운드 재생 시도 - success.mp3 파일 사용');
      
      const audio = new Audio('/success.mp3');
      audio.volume = 0.7;
      
      audio.play()
        .then(() => {
          console.log('빈칸 게임 정답 사운드 재생 완료 - success.mp3');
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
            
            console.log('빈칸 게임 폴백 정답 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('빈칸 게임 폴백 정답 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('빈칸 게임 정답 사운드 재생 전체 실패:', error);
    }
  }, []);

  const playWrongSound = useCallback(() => {
    try {
      console.log('빈칸 게임 오답 사운드 재생 시도 - wrong.mp3 파일 사용');
      
      const audio = new Audio('/wrong.mp3');
      audio.volume = 0.7;
      
      audio.play()
        .then(() => {
          console.log('빈칸 게임 오답 사운드 재생 완료 - wrong.mp3');
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
            
            console.log('빈칸 게임 폴백 오답 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('빈칸 게임 폴백 오답 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('빈칸 게임 오답 사운드 재생 전체 실패:', error);
    }
  }, []);

  const playRecordSound = useCallback(() => {
    try {
      console.log('빈칸 게임 신기록 사운드 재생 시도 - record.mp3 파일 사용');
      
      const audio = new Audio('/record.mp3');
      audio.volume = 0.8;
      
      audio.play()
        .then(() => {
          console.log('빈칸 게임 신기록 사운드 재생 완료 - record.mp3');
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
            
            console.log('빈칸 게임 폴백 신기록 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('빈칸 게임 폴백 신기록 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('빈칸 게임 신기록 사운드 재생 전체 실패:', error);
    }
  }, []);

  const playCountdownBeep = () => {
    try {
      console.log('빈칸 게임 타이머 사운드 재생 시도 - timer.mp3 파일 사용');
      
      const audio = new Audio('/timer.mp3');
      audio.volume = 0.5;
      
      audio.play()
        .then(() => {
          console.log('빈칸 게임 타이머 사운드 재생 완료 - timer.mp3');
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
            
            console.log('빈칸 게임 폴백 타이머 사운드 재생 완료');
          } catch (fallbackError) {
            console.error('빈칸 게임 폴백 타이머 사운드도 실패:', fallbackError);
          }
        });
    } catch (error) {
      console.error('빈칸 게임 타이머 사운드 재생 전체 실패:', error);
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
      const newBlanks = createBlanks(current.english);
      setBlanks(newBlanks);
      setCurrentBlankIndex(0);
      setIsCorrect(null);
      
      // 선택지 생성 (현재 빈칸의 정답만 포함)
      const currentCorrectLetter = newBlanks[0].correctLetter; // 첫 번째 빈칸의 정답
      const allCorrectLetters = newBlanks.map(blank => blank.correctLetter);
      const wrongOptions = generateWrongOptions(allCorrectLetters, words);
      
      // 현재 빈칸의 정답 + 3개의 오답 선택지
      const selectedWrongOptions = wrongOptions.slice(0, NUM_OPTIONS - 1);
      const allOptions = [currentCorrectLetter, ...selectedWrongOptions];
      setOptions(shuffleArray(allOptions));
      
      // 단어 길이에 따른 시간 설정
      const baseTime = Math.max(15, current.english.length * 2 + newBlanks.length * 5);
      setTimeLeft(baseTime);
    }
  }, [current, questions.length, words]);

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
            logAttempt({ sessionId, mode: 'fillBlankGame', wordId: current.id, correct: false });
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

  // 선택지 클릭
  const handleOptionClick = (letter: string) => {
    if (isCorrect !== null || currentBlankIndex >= blanks.length) return;
    
    const currentBlank = blanks[currentBlankIndex];
    const newBlanks = [...blanks];
    newBlanks[currentBlankIndex] = { ...currentBlank, userAnswer: letter };
    setBlanks(newBlanks);
    
    // 다음 빈칸으로 이동 또는 정답 확인
    if (currentBlankIndex + 1 >= blanks.length) {
      // 모든 빈칸을 채웠으면 정답 확인
      checkAnswer(newBlanks);
    } else {
      const nextBlankIndex = currentBlankIndex + 1;
      setCurrentBlankIndex(nextBlankIndex);
      
      // 다음 빈칸의 선택지 생성
      const nextCorrectLetter = newBlanks[nextBlankIndex].correctLetter;
      const allCorrectLetters = newBlanks.map(blank => blank.correctLetter);
      const wrongOptions = generateWrongOptions(allCorrectLetters, words);
      
      // 다음 빈칸의 정답 + 3개의 오답 선택지
      const selectedWrongOptions = wrongOptions.slice(0, NUM_OPTIONS - 1);
      const allOptions = [nextCorrectLetter, ...selectedWrongOptions];
      setOptions(shuffleArray(allOptions));
    }
  };

  // 정답 확인
  const checkAnswer = (filledBlanks: BlankInfo[]) => {
    const allCorrect = filledBlanks.every(blank => 
      blank.userAnswer === blank.correctLetter
    );
    
    setIsCorrect(allCorrect);
    
    if (allCorrect) {
      playCorrectSound();
      setScore(prev => prev + 1);
      logAttempt({ sessionId, mode: 'fillBlankGame', wordId: current!.id, correct: true });
      updateProgress({ wordId: current!.id, correct: true });
    } else {
      playWrongSound();
      logAttempt({ sessionId, mode: 'fillBlankGame', wordId: current!.id, correct: false });
      updateProgress({ wordId: current!.id, correct: false });
    }
    
    if (autoNextTimeoutRef.current !== null) {
      clearTimeout(autoNextTimeoutRef.current);
    }
    autoNextTimeoutRef.current = window.setTimeout(() => {
      autoNextTimeoutRef.current = null;
      next();
    }, AUTO_NEXT_DELAY_MS);
  };

  // 다음 문제
  const next = () => {
    if (index + 1 >= questions.length) {
      const finalScore = scoreRef.current;
      const accuracy = Math.round((finalScore / questions.length) * 100);
      const durationSec = Math.round((Date.now() - quizStartTime) / 1000);
      
      console.log('빈칸 게임 완료 - 순위 기록 확인:', {
        score: finalScore,
        total: questions.length,
        accuracy: accuracy,
        questionCount: questionCount || 'infinite'
      });
      
      if (accuracy === 100) {
        const record = createRecordFromQuizResult(
          'fillBlankGame',
          finalScore,
          questions.length,
          quizStartTime,
          Date.now(),
          questionCount || 'infinite'
        );
        
        const isNewRecordResult = isNewRecord('fillBlankGame', accuracy, durationSec, questionCount || 'infinite');
        console.log('신기록 여부:', isNewRecordResult);
        
        if (isNewRecordResult) {
          addRecord(record);
          setShowNewRecord(true);
          playRecordSound();
          console.log('새로운 기록이 추가되었습니다!');
        }
      }
      
      saveSession({
        sessionIdHint: sessionId,
        mode: 'fillBlankGame',
        score: finalScore,
        total: questions.length,
        durationSec
      });
      
      setFinished(true);
      
      if (questionCount === null) {
        setQuestions(pickRandom(words, Math.min(words.length, 50)));
        setQuizStartTime(0);
      }
    } else {
      setIndex(prev => prev + 1);
    }
  };

  // 단어를 빈칸과 함께 렌더링
  const renderWordWithBlanks = () => {
    if (!current) return null;
    
    const wordArray = current.english.toUpperCase().split('');
    const blankPositions = blanks.map(blank => blank.position);
    
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        marginBottom: '30px'
      }}>
        {wordArray.map((letter, index) => {
          const blankIndex = blankPositions.indexOf(index);
          const isBlank = blankIndex !== -1;
          const isCurrentBlank = isBlank && blankIndex === currentBlankIndex && isCorrect === null;
          
          if (isBlank) {
            const blank = blanks[blankIndex];
            return (
              <div
                key={index}
                style={{
                  width: '50px',
                  height: '50px',
                  border: `3px solid ${isCurrentBlank ? '#FF9800' : '#2196F3'}`,
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  backgroundColor: isCurrentBlank ? '#FFF3E0' : (blank.userAnswer ? '#E3F2FD' : '#ffffff'),
                  color: blank.userAnswer ? '#1976D2' : '#666',
                  animation: isCurrentBlank ? 'pulse 1s infinite' : 'none'
                }}
              >
                {blank.userAnswer || ''}
              </div>
            );
          } else {
            return (
              <div
                key={index}
                style={{
                  width: '50px',
                  height: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#333'
                }}
              >
                {letter}
              </div>
            );
          }
        })}
      </div>
    );
  };

  // 문제 수 선택 화면
  if (questionCount === null && questions.length === 0) {
    return (
      <div className="quiz-container">
        <div className="quiz-header" style={{ textAlign: 'center' }}>
          <h2>📝 빈칸 채우기 게임</h2>
          <p>빈칸에 들어갈 올바른 글자를 선택하세요!</p>
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
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    
    let comment = '';
    if (accuracy === 100) comment = '🎉 완벽합니다!';
    else if (accuracy >= 90) comment = '😊 훌륭해요!';
    else if (accuracy >= 80) comment = '👍 잘했어요!';
    else if (accuracy >= 70) comment = '🙂 괜찮아요!';
    else if (accuracy >= 60) comment = '😐 더 노력해요!';
    else comment = '😅 다시 도전해보세요!';

    return (
      <div className="quiz-container">
        {showNewRecord && (
          <div className="new-record-notification" style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            color: '#333',
            padding: '15px 30px',
            borderRadius: '25px',
            fontSize: '18px',
            fontWeight: 'bold',
            zIndex: 1000,
            boxShadow: '0 8px 25px rgba(255,215,0,0.4)',
            animation: 'pulse 2s infinite'
          }}>
            🏆 새로운 기록 달성! 🏆
          </div>
        )}
        
        <div className="quiz-header">
          <h2>📝 빈칸 채우기 게임 완료!</h2>
          <div style={{ 
            fontSize: '48px', 
            margin: '20px 0',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 'bold'
          }}>
            {scoreRef.current}/{questions.length}
          </div>
          <div style={{ 
            fontSize: '24px', 
            color: accuracy >= 80 ? '#4CAF50' : accuracy >= 60 ? '#FF9800' : '#f44336',
            fontWeight: 'bold',
            marginBottom: '10px'
          }}>
            정답률: {accuracy}%
          </div>
          <div style={{ 
            fontSize: '18px', 
            color: '#666',
            marginBottom: '15px'
          }}>
            소요 시간: {minutes > 0 ? `${minutes}분 ` : ''}{seconds}초
          </div>
          <div style={{ 
            fontSize: '20px', 
            fontWeight: 'bold',
            color: '#333',
            marginBottom: '30px'
          }}>
            {comment}
          </div>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
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
              marginRight: '15px',
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
              marginRight: '15px',
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

          {/* 단어 표시 (빈칸 포함) */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ 
              fontSize: '16px', 
              color: '#666', 
              marginBottom: '10px' 
            }}>
              빈칸을 채워 단어를 완성하세요:
            </div>
            {renderWordWithBlanks()}
          </div>

          {/* 현재 빈칸 안내 */}
          {isCorrect === null && currentBlankIndex < blanks.length && (
            <div style={{ 
              fontSize: '18px', 
              color: '#FF9800', 
              fontWeight: 'bold',
              marginBottom: '20px'
            }}>
              {currentBlankIndex + 1}번째 빈칸을 채우세요
            </div>
          )}

          {/* 선택지 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              fontSize: '16px', 
              color: '#666', 
              marginBottom: '10px' 
            }}>
              선택지:
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '15px',
              flexWrap: 'wrap'
            }}>
              {options.map((letter, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionClick(letter)}
                  disabled={isCorrect !== null}
                  style={{
                    width: '60px',
                    height: '60px',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    border: '3px solid #2196F3',
                    borderRadius: '12px',
                    backgroundColor: '#ffffff',
                    color: '#1976D2',
                    cursor: isCorrect !== null ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease',
                    opacity: isCorrect !== null ? 0.5 : 1
                  }}
                  onMouseOver={(e) => {
                    if (isCorrect === null) {
                      e.currentTarget.style.backgroundColor = '#E3F2FD';
                      e.currentTarget.style.transform = 'scale(1.05)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (isCorrect === null) {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.transform = 'scale(1)';
                    }
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
                    "{current.english.toUpperCase()}"
                  </span>
                </>
              ) : (
                <>
                  ❌ 틀렸습니다! <br />
                  <span style={{ fontSize: '16px', fontWeight: 'normal' }}>
                    정답: "{current.english.toUpperCase()}"
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

export default FillBlankGame;
