import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWords } from '../contexts/WordsContext';
import { SentenceProblemService } from '../services/sentenceProblemService';
import { SentenceProblem } from '../types/word';
import { logAttempt, saveSession } from '../services/trackingService';
import { createRecordFromQuizResult, isNewRecord, addRecord } from '../services/rankingService';

type DifficultyLevel = 'easy' | 'medium' | 'hard';
type Mode = 'sentenceGame';

const SentenceGame: React.FC = () => {
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { words } = useWords();
  const [gameKey, setGameKey] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [userBlanks, setUserBlanks] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showNewRecord, setShowNewRecord] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [sentenceProblems, setSentenceProblems] = useState<SentenceProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [difficulty, setDifficulty] = useState<DifficultyLevel | null>(null);
  const [questionCount, setQuestionCount] = useState<number | null | 'infinite'>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const sessionIdRef = useRef<string>('');
  const startTimeRef = useRef<number>(0);

  const onBack = useCallback(() => {
    navigate('/game');
  }, [navigate]);

  useEffect(() => {
    sessionIdRef.current = `sentence_game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    startTimeRef.current = Date.now();
  }, [gameKey]);

  useEffect(() => {
    const loadSentenceProblems = async () => {
      try {
        setLoading(true);
        setError(null);
        const problems = await SentenceProblemService.fetchAllProblems();

        const isSampleData = problems.length > 0 && problems.every(p => p.id.startsWith('sample_'));

        if (problems.length === 0) {
          setError('문장 문제 데이터를 찾을 수 없습니다.');
        } else if (isSampleData) {
          setShowSetupGuide(true);
          setSentenceProblems(problems);
        } else {
          setSentenceProblems(problems);
        }
      } catch (err) {
        console.error('Error loading sentence problems:', err);
        setError('문장 문제를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadSentenceProblems();
  }, []);

  const speakWord = useCallback((word: string) => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch (e) {
      console.error('Speech error:', e);
    }
  }, []);

  const filteredProblems = useMemo(() => {
    if (!sentenceProblems || sentenceProblems.length === 0) return [];
    const shuffled = [...sentenceProblems].sort(() => Math.random() - 0.5);
    return shuffled;
  }, [sentenceProblems]);

  const totalQuestions = questionCount === 'infinite' ? filteredProblems.length : (questionCount || filteredProblems.length);
  const current = filteredProblems[currentIndex];

  const next = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= totalQuestions) {
      if (questionCount === 'infinite') {
        setGameKey(prev => prev + 1);
        setCurrentIndex(0);
        setUserBlanks([]);
        setIsCorrect(null);
        setQuizStartTime(Date.now());
      } else {
        setFinished(true);
        const endTime = Date.now();
        const durationSec = Math.round((endTime - startTimeRef.current) / 1000);

        saveSession({
          mode: 'sentenceGame' as Mode,
          score,
          total: typeof totalQuestions === 'number' ? totalQuestions : 0,
          durationSec
        });

        (async () => {
          try {
            const totalTimeMs = durationSec * 1000;
            const accuracy = Math.round(((typeof totalQuestions === 'number' && totalQuestions > 0 ? score / totalQuestions : 0) * 100));
            // 100% 정답률이면 무조건 기록 저장 (신기록 여부와 관계없이)
            if (accuracy === 100) {
              const record = createRecordFromQuizResult(
                'sentenceGame',
                score,
                typeof totalQuestions === 'number' ? totalQuestions : 0,
                startTimeRef.current,
                endTime,
                questionCount || 'infinite'
              );
              const success = await addRecord(record);
              if (success) {
                // 신기록인지 확인하여 UI 피드백
                const isNew = await isNewRecord('sentenceGame', totalTimeMs, accuracy, questionCount || 'infinite');
                if (isNew) {
                  setShowNewRecord(true);
                } else {
                  setShowNewRecord(false);
                }
              }
            } else {
              setShowNewRecord(false);
            }
          } catch (e) {
            console.warn('Ranking error:', e);
          }
        })();
      }
    } else {
      setCurrentIndex(nextIndex);
      setUserBlanks([]);
      setIsCorrect(null);
      setShowNewRecord(false);
    }
  }, [currentIndex, totalQuestions, score, questionCount]);

  const gameSetup = useMemo(() => {
    if (!current || !current.targetWords) return null;

    const englishWords = current.englishSentence
      .replace(/[.,!?;:]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);

    const preFilledWords = ['a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must'];

    const correctOrder: string[] = [];
    const remainingWords = [...current.targetWords];

    for (const englishWord of englishWords) {
      const matchingIndex = remainingWords.findIndex(word =>
        word.toLowerCase() === englishWord.toLowerCase()
      );

      if (matchingIndex !== -1) {
        correctOrder.push(remainingWords[matchingIndex]);
        remainingWords.splice(matchingIndex, 1);
      } else {
        correctOrder.push(englishWord);
      }
    }
    correctOrder.push(...remainingWords);

    const alwaysPreFilledWords: string[] = [];
    const potentialBlankWords: string[] = [];

    correctOrder.forEach(word => {
      if (preFilledWords.includes(word.toLowerCase())) {
        alwaysPreFilledWords.push(word);
      } else {
        potentialBlankWords.push(word);
      }
    });

    let targetBlankCount: number;
    if (difficulty === 'easy') {
      targetBlankCount = Math.min(2, potentialBlankWords.length);
    } else if (difficulty === 'medium') {
      targetBlankCount = Math.min(3, potentialBlankWords.length);
    } else {
      targetBlankCount = potentialBlankWords.length;
    }

    const shuffledPotentialWords = [...potentialBlankWords].sort(() => Math.random() - 0.5);
    const blankWords = shuffledPotentialWords.slice(0, targetBlankCount);
    const additionalPreFilledWords = shuffledPotentialWords.slice(targetBlankCount);
    const finalPreFilledWords = [...alwaysPreFilledWords, ...additionalPreFilledWords];
    const shuffledWords = [...blankWords].sort(() => Math.random() - 0.5);

    return {
      correctOrder,
      articleWords: finalPreFilledWords,
      nonArticleWords: blankWords,
      shuffledWords
    };
  }, [current, difficulty]);

  const checkAnswer = useCallback((answer: string[]) => {
    if (!gameSetup) return;

    let isAnswerCorrect = true;
    let nonArticleCount = 0;

    for (let i = 0; i < gameSetup.correctOrder.length; i++) {
      const word = gameSetup.correctOrder[i];

      if (!gameSetup.articleWords.includes(word)) {
        if (nonArticleCount < answer.length) {
          const userWord = answer[nonArticleCount];
          if (userWord.toLowerCase() !== word.toLowerCase()) {
            isAnswerCorrect = false;
            break;
          }
        } else {
          isAnswerCorrect = false;
          break;
        }
        nonArticleCount++;
      }
    }

    if (isAnswerCorrect && nonArticleCount !== gameSetup.nonArticleWords.length) {
      isAnswerCorrect = false;
    }

    setIsCorrect(isAnswerCorrect);

    if (isAnswerCorrect) {
      setScore(prev => prev + 1);
    }

    logAttempt({
      sessionId: sessionIdRef.current,
      mode: 'sentenceGame' as Mode,
      wordId: current?.id || 'unknown',
      correct: isAnswerCorrect
    });

    setTimeout(() => {
      next();
    }, 2000);
  }, [current, next, gameSetup]);

  const handleWordClick = useCallback((word: string) => {
    if (finished || isCorrect !== null || !gameSetup) return;
    speakWord(word);
    const newBlanks = [...userBlanks, word];
    setUserBlanks(newBlanks);
  }, [finished, isCorrect, userBlanks, speakWord, gameSetup]);

  const handleAnswerWordClick = useCallback((index: number) => {
    if (finished || isCorrect !== null) return;
    const wordToRemove = userBlanks[index];
    speakWord(wordToRemove);
    const newBlanks = userBlanks.filter((_, i) => i !== index);
    setUserBlanks(newBlanks);
  }, [finished, isCorrect, userBlanks, speakWord]);

  const handleCheckAnswer = useCallback(() => {
    if (!gameSetup || finished || isCorrect !== null) return;

    let isAnswerCorrect = true;
    let nonArticleCount = 0;

    for (let i = 0; i < gameSetup.correctOrder.length; i++) {
      const word = gameSetup.correctOrder[i];
      if (!gameSetup.articleWords.includes(word)) {
        if (nonArticleCount < userBlanks.length) {
          const userWord = userBlanks[nonArticleCount];
          if (userWord.toLowerCase() !== word.toLowerCase()) {
            isAnswerCorrect = false;
            break;
          }
        } else {
          isAnswerCorrect = false;
          break;
        }
        nonArticleCount++;
      }
    }

    if (isAnswerCorrect && nonArticleCount !== gameSetup.nonArticleWords.length) {
      isAnswerCorrect = false;
    }

    let sentenceToRead: string;
    if (isAnswerCorrect) {
      const fullSentence: string[] = [];
      let nonArticleCount = 0;
      gameSetup.correctOrder.forEach(word => {
        if (gameSetup.articleWords.includes(word)) {
          fullSentence.push(word);
        } else {
          if (nonArticleCount < userBlanks.length) {
            fullSentence.push(userBlanks[nonArticleCount]);
          }
          nonArticleCount++;
        }
      });
      sentenceToRead = fullSentence.join(' ');
    } else {
      sentenceToRead = gameSetup.correctOrder.join(' ');
    }

    speakWord(sentenceToRead);
    checkAnswer(userBlanks);
  }, [finished, isCorrect, userBlanks, checkAnswer, speakWord, gameSetup]);

  const startGame = (count: number | null | 'infinite') => {
    setQuestionCount(count);
    setGameStarted(true);
    setCurrentIndex(0);
    setScore(0);
    setFinished(false);
    setUserBlanks([]);
    setIsCorrect(null);
    setShowNewRecord(false);
    setQuizStartTime(Date.now());
  };

  const startGameWithDifficulty = (selectedDifficulty: DifficultyLevel, count: number | null | 'infinite') => {
    setDifficulty(selectedDifficulty);
    startGame(count);
  };

  const resetAll = () => {
    setGameKey(prev => prev + 1);
    setQuestionCount(null);
    setGameStarted(false);
    setCurrentIndex(0);
    setScore(0);
    setFinished(false);
    setUserBlanks([]);
    setIsCorrect(null);
    setShowNewRecord(false);
    setDifficulty(null);
  };

  if (!sentenceProblems || sentenceProblems.length === 0) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2 className="card-title">📖 영어 문장 만들기</h2>
          <p style={{ marginBottom: 24, color: 'var(--color-slate)' }}>문장 문제가 없습니다. 관리자에게 문의하여 데이터를 추가해주세요.</p>
          <button className="btn btn-primary" onClick={onBack}>메인으로</button>
        </div>
      </div>
    );
  }

  if (!difficulty) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 500 }}>
          <h2 className="card-title">난이도 선택</h2>
          <p className="card-subtitle" style={{ marginBottom: 24 }}>도전할 난이도를 선택하세요</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="btn btn-primary" onClick={() => setDifficulty('easy')}>🟢 쉬움 (Easy)</button>
            <button className="btn btn-secondary" onClick={() => setDifficulty('medium')}>🟡 보통 (Medium)</button>
            <button className="btn btn-danger" onClick={() => setDifficulty('hard')}>🔴 어려움 (Hard)</button>
          </div>
          <button className="btn btn-outline" onClick={onBack} style={{ marginTop: 24 }}>뒤로가기</button>
        </div>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 500 }}>
          <h2 className="card-title">문제 수 선택</h2>
          <p className="card-subtitle" style={{ marginBottom: 24 }}>풀고 싶은 문제 수를 선택하세요</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button className="btn btn-outline" onClick={() => startGameWithDifficulty(difficulty, 10)}>10문제</button>
            <button className="btn btn-outline" onClick={() => startGameWithDifficulty(difficulty, 20)}>20문제</button>
            <button className="btn btn-outline" onClick={() => startGameWithDifficulty(difficulty, 30)}>30문제</button>
            <button className="btn btn-outline" onClick={() => startGameWithDifficulty(difficulty, null)}>전체</button>
          </div>
          <button className="btn btn-secondary" onClick={() => startGameWithDifficulty(difficulty, 'infinite' as any)} style={{ marginTop: 12, width: '100%' }}>무제한 모드</button>
          <button className="btn btn-outline" onClick={onBack} style={{ marginTop: 24 }}>뒤로가기</button>
        </div>
      </div>
    );
  }

  if (finished) {
    const accuracy = Math.round((score / (typeof totalQuestions === 'number' ? totalQuestions : 1)) * 100);
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
          <h2 className="card-title">🎉 퀴즈 완료!</h2>
          {showNewRecord && <div style={{ color: 'var(--color-accent)', fontWeight: 800, marginBottom: 16 }}>🏆 신기록 달성!</div>}

          <div className="stats-grid" style={{ marginTop: 24 }}>
            <div className="stat-item">
              <div className="stat-value">{score}</div>
              <div className="stat-label">점수</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{accuracy}%</div>
              <div className="stat-label">정답률</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button className="btn btn-primary" onClick={resetAll} style={{ flex: 1 }}>다시 하기</button>
            <button className="btn btn-outline" onClick={onBack} style={{ flex: 1 }}>메인으로</button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return <div>Loading...</div>;

  const progress = totalQuestions ? ((currentIndex) / totalQuestions) * 100 : 0;

  return (
    <div className="app-container">
      <div className="app-main">
        {/* Header */}
        <header className="game-header">
          <button className="close-btn" onClick={onBack}>✕</button>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <div style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{score}</div>
        </header>

        {/* Question Area */}
        <div className="question-area">
          <h2 className="question-text">{current.koreanSentence}</h2>
        </div>

        {/* Answer Area */}
        <div className="answer-area">
          {gameSetup?.correctOrder.map((word, index) => {
            const isPreFilled = gameSetup.articleWords.includes(word);
            if (isPreFilled) {
              return (
                <div 
                  key={`pre-${index}`} 
                  className="word-chip" 
                  style={{ 
                    cursor: 'default',
                    backgroundColor: 'var(--color-ash)',
                    color: 'var(--color-ink)',
                    borderStyle: 'dashed'
                  }}
                >
                  {word}
                </div>
              );
            }

            let nonArticleIndex = -1;
            let count = 0;
            for (let i = 0; i <= index; i++) {
              if (!gameSetup.articleWords.includes(gameSetup.correctOrder[i])) {
                if (i === index) nonArticleIndex = count;
                count++;
              }
            }

            const isFilled = nonArticleIndex >= 0 && nonArticleIndex < userBlanks.length;
            const userWord = isFilled ? userBlanks[nonArticleIndex] : null;

            if (isFilled && userWord) {
              return (
                <button key={`filled-${index}`} className="word-chip" onClick={() => handleAnswerWordClick(nonArticleIndex)} style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-shadow)', borderColor: 'var(--color-primary)' }}>
                  {userWord}
                </button>
              );
            }
            return <div key={`empty-${index}`} style={{ width: 60, height: 50, borderBottom: '2px solid var(--color-ash)', margin: '0 4px' }}></div>;
          })}
        </div>

        {/* Word Bank */}
        <div className="word-bank">
          {gameSetup?.shuffledWords.map((word, index) => {
            const isUsed = userBlanks.includes(word);
            return (
              <button
                key={index}
                className={`word-chip ${isUsed ? 'selected' : ''}`}
                onClick={() => handleWordClick(word)}
                disabled={finished || isCorrect !== null || isUsed}
              >
                {word}
              </button>
            );
          })}
        </div>

        {/* Check Button */}
        {gameSetup && userBlanks.length === gameSetup.nonArticleWords.length && isCorrect === null && (
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <button className="btn btn-primary" onClick={handleCheckAnswer} style={{ width: '100%', maxWidth: 300 }}>
              확인하기
            </button>
          </div>
        )}

        {/* Feedback Overlay */}
        {isCorrect !== null && (
          <div className={`feedback-overlay ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`}>
            <div className="feedback-content" style={{ justifyContent: 'center' }}>
              <div className="feedback-message">
                {isCorrect ? '정답입니다! 🎉' : '아쉽네요! 다시 도전해보세요.'}
                {!isCorrect && <div style={{ fontSize: 18, marginTop: 8, fontWeight: 600 }}>정답: {gameSetup?.correctOrder.join(' ')}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SentenceGame;