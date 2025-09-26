import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SentenceProblem, Word } from '../types/word';
import { SentenceProblemService } from '../services/sentenceProblemService';
import { logAttempt, saveSession, Mode } from '../services/trackingService';
import { getAllRankings } from '../services/rankingService';
import SupabaseSetupGuide from './SupabaseSetupGuide';
import SupabaseDiagnostic from './SupabaseDiagnostic';

interface SentenceGameProps {
  words: Word[];
  onBack: () => void;
}

const SentenceGame: React.FC<SentenceGameProps> = ({ words, onBack }) => {
  // 게임 상태
  const [gameKey, setGameKey] = useState(0);
  const [questionCount, setQuestionCount] = useState<number | null | 'infinite'>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
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
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const sessionIdRef = useRef<string>('');
  const startTimeRef = useRef<number>(0);

  // 세션 ID 생성
  useEffect(() => {
    sessionIdRef.current = `sentence_game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    startTimeRef.current = Date.now();
  }, [gameKey]);

  // Supabase에서 문장 문제 데이터 로드
  useEffect(() => {
    const loadSentenceProblems = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🔍 Supabase에서 문장 문제 데이터 로드 시작...');
        
        const problems = await SentenceProblemService.fetchAllProblems();
        console.log('✅ 로드된 문장 문제 수:', problems.length);
        console.log('🔍 로드된 문제들:', problems);
        
        if (problems.length > 0) {
          console.log('📝 첫 번째 문제 상세:', problems[0]);
          console.log('📝 첫 번째 문제의 targetWords:', problems[0].targetWords);
          console.log('📝 첫 번째 문제의 targetWords 타입:', typeof problems[0].targetWords);
        }
        
        // 샘플 데이터인지 확인 (테이블이 없을 때 반환되는 샘플 데이터)
        const isSampleData = problems.length > 0 && problems.every(p => p.id.startsWith('sample_'));
        
        if (problems.length === 0) {
          setError('문장 문제 데이터를 찾을 수 없습니다. 관리자에게 문의하거나 데이터를 추가해주세요.');
        } else if (isSampleData) {
          // 테이블이 없어서 샘플 데이터를 사용하는 경우
          setShowSetupGuide(true);
          setSentenceProblems(problems); // 샘플 데이터로 게임은 가능하게 함
    } else {
          setSentenceProblems(problems);
        }
      } catch (err) {
        console.error('❌ 문장 문제 로드 실패:', err);
        setError('문장 문제를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadSentenceProblems();
  }, []);

  // TTS 발음 함수 (사용자 설정 적용)
  const speakWord = useCallback((word: string) => {
    if (!("speechSynthesis" in window)) {
      alert('이 브라우저에서는 음성 합성이 지원되지 않습니다.');
      return;
    }
    try {
      console.log('speakWord 호출:', word);
      
      // 이전 음성을 확실히 취소 (여러 번 시도)
      window.speechSynthesis.cancel();
      
      // 잠시 후 한 번 더 취소 (브라우저에 따라 즉시 취소되지 않을 수 있음)
      setTimeout(() => {
        window.speechSynthesis.cancel();
      }, 50);
      
      // 취소 후 충분한 지연을 두고 새 음성 재생
      setTimeout(() => {
        // 음성 목록을 다시 로드
        const loadVoices = () => {
          return new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              resolve(voices);
            } else {
              window.speechSynthesis.onvoiceschanged = () => {
                resolve(window.speechSynthesis.getVoices());
              };
              setTimeout(() => resolve([]), 1000);
            }
          });
        };

        // 전역 TTS 설정 읽기
        let rate = 1.0 as number;
        let gender: 'default' | 'male' | 'female' = 'default';
        let accent: 'us' | 'uk' = 'us';
        try {
          const raw = localStorage.getItem('ttsSettings');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed.rate === 'number') rate = parsed.rate;
            if (parsed.gender === 'male' || parsed.gender === 'female' || parsed.gender === 'default') gender = parsed.gender;
            if (parsed.accent === 'us' || parsed.accent === 'uk') accent = parsed.accent;
          }
        } catch {}

        loadVoices().then(voices => {
          const utterance = new SpeechSynthesisUtterance(word);
          utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
          utterance.rate = rate;
          utterance.pitch = gender === 'male' ? 0.8 : gender === 'female' ? 1.3 : 1.0;
          
          console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang, localService: v.localService })));
          
          if (voices.length > 0) {
            const preferLang = accent === 'uk' ? 'en-GB' : 'en-US';
            
            let candidates = voices.filter(v => v.lang?.toLowerCase() === preferLang.toLowerCase());
            if (candidates.length === 0) {
              const langCode = preferLang.split('-')[0].toLowerCase();
              candidates = voices.filter(v => v.lang?.toLowerCase().startsWith(langCode));
            }
            if (candidates.length === 0) {
              candidates = voices.filter(v => v.lang?.toLowerCase().includes('en'));
            }
            
            let selectedVoice = null;
            if (candidates.length > 0) {
              if (gender === 'female') {
                selectedVoice = candidates.find(v => 
                  /female|woman|amy|emma|olivia|salli|joanna|ivy|kimberly|kendra|zira|susan/i.test(v.name)
                ) || candidates[0];
              } else if (gender === 'male') {
                selectedVoice = candidates.find(v => 
                  /male|man|brian|daniel|arthur|matthew|justin|joey|david|mark|alex/i.test(v.name)
                ) || candidates[0];
              } else {
                selectedVoice = candidates[0];
              }
            }
            
            if (selectedVoice) {
              utterance.voice = selectedVoice;
              console.log('Selected voice:', selectedVoice.name, selectedVoice.lang);
            }
          }
          
          window.speechSynthesis.speak(utterance);
        }).catch(() => {
          const utterance = new SpeechSynthesisUtterance(word);
          utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
          utterance.rate = rate;
          utterance.pitch = gender === 'male' ? 0.8 : gender === 'female' ? 1.3 : 1.0;
          window.speechSynthesis.speak(utterance);
        });
      }, 250); // 취소 후 250ms 지연 (더 안전하게)
    } catch (e) {
      console.error('발음 재생 오류:', e);
    }
  }, []);

  // 현재 문제 - 다양한 문장 유형을 위해 필터링된 문장들 사용
  const filteredProblems = useMemo(() => {
    if (!sentenceProblems || sentenceProblems.length === 0) return [];
    
    // don't가 포함된 문장과 그렇지 않은 문장을 분리
    const dontSentences = sentenceProblems.filter(p => 
      p.targetWords.some(word => word.toLowerCase() === "don't")
    );
    const otherSentences = sentenceProblems.filter(p => 
      !p.targetWords.some(word => word.toLowerCase() === "don't")
    );
    
    console.log('📊 문장 유형 분류:');
    console.log('- don\'t 포함 문장:', dontSentences.length);
    console.log('- 기타 문장:', otherSentences.length);
    
    // 두 그룹을 번갈아가며 섞기
    const mixedProblems = [];
    const maxLength = Math.max(dontSentences.length, otherSentences.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (i < otherSentences.length) {
        mixedProblems.push(otherSentences[i]);
      }
      if (i < dontSentences.length) {
        mixedProblems.push(dontSentences[i]);
      }
    }
    
    // 랜덤하게 섞기
    const shuffledProblems = [...mixedProblems];
    for (let i = shuffledProblems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledProblems[i], shuffledProblems[j]] = [shuffledProblems[j], shuffledProblems[i]];
    }
    
    console.log('🎯 랜덤 섞인 문장들:', shuffledProblems.map(p => p.englishSentence));
    return shuffledProblems;
  }, [sentenceProblems, gameKey]);
  
  const totalQuestions = questionCount === 'infinite' ? (filteredProblems?.length || 0) : (questionCount || (filteredProblems?.length || 0));
  const current = filteredProblems?.[currentIndex];
  
  // 디버깅용 로그
  console.log('🎮 현재 게임 상태:');
  console.log('- sentenceProblems 길이:', sentenceProblems?.length);
  console.log('- filteredProblems 길이:', filteredProblems?.length);
  console.log('- currentIndex:', currentIndex);
  console.log('- current 문제:', current);
  console.log('- totalQuestions:', totalQuestions);

  // 사운드 재생 함수들
  const playCorrectSound = useCallback(() => {
    try {
      const audio = new Audio('/success.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('사운드 재생 실패:', e));
    } catch (error) {
      console.error('사운드 재생 오류:', error);
    }
  }, []);

  const playWrongSound = useCallback(() => {
    try {
      const audio = new Audio('/wrong.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('사운드 재생 실패:', e));
    } catch (error) {
      console.error('사운드 재생 오류:', error);
    }
  }, []);


  // 다음 문제로 진행
  const next = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= totalQuestions) {
      if (questionCount === 'infinite') {
        // 무제한 모드: 새로운 랜덤 순서로 다시 시작
        setGameKey(prev => prev + 1); // 새로운 랜덤 순서 생성
        setCurrentIndex(0);
        setUserBlanks([]);
        setIsCorrect(null);
        setQuizStartTime(Date.now()); // 새로운 세션 시작 시간 기록
        console.log('🔄 무제한 모드: 새로운 랜덤 순서로 재시작');
      } else {
        // 게임 완료
        setFinished(true);
        
        // 세션 저장 및 순위 확인
        const endTime = Date.now();
        const durationSec = Math.round((endTime - startTimeRef.current) / 1000);
        
        saveSession({
          mode: 'sentenceGame' as Mode,
          score,
          total: typeof totalQuestions === 'number' ? totalQuestions : 0,
          durationSec
        });

        // 순위 확인 (sentenceGame 관련 순위만)
        const ranking = getAllRankings().find(r => r.quizType === 'sentenceGame');
        const records = ranking?.records || [];
        const isNewRecord = records.length < 10 || score > records[records.length - 1].score;
        if (isNewRecord) {
          setShowNewRecord(true);
        }
      }
    } else {
      // 다음 문제로
      setCurrentIndex(nextIndex);
      setUserBlanks([]);
      setIsCorrect(null);
      setShowNewRecord(false);
    }
  }, [currentIndex, totalQuestions, score]);

  // 정답 체크 함수 (순차적 답안용)
  const checkAnswer = useCallback((answer: string[]) => {
    if (!gameSetup) return;

    console.log('🔍 정답 체크 시작 (순차적):');
    console.log('- 사용자 답안:', answer);
    console.log('- 정답 순서 (비관사):', gameSetup.nonArticleWords);
    
    // 순차적으로 채운 답안을 정답과 비교
    const isAnswerCorrect = answer.length === gameSetup.nonArticleWords.length && 
      answer.every((word, index) => word.toLowerCase() === gameSetup.nonArticleWords[index].toLowerCase());
    
    console.log('- 순차적 비교 결과:', answer.map((word, index) => ({
      userWord: word,
      correctWord: gameSetup.nonArticleWords[index],
      isMatch: word.toLowerCase() === gameSetup.nonArticleWords[index].toLowerCase()
    })));
    console.log('- 최종 정답 여부:', isAnswerCorrect);
    
    setIsCorrect(isAnswerCorrect);

    if (isAnswerCorrect) {
      setScore(prev => prev + 1);
      playCorrectSound();
    } else {
      playWrongSound();
    }

    // 로그 기록
    logAttempt({
      sessionId: sessionIdRef.current,
      mode: 'sentenceGame' as Mode,
      wordId: current?.id || 'unknown',
      correct: isAnswerCorrect
    });

    // 2초 후 다음 문제로 자동 진행
    setTimeout(() => {
      next();
    }, 2000);
  }, [current, playCorrectSound, playWrongSound, next]);

  // 단어 클릭 핸들러 (순차적 채우기용)
  const handleWordClick = useCallback((word: string) => {
    if (finished || isCorrect !== null || !gameSetup) return;

    console.log('🎯 단어 클릭:', word, '현재 채워진 빈칸 수:', userBlanks.length);

    // 발음 재생
    speakWord(word);

    // 사용자가 선택한 단어를 순차적으로 배열에 추가
    const newBlanks = [...userBlanks, word];
    setUserBlanks(newBlanks);

    // 모든 비관사 단어를 배열했으면 확인 버튼 활성화
    if (newBlanks.length === gameSetup.nonArticleWords.length) {
      console.log('🎯 모든 비관사 단어 배열 완료!');
      console.log('🎯 사용자 답안 (순차적):', newBlanks);
      console.log('🎯 정답 순서:', gameSetup.nonArticleWords);
    }
  }, [finished, isCorrect, userBlanks, speakWord]);

  // 답안 영역의 단어 클릭 핸들러 (단어 제거)
  const handleAnswerWordClick = useCallback((index: number) => {
    if (finished || isCorrect !== null) return;

    const wordToRemove = userBlanks[index];
    // 발음 재생
    speakWord(wordToRemove);

    // 해당 인덱스의 단어 제거
    const newBlanks = userBlanks.filter((_, i) => i !== index);
    setUserBlanks(newBlanks);
  }, [finished, isCorrect, userBlanks, speakWord]);

  // 정답 확인 버튼 핸들러
  const handleCheckAnswer = useCallback(() => {
    if (!gameSetup || finished || isCorrect !== null) return;

    console.log('🎯 정답 확인 버튼 클릭!');
    console.log('🎯 사용자 답안 (순차적):', userBlanks);
    console.log('🎯 정답 순서 (비관사):', gameSetup.nonArticleWords);
    
    // 순차적으로 채운 답안을 정답과 비교
    const isAnswerCorrect = userBlanks.length === gameSetup.nonArticleWords.length && 
      userBlanks.every((word, index) => word.toLowerCase() === gameSetup.nonArticleWords[index].toLowerCase());
    
    console.log('🎯 순차적 답안 비교 결과:', isAnswerCorrect);
    console.log('🎯 사용자 답안:', userBlanks);
    console.log('🎯 정답 답안:', gameSetup.nonArticleWords);
    
    // 정답 여부에 따라 다른 문장 읽기
    let sentenceToRead: string;
    
    if (isAnswerCorrect) {
      // 정답일 경우: 사용자가 만든 문장 읽기
      const fullSentence: string[] = [];
      let nonArticleCount = 0;
      
      gameSetup.correctOrder.forEach(word => {
        if (['a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must'].includes(word.toLowerCase())) {
          fullSentence.push(word);
        } else {
          if (nonArticleCount < userBlanks.length) {
            fullSentence.push(userBlanks[nonArticleCount]);
          }
          nonArticleCount++;
        }
      });
      sentenceToRead = fullSentence.join(' ');
      console.log('🎯 정답! 사용자 문장 읽기:', sentenceToRead);
    } else {
      // 오답일 경우: 정답 문장 읽기
      sentenceToRead = gameSetup.correctOrder.join(' ');
      console.log('🎯 오답! 정답 문장 읽기:', sentenceToRead);
    }
    
    speakWord(sentenceToRead);
    
    checkAnswer(userBlanks);
  }, [finished, isCorrect, userBlanks, checkAnswer, speakWord]);


  // 게임 시작
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

  // 게임 리셋
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
  };

  // 단어 배열 게임 로직
  const gameSetup = useMemo(() => {
    if (!current || !current.targetWords) return null;
    
    console.log('🎮 단어 배열 게임 설정 시작:');
    console.log('- 영어 문장:', current.englishSentence);
    console.log('- 타겟 단어들 (원본):', current.targetWords);
    
    // 영어 문장을 단어별로 분리하여 올바른 순서 재구성
    const englishWords = current.englishSentence
      .replace(/[.,!?;:]/g, '') // 구두점 제거
      .split(/\s+/) // 공백으로 분리
      .filter(word => word.length > 0); // 빈 문자열 제거
    
    console.log('- 영어 문장 단어 분리:', englishWords);
    
    // 관사 및 조동사/be동사 식별
    const preFilledWords = ['a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must'];
    
    // 영어 문장의 모든 단어를 correctOrder에 포함 (targetWords와 매칭되지 않는 단어도 포함)
    const correctOrder: string[] = [];
    const remainingWords = [...current.targetWords];
    
    for (const englishWord of englishWords) {
      // 대소문자 무시하고 매칭되는 단어 찾기
      const matchingIndex = remainingWords.findIndex(word => 
        word.toLowerCase() === englishWord.toLowerCase()
      );
      
      if (matchingIndex !== -1) {
        // targetWords에서 찾은 경우: 원본 단어 사용 (대소문자 보존)
        correctOrder.push(remainingWords[matchingIndex]);
        remainingWords.splice(matchingIndex, 1); // 사용된 단어 제거
      } else {
        // targetWords에서 찾지 못한 경우: 영어 문장의 단어를 그대로 사용
        correctOrder.push(englishWord);
        console.log(`⚠️ targetWords에 없는 단어 발견: "${englishWord}"`);
      }
    }
    
    // 남은 targetWords 추가 (혹시 누락된 경우)
    correctOrder.push(...remainingWords);
    
    console.log('- 재정렬된 정답 순서:', correctOrder);
    console.log('- 원본 타겟 단어들:', current.targetWords);
    
    // 미리 채워질 단어와 선택지 단어 분리
    const preFilledWordsList: string[] = [];
    const nonPreFilledWords: string[] = [];
    
    correctOrder.forEach(word => {
      if (preFilledWords.includes(word.toLowerCase())) {
        preFilledWordsList.push(word);
      } else {
        nonPreFilledWords.push(word);
      }
    });
    
    console.log('- 미리 채워질 단어들:', preFilledWordsList);
    console.log('- 선택지 단어들:', nonPreFilledWords);
    
    // 선택지 단어들만 랜덤하게 섞기 (미리 채워질 단어는 제외)
    const shuffledWords = [...nonPreFilledWords].sort(() => Math.random() - 0.5);
    
    console.log('- 섞인 단어들:', shuffledWords);
    
    return {
      correctOrder,
      shuffledWords,
      articleWords: preFilledWordsList,
      nonArticleWords: nonPreFilledWords
    };
  }, [current]);

  // 진단 도구 표시
  if (showDiagnostic) {
    return <SupabaseDiagnostic onBack={onBack} />;
  }

  // 설정 가이드 표시
  if (showSetupGuide) {
    return <SupabaseSetupGuide onBack={onBack} />;
  }

  // 로딩 중
  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>📖 영어 문장 만들기</h2>
        <p>문장 문제를 불러오는 중...</p>
      </div>
    );
  }

  // 오류 발생
  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>📖 영어 문장 만들기</h2>
        <p style={{ color: '#c62828', margin: '20px 0' }}>{error}</p>
        
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '20px', 
          borderRadius: '8px', 
          margin: '20px auto',
          textAlign: 'left',
          maxWidth: '600px'
        }}>
          <h3>🔧 문제 해결 방법:</h3>
          <ol>
            <li>Supabase 연결 상태를 확인하세요</li>
            <li>sentence_problems 테이블에 데이터가 있는지 확인하세요</li>
            <li>데이터 형식이 올바른지 확인하세요:</li>
            <ul>
              <li>id, korean_sentence, english_sentence, source, target_words, word_count, level</li>
              <li>target_words는 JSON 배열 형태여야 합니다: ["I", "don't", "eat", "apple", "an"]</li>
            </ul>
            <li>브라우저 개발자 도구(F12)의 콘솔에서 자세한 로그를 확인하세요</li>
            <li>관리자에게 문의하여 데이터 마이그레이션을 요청하세요</li>
          </ol>
          
          <p style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
            💡 Supabase Dashboard에서 sentence_problems 테이블을 확인해보세요
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button 
            onClick={() => setShowDiagnostic(true)}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            🔧 진단 도구
          </button>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            새로고침
          </button>
        <button 
          onClick={onBack}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          메인으로
        </button>
        </div>
      </div>
    );
  }

  // 문장 문제가 없는 경우
  if (!sentenceProblems || sentenceProblems.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>📖 영어 문장 만들기</h2>
        <p>문장 문제가 없습니다. 관리자에게 문의하여 데이터를 추가해주세요.</p>
        <button 
          onClick={onBack}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          메인으로
        </button>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>📖 영어 문장 만들기</h2>
        <p>총 {sentenceProblems?.length || 0}개의 문장 문제가 있습니다.</p>
        <p>문제 수를 선택하세요:</p>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '20px', 
          maxWidth: '400px', 
          margin: '20px auto' 
        }}>
          <button
            onClick={() => startGame(10)}
            disabled={(sentenceProblems?.length || 0) < 10}
            style={{
              padding: '30px 20px',
              fontSize: '18px',
              backgroundColor: (sentenceProblems?.length || 0) < 10 ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: (sentenceProblems?.length || 0) < 10 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            10문제
          </button>
          <button
            onClick={() => startGame(20)}
            disabled={(sentenceProblems?.length || 0) < 20}
            style={{
              padding: '30px 20px',
              fontSize: '18px',
              backgroundColor: (sentenceProblems?.length || 0) < 20 ? '#ccc' : '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: (sentenceProblems?.length || 0) < 20 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            20문제
          </button>
          <button
            onClick={() => startGame(30)}
            disabled={(sentenceProblems?.length || 0) < 30}
            style={{
              padding: '30px 20px',
              fontSize: '18px',
              backgroundColor: (sentenceProblems?.length || 0) < 30 ? '#ccc' : '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: (sentenceProblems?.length || 0) < 30 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            30문제
          </button>
          <button
            onClick={() => startGame(null)}
            style={{
              padding: '30px 20px',
              fontSize: '18px',
              backgroundColor: '#9C27B0',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            전체 문제
          </button>
          <button
            onClick={() => startGame('infinite' as any)}
            style={{
              padding: '30px 20px',
              fontSize: '18px',
              backgroundColor: '#E91E63',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            무제한 모드
          </button>
        </div>
        <button 
          onClick={onBack}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#757575',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            marginTop: '20px'
          }}
        >
          돌아가기
        </button>
      </div>
    );
  }

  if (finished) {
    const accuracy = Math.round((score / totalQuestions) * 100);
    const durationSec = Math.round((Date.now() - quizStartTime) / 1000);
    
    const getComment = (accuracy: number) => {
      if (accuracy === 100) return "완벽해요! 🎉";
      if (accuracy >= 80) return "훌륭해요! 👏";
      if (accuracy >= 60) return "잘했어요! 😊";
      return "다시 도전해보세요! 💪";
    };

    return (
      <div style={{ padding: '20px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <h2>📖 영어 문장 만들기 완료!</h2>
        
        {showNewRecord && (
          <div style={{
            backgroundColor: '#FFD700',
            color: '#000',
            padding: '15px',
            borderRadius: '10px',
            margin: '20px 0',
            fontWeight: 'bold',
            fontSize: '18px',
            animation: 'pulse 2s infinite'
          }}>
            🏆 신기록 달성! 🏆
          </div>
        )}
        
        <div style={{
          backgroundColor: '#f5f5f5',
          padding: '30px',
          borderRadius: '15px',
          margin: '20px 0'
        }}>
          <h3>📊 결과</h3>
          <div style={{ fontSize: '24px', margin: '15px 0' }}>
            <div>점수: <strong>{score}/{totalQuestions}</strong></div>
            <div>정확도: <strong>{accuracy}%</strong></div>
            <div>총 시간: <strong>{Math.floor(durationSec / 60)}분 {durationSec % 60}초</strong></div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1976d2' }}>
            {getComment(accuracy)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={resetAll}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            다시 하기
          </button>
          <button
            onClick={onBack}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#757575',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            메인으로
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>문제를 불러오는 중...</h2>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center', 
      maxWidth: '800px', 
      margin: '0 auto',
      minHeight: '100vh'
    }}>
      <h2>📖 영어 문장 만들기</h2>
      
      {/* 진행 상황 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: '15px',
        borderRadius: '10px',
        margin: '20px 0'
      }}>
        <div>문제 {currentIndex + 1}/{totalQuestions}</div>
        <div>점수: {score}</div>
        <div>출처: {current?.source}</div>
      </div>

      {/* 한국어 문장 */}
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#1976d2',
        margin: '30px 0',
        padding: '20px',
        backgroundColor: '#e3f2fd',
        borderRadius: '12px'
      }}>
        {current?.koreanSentence}
      </div>

      {/* 사용자 답안 영역 */}
      <div style={{
        fontSize: '28px',
        fontWeight: 'bold',
        margin: '30px 0',
        padding: '25px',
        backgroundColor: '#fff',
        border: '2px solid #ddd',
        borderRadius: '12px',
        minHeight: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {/* 전체 문장 순서대로 표시 (순차적 채우기) */}
        {gameSetup?.correctOrder.map((word, index) => {
          const isPreFilled = ['a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must'].includes(word.toLowerCase());
          
          if (isPreFilled) {
            // 관사 및 조동사/be동사는 미리 채워진 상태로 표시
            return (
              <div
                key={`article-${index}`}
                style={{
                  minWidth: '100px',
                  minHeight: '50px',
                  border: '2px solid #4CAF50',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#e8f5e8',
                  margin: '0 5px',
                  fontWeight: 'bold',
                  color: '#2e7d32'
                }}
              >
                {word}
              </div>
            );
          }
          
          // 비관사 단어들의 순차적 인덱스 계산
          let nonArticleIndex = -1;
          let currentNonArticleCount = 0;
          
          // 현재 단어까지의 비관사 단어 개수를 세기
          for (let i = 0; i <= index; i++) {
            const currentWord = gameSetup.correctOrder[i];
            if (!['a', 'an', 'the', 'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must'].includes(currentWord.toLowerCase())) {
              if (i === index) {
                nonArticleIndex = currentNonArticleCount;
              }
              currentNonArticleCount++;
            }
          }
          
          const isFilled = nonArticleIndex >= 0 && nonArticleIndex < userBlanks.length;
          const userWord = isFilled ? userBlanks[nonArticleIndex] : null;
          
          if (isFilled && userWord) {
            // 사용자가 채운 단어 (순차적)
            return (
              <div
                key={`filled-${index}`}
                    style={{
                  minWidth: '100px',
                  minHeight: '50px',
                  border: '2px solid #4CAF50',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#e8f5e8',
                  margin: '0 5px',
                      fontWeight: 'bold',
                  color: '#2e7d32',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onClick={() => handleAnswerWordClick(nonArticleIndex)}
              >
                <button
                  style={{
                    background: 'none',
                      border: 'none',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#2e7d32',
                    cursor: 'pointer',
                    padding: '5px 10px'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAnswerWordClick(nonArticleIndex);
                  }}
                >
                  {userWord}
                  </button>
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  backgroundColor: '#ff4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  ×
                </span>
              </div>
            );
          }
          
          // 빈 자리
          return (
            <div
              key={`empty-${index}`}
              style={{
                minWidth: '100px',
                minHeight: '50px',
                border: '2px dashed #ccc',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f9f9f9',
                margin: '0 5px',
                color: '#999',
                fontSize: '16px'
              }}
            >
              {nonArticleIndex + 1}
            </div>
          );
        })}
      </div>

      {/* 정답/오답 표시 */}
      {isCorrect !== null && (
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold',
          margin: '20px 0',
          padding: '15px',
          borderRadius: '10px',
          backgroundColor: isCorrect ? '#e8f5e8' : '#fde8e8',
          color: isCorrect ? '#2e7d32' : '#c62828'
        }}>
          {isCorrect ? '정답입니다! 🎉' : '틀렸습니다 😅'}
            <div style={{ marginTop: '10px', fontSize: '18px' }}>
            정답: {gameSetup?.correctOrder?.join(' ')}
          </div>
          {!isCorrect && (
            <div style={{ marginTop: '5px', fontSize: '16px', color: '#666' }}>
              다시 시도해보세요!
            </div>
          )}
        </div>
      )}

      {/* 단어 선택 영역 */}
      <div style={{
        margin: '30px 0',
        padding: '20px',
        backgroundColor: '#f9f9f9',
        borderRadius: '12px'
      }}>
        <h3>단어를 클릭해서 빈칸을 채우세요:</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '15px',
          marginTop: '20px'
        }}>
          {gameSetup?.shuffledWords.map((word, index) => {
            // 이미 사용된 단어는 비활성화
            const isUsed = userBlanks.includes(word);
            
            return (
              <button
                key={index}
                onClick={() => handleWordClick(word)}
                disabled={finished || isCorrect !== null || isUsed}
                style={{
                  padding: '15px 10px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  backgroundColor: isUsed ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (finished || isCorrect !== null || isUsed) ? 'not-allowed' : 'pointer',
                  opacity: (finished || isCorrect !== null || isUsed) ? 0.6 : 1,
                  minHeight: '60px',
                  transition: 'all 0.2s ease'
                }}
              >
                {word}
              </button>
            );
          })}
        </div>
      </div>

      {/* 정답 확인 버튼 */}
      {gameSetup && userBlanks.length === gameSetup.nonArticleWords.length && isCorrect === null && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: '20px' 
        }}>
          <button
            onClick={handleCheckAnswer}
            disabled={finished || isCorrect !== null}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              fontWeight: 'bold',
              backgroundColor: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: finished || isCorrect !== null ? 'not-allowed' : 'pointer',
              opacity: finished || isCorrect !== null ? 0.6 : 1,
              minHeight: '60px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            onMouseEnter={(e) => {
              if (!finished && isCorrect === null) {
                e.currentTarget.style.backgroundColor = '#F57C00';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (!finished && isCorrect === null) {
                e.currentTarget.style.backgroundColor = '#FF9800';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            ✅ 정답 확인
          </button>
        </div>
      )}

      {/* 하단 버튼 */}
      <div style={{ marginTop: '30px' }}>
        <button
          onClick={onBack}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#757575',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          메인으로
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default SentenceGame;