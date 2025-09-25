import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Word } from '../types/word';
import { logAttempt, saveSession, Mode } from '../services/trackingService';
import { addRecord, isNewRecord } from '../services/rankingService';
import { getCurrentUserName } from '../services/supabaseClient';

interface SentenceTemplate {
  id: string;
  korean: string;
  template: string; // 관사가 포함된 템플릿 (예: "I ___ a ___")
  blanks: string[]; // 빈칸에 들어갈 단어들 (예: ["eat", "cake"])
  difficulty: 'easy' | 'medium' | 'hard';
}

interface SentenceGameProps {
  words: Word[];
  onBack: () => void;
}

const SentenceGame: React.FC<SentenceGameProps> = ({ words, onBack }) => {
  // 구글 시트에서 기초단어와 선택된 교재 단어들을 카테고리별로 분류
  const CATEGORIZED_WORDS = useMemo(() => {
    console.log('🔍 전체 단어 분석 시작:', words.length);
    console.log('🔍 카테고리별 단어 수:', words.reduce((acc, word) => {
      const cat = word.category || 'undefined';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>));

    // 기초단어가 있는지 확인
    const basicWords = words.filter(word => word.category === '기초단어');
    const hasBasicWords = basicWords.length > 0;
    
    console.log('🔍 기초단어 존재 여부:', hasBasicWords, '개수:', basicWords.length);

    let subjects: Word[], verbs: Word[], grammar: Word[], adjectives: Word[], timeWords: Word[];

    if (hasBasicWords) {
      // 기초단어가 있으면 기초단어에서 문법 요소 추출
      console.log('✅ 기초단어 모드 사용');
      subjects = basicWords.filter(word => 
        ['I', 'you', 'he', 'she', 'we', 'they'].includes(word.english.toLowerCase())
      );
      verbs = basicWords.filter(word => 
        ['eat', 'drink', 'like', 'love', 'have', 'read', 'see', 'watch', 'play', 'listen', 'speak', 'write', 'buy', 'want', 'need', 'go', 'come', 'give', 'take', 'make', 'do', 'get', 'put', 'find', 'help', 'work', 'live', 'feel', 'think', 'know', 'learn', 'teach', 'study', 'cook', 'clean', 'open', 'close', 'start', 'stop', 'finish'].includes(word.english.toLowerCase())
      );
      grammar = basicWords.filter(word => 
        ['a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'of', 'about', 'under', 'over', 'between'].includes(word.english.toLowerCase())
      );
      adjectives = basicWords.filter(word => 
        ['big', 'small', 'good', 'bad', 'new', 'old', 'hot', 'cold', 'happy', 'sad', 'beautiful', 'ugly', 'fast', 'slow', 'easy', 'hard', 'long', 'short', 'high', 'low', 'clean', 'dirty', 'heavy', 'light', 'strong', 'weak'].includes(word.english.toLowerCase())
      );
      timeWords = basicWords.filter(word => 
        ['today', 'yesterday', 'tomorrow', 'morning', 'afternoon', 'evening', 'night', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(word.english.toLowerCase())
      );
    } else {
      // 기초단어가 없으면 하드코딩된 기본 문법 요소 사용
      console.log('⚠️ 기초단어 없음 - 하드코딩 모드 사용');
      subjects = [
        { id: 'hardcoded_I', english: 'I', korean: '나는' },
        { id: 'hardcoded_you', english: 'you', korean: '너는' },
        { id: 'hardcoded_he', english: 'he', korean: '그는' },
        { id: 'hardcoded_she', english: 'she', korean: '그녀는' }
      ] as Word[];
      
      verbs = [
        { id: 'hardcoded_eat', english: 'eat', korean: '먹다' },
        { id: 'hardcoded_drink', english: 'drink', korean: '마시다' },
        { id: 'hardcoded_like', english: 'like', korean: '좋아하다' },
        { id: 'hardcoded_have', english: 'have', korean: '가지다' },
        { id: 'hardcoded_read', english: 'read', korean: '읽다' },
        { id: 'hardcoded_see', english: 'see', korean: '보다' }
      ] as Word[];
      
      grammar = [] as Word[];
      adjectives = [] as Word[];
      timeWords = [] as Word[];
    }

    // 명사들: 기초단어가 있으면 (기초단어 중 명사 + 교재 단어), 없으면 모든 교재 단어
    let nouns: Word[];
    if (hasBasicWords) {
      // 교재의 명사들 (기초단어가 아닌 모든 단어들)
      const materialNouns = words.filter(word => 
        word.category && word.category !== '기초단어'
      );
      // 기초단어 중 명사 (다른 품사에 속하지 않는 것들)
      const basicNouns = basicWords.filter(word => 
        !subjects.includes(word) && !verbs.includes(word) && !grammar.includes(word) && 
        !adjectives.includes(word) && !timeWords.includes(word)
      );
      nouns = [...basicNouns, ...materialNouns];
    } else {
      // 기초단어가 없으면 모든 단어를 명사로 활용
      nouns = words.filter(word => word.category && word.english && word.korean);
    }

    console.log('✅ 분류된 단어 수:', {
      subjects: subjects.length,
      verbs: verbs.length,
      grammar: grammar.length,
      adjectives: adjectives.length,
      nouns: nouns.length,
      timeWords: timeWords.length
    });

    return {
      subjects,
      verbs,
      grammar,
      adjectives,
      nouns,
      timeWords
    };
  }, [words]);

  // TTS 발음 함수
  const speakWord = useCallback((word: string) => {
    try {
      // 기존 음성 중단
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.rate = 0.8;
      utterance.pitch = 1.0;
      utterance.volume = 0.7;
      
      // 미국 영어 음성 선택
      const voices = window.speechSynthesis.getVoices();
      const usVoice = voices.find(voice => voice.lang.includes('en-US'));
      if (usVoice) {
        utterance.voice = usVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('TTS 오류:', error);
    }
  }, []);

  // 구글 시트 기반 문장 생성 함수
  const generateSentences = useCallback((): SentenceTemplate[] => {
    const { subjects, verbs, nouns, grammar } = CATEGORIZED_WORDS;
    
    if (subjects.length === 0 || verbs.length === 0 || nouns.length === 0) {
      console.warn('⚠️ 문장 생성에 필요한 기본 단어들이 부족합니다.');
      console.log('필요한 카테고리:', {
        subjects: subjects.length,
        verbs: verbs.length,
        nouns: nouns.length
      });
      return [];
    }

    console.log('🔤 구글 시트 기반 문장 생성 시작:', {
      subjects: subjects.length,
      verbs: verbs.length,
      nouns: nouns.length,
      grammar: grammar.length
    });
    
    const sentences: SentenceTemplate[] = [];
    let sentenceId = 1;

    // 관사 가져오기 함수
    const getArticle = (word: string): string => {
      const vowels = ['a', 'e', 'i', 'o', 'u'];
      return vowels.includes(word.toLowerCase()[0]) ? 'an' : 'a';
    };

    // 의미적으로 자연스러운 동사-명사 조합 규칙
    const getSemanticRules = () => {
      console.log('🔍 명사 분류 시작, 전체 명사:', nouns.map(n => `${n.english}(${n.korean})`));
      
      // 카테고리별 명사 분류 (더 엄격한 기준)
      const liquidWords = nouns.filter(noun => {
        const englishLower = noun.english.toLowerCase();
        const korean = noun.korean;
        return ['water', 'milk', 'juice', 'coffee', 'tea', 'soda', 'beer', 'wine', 'cola', 'lemonade'].includes(englishLower) ||
               korean.includes('물') || korean.includes('우유') || korean.includes('주스') || 
               korean.includes('커피') || korean.includes('차') || korean.includes('음료') ||
               korean.includes('콜라') || korean.includes('레모네이드') || korean.includes('맥주') ||
               korean.includes('와인') || korean === '차' || korean === '물'; // 정확한 매칭
      });
      
      const solidFoodWords = nouns.filter(noun => {
        const englishLower = noun.english.toLowerCase();
        const korean = noun.korean;
        return ['apple', 'banana', 'bread', 'cake', 'cookie', 'pizza', 'rice', 'sandwich', 'meat', 'fish', 'egg', 'fruit', 'vegetable', 'chicken', 'beef', 'pork'].includes(englishLower) ||
               korean.includes('사과') || korean.includes('바나나') || korean.includes('빵') || 
               korean.includes('케이크') || korean.includes('음식') || korean.includes('과자') ||
               korean.includes('고기') || korean.includes('생선') || korean.includes('달걀') ||
               korean.includes('과일') || korean.includes('채소') || korean.includes('치킨') ||
               korean.includes('돼지') || korean.includes('소고기') || korean.includes('닭') ||
               korean.includes('햄버거') || korean.includes('피자') || korean.includes('라면');
      });
      
      const readableWords = nouns.filter(noun => {
        const englishLower = noun.english.toLowerCase();
        const korean = noun.korean;
        return ['book', 'novel', 'story', 'magazine', 'newspaper', 'letter', 'email', 'comic', 'textbook'].includes(englishLower) ||
               korean.includes('책') || korean.includes('소설') || korean.includes('잡지') || 
               korean.includes('신문') || korean.includes('편지') || korean.includes('만화') ||
               korean.includes('교과서') || korean.includes('도서') || korean === '책';
      });
      
      const watchableWords = nouns.filter(noun => {
        const englishLower = noun.english.toLowerCase();
        const korean = noun.korean;
        return ['movie', 'tv', 'video', 'show', 'game', 'film', 'drama'].includes(englishLower) ||
               korean.includes('영화') || korean.includes('텔레비전') || korean.includes('비디오') ||
               korean.includes('게임') || korean.includes('쇼') || korean.includes('드라마') ||
               korean.includes('TV') || korean.includes('프로그램');
      });
      
      const livingThings = nouns.filter(noun => {
        const englishLower = noun.english.toLowerCase();
        const korean = noun.korean;
        return ['cat', 'dog', 'bird', 'fish', 'rabbit', 'tiger', 'lion', 'elephant', 'person', 'friend', 'animal', 'bear', 'mouse', 'horse'].includes(englishLower) ||
               korean.includes('고양이') || korean.includes('개') || korean.includes('새') || 
               korean.includes('물고기') || korean.includes('토끼') || korean.includes('동물') ||
               korean.includes('사람') || korean.includes('친구') || korean.includes('곰') ||
               korean.includes('쥐') || korean.includes('말') || korean.includes('호랑이') ||
               korean.includes('사자') || korean.includes('코끼리');
      });
      
      // 탈것/큰 물건들 (마실 수 없고 소유하기 어려운 것들)
      const vehicles = nouns.filter(noun => {
        const englishLower = noun.english.toLowerCase();
        const korean = noun.korean;
        return ['car', 'bus', 'train', 'plane', 'bicycle', 'motorcycle', 'truck', 'van'].includes(englishLower) ||
               korean.includes('자동차') || korean.includes('버스') || korean.includes('기차') ||
               korean.includes('비행기') || korean.includes('자전거') || korean.includes('오토바이') ||
               korean.includes('트럭') || korean.includes('승합차') || korean.includes('택시') ||
               korean.includes('지하철') || korean === '차';
      });
      
      // 소유 가능한 작은 물건들 (액체, 음식, 탈것 제외)
      const ownableThings = nouns.filter(noun => 
        !liquidWords.includes(noun) && 
        !solidFoodWords.includes(noun) && 
        !vehicles.includes(noun) &&
        !livingThings.includes(noun) // 생명체도 소유 대상에서 제외
      );

      console.log('📝 분류 결과:', {
        liquidWords: liquidWords.map(n => n.korean),
        solidFoodWords: solidFoodWords.map(n => n.korean),
        readableWords: readableWords.map(n => n.korean),
        livingThings: livingThings.map(n => n.korean),
        vehicles: vehicles.map(n => n.korean),
        ownableThings: ownableThings.map(n => n.korean)
      });

      return {
        eat: solidFoodWords,           // 먹을 수 있는 것들만
        drink: liquidWords,           // 마실 수 있는 것들만  
        read: readableWords.length > 0 ? readableWords : [], // 읽을 수 있는 것들
        see: [...livingThings, ...vehicles], // 볼 수 있는 것들 (생명체 + 탈것)
        like: [...solidFoodWords, ...liquidWords, ...livingThings, ...ownableThings].slice(0, 12), // 좋아할 수 있는 것들
        have: ownableThings.slice(0, 8), // 소유할 수 있는 작은 물건들만
        watch: watchableWords.length > 0 ? watchableWords : [] // 볼 수 있는 것들
      } as Record<string, Word[]>;
    };

    const semanticRules = getSemanticRules();

    // 패턴 1: Subject + Verb + Noun (의미적으로 자연스러운 S+V+O 구조)
    subjects.forEach(subject => {
      verbs.forEach(verb => {
        // 동사에 맞는 명사들만 선택
        const compatibleNouns: Word[] = semanticRules[verb.english.toLowerCase()] || nouns.slice(0, 3);
        
        if (compatibleNouns.length === 0) return; // 호환되는 명사가 없으면 건너뛰기
        
        compatibleNouns.slice(0, 3).forEach((noun: Word) => {
          // 관사가 필요한지 판단 (일반적으로 단수 명사)
          const needsArticle = !noun.english.endsWith('s') && 
                              !['water', 'milk', 'juice', 'coffee', 'tea', 'rice'].includes(noun.english.toLowerCase());
          
          // 동사의 주어에 따른 변화 처리
          let conjugatedVerb = verb.english;
          if ((subject.english === 'he' || subject.english === 'she') && 
              ['like', 'eat', 'drink', 'read', 'see', 'have', 'want', 'need', 'watch'].includes(verb.english)) {
            if (verb.english === 'have') {
              conjugatedVerb = 'has';
            } else {
              conjugatedVerb = verb.english + 's';
            }
          }
          
          if (needsArticle) {
            const article = getArticle(noun.english);
            sentences.push({
              id: `sentence_${sentenceId++}`,
              korean: `${subject.korean} ${noun.korean}을/를 ${verb.korean}`,
              template: `___ ___ ${article} ___`,
              blanks: [subject.english, conjugatedVerb, noun.english],
              difficulty: 'easy'
            });
          } else {
            sentences.push({
              id: `sentence_${sentenceId++}`,
              korean: `${subject.korean} ${noun.korean}을/를 ${verb.korean}`,
              template: `___ ___ ___`,
              blanks: [subject.english, conjugatedVerb, noun.english],
              difficulty: 'easy'
            });
          }
        });
      });
    });

    console.log(`✅ 구글 시트 기반 생성된 문장 수: ${sentences.length}`);
    return sentences.slice(0, 30); // 최대 30개 문장
  }, [CATEGORIZED_WORDS]);

  // 게임 상태
  const [gameKey, setGameKey] = useState(0);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [userBlanks, setUserBlanks] = useState<string[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showNewRecord, setShowNewRecord] = useState(false);
  const sessionIdRef = useRef<string>('');
  const startTimeRef = useRef<number>(0);

  // 세션 ID 생성
  useEffect(() => {
    sessionIdRef.current = `sentence_game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    startTimeRef.current = Date.now();
  }, [gameKey]);

  // 문장 데이터
  const sentences = useMemo(() => generateSentences(), [generateSentences]);
  const totalQuestions = questionCount || sentences.length;
  const current = sentences[currentIndex];

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

  const playRecordSound = useCallback(() => {
    try {
      const audio = new Audio('/record.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('사운드 재생 실패:', e));
    } catch (error) {
      console.error('사운드 재생 오류:', error);
    }
  }, []);

  // 정답 체크 함수
  const checkAnswer = useCallback((answer: string[]) => {
    if (!current) return;

    const isAnswerCorrect = JSON.stringify(answer) === JSON.stringify(current.blanks);
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
      wordId: current.id,
      correct: isAnswerCorrect
    });

    // 2초 후 다음 문제로 자동 진행
    setTimeout(() => {
      next();
    }, 2000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, playCorrectSound, playWrongSound]);

  // 단어 클릭 핸들러
  const handleWordClick = useCallback((word: string) => {
    if (finished || isCorrect !== null) return;

    // 발음 재생
    speakWord(word);

    // 빈칸에 단어 추가
    const newBlanks = [...userBlanks, word];
    setUserBlanks(newBlanks);

    // 모든 빈칸이 채워지면 정답 체크
    if (newBlanks.length === current?.blanks.length) {
      checkAnswer(newBlanks);
    }
  }, [finished, isCorrect, userBlanks, current?.blanks.length, speakWord, checkAnswer]);

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

  // 다음 문제로 진행
  const next = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= totalQuestions) {
      // 게임 완료
      setFinished(true);
      
      // 세션 저장 및 순위 확인
      const endTime = Date.now();
      const durationSec = Math.round((endTime - startTimeRef.current) / 1000);
      const accuracy = Math.round((score / totalQuestions) * 100);

      const userName = getCurrentUserName();
      
      saveSession({
        mode: 'sentenceGame' as Mode,
        score,
        total: totalQuestions,
        durationSec
      });

      // 순위 확인 및 저장
      const finalQuestionCount: number | 'infinite' = questionCount || 'infinite';
      const newRecord = isNewRecord('sentenceGame', durationSec * 1000, accuracy, finalQuestionCount);
      
      if (newRecord && accuracy === 100) {
        setShowNewRecord(true);
        playRecordSound();
        
        const record = {
          userName,
          quizType: 'sentenceGame' as const,
          score,
          totalQuestions,
          accuracy,
          totalTimeMs: durationSec * 1000,
          questionCount: finalQuestionCount
        };
        addRecord(record);
      }
    } else {
      setCurrentIndex(nextIndex);
      setUserBlanks([]);
      setIsCorrect(null);
    }
  }, [currentIndex, totalQuestions, score, questionCount, playRecordSound]);

  // 게임 시작
  const startGame = (count: number | null) => {
    setQuestionCount(count);
    setGameStarted(true);
    setCurrentIndex(0);
    setScore(0);
    setFinished(false);
    setUserBlanks([]);
    setIsCorrect(null);
    setShowNewRecord(false);
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

  // 선택 가능한 단어들 (중복 제거된 shuffled words)
  const shuffledWords = useMemo(() => {
    if (!current) return [];
    
    // 현재 문제의 정답 단어들과 다른 단어들을 섞어서 선택지 생성
    const { subjects, verbs, nouns } = CATEGORIZED_WORDS;
    const allWords = [...subjects, ...verbs, ...nouns];
    
    // 정답 단어들
    const correctWords = current.blanks;
    
    // 오답 선택지 생성 (같은 카테고리에서)
    const wrongChoices: string[] = [];
    
    correctWords.forEach(correctWord => {
      const wordCategory = allWords.find(w => w.english === correctWord)?.category;
      const sameCategory = allWords.filter(w => w.category === wordCategory && w.english !== correctWord);
      
      if (sameCategory.length > 0) {
        const randomWrong = sameCategory[Math.floor(Math.random() * sameCategory.length)];
        wrongChoices.push(randomWrong.english);
      }
    });
    
    // 정답과 오답을 합쳐서 섞기
    const allChoices = [...correctWords, ...wrongChoices.slice(0, 4)];
    return allChoices.sort(() => Math.random() - 0.5).slice(0, 8); // 최대 8개 선택지
  }, [current, CATEGORIZED_WORDS]);

  if (words.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>📖 영어 문장 만들기</h2>
        <p>단어가 없습니다. 구글 시트에 필수 단어들을 추가해주세요.</p>
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

  if (sentences.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>📖 영어 문장 만들기</h2>
        <p>문장을 생성할 수 없습니다. 구글 시트에 다음 카테고리의 단어들을 추가해주세요:</p>
        <ul style={{ textAlign: 'left', maxWidth: '400px', margin: '20px auto' }}>
          <li><strong>subject</strong>: I, you, he, she, we, they</li>
          <li><strong>verb</strong>: eat, drink, like, have, read, see 등</li>
          <li><strong>noun</strong>: apple, book, cat, water 등 (다른 카테고리들)</li>
        </ul>
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
            style={{
              padding: '30px 20px',
              fontSize: '18px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            10문제
          </button>
          <button
            onClick={() => startGame(20)}
            style={{
              padding: '30px 20px',
              fontSize: '18px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            20문제
          </button>
          <button
            onClick={() => startGame(30)}
            style={{
              padding: '30px 20px',
              fontSize: '18px',
              backgroundColor: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
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
            무제한
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
    const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    
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
      </div>

      {/* 한국어 의미 */}
      <div style={{
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#1976d2',
        margin: '30px 0',
        padding: '20px',
        backgroundColor: '#e3f2fd',
        borderRadius: '12px'
      }}>
        {current.korean}
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
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {current.template.split('___').map((part, partIndex) => (
          <React.Fragment key={partIndex}>
            {/* 고정된 단어 (관사 등) */}
            {part.trim() && (
              <span style={{ margin: '0 5px' }}>{part.trim()}</span>
            )}
            
            {/* 빈칸 또는 사용자가 입력한 단어 */}
            {partIndex < current.blanks.length && (
              <div
                style={{
                  minWidth: '100px',
                  minHeight: '50px',
                  border: userBlanks[partIndex] ? 'none' : '2px dashed #999',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: userBlanks[partIndex] ? '#e3f2fd' : '#f9f9f9',
                  margin: '0 5px',
                  cursor: userBlanks[partIndex] ? 'pointer' : 'default'
                }}
                onClick={() => userBlanks[partIndex] && handleAnswerWordClick(partIndex)}
              >
                {userBlanks[partIndex] ? (
                  <button
                    style={{
                      padding: '8px 16px',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    {userBlanks[partIndex]}
                  </button>
                ) : (
                  <span style={{ color: '#999', fontSize: '16px' }}>{partIndex + 1}</span>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
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
          {!isCorrect && (
            <div style={{ marginTop: '10px', fontSize: '18px' }}>
              정답: {(() => {
                let blankIndex = 0;
                return current.template.replace(/___/g, () => current.blanks[blankIndex++] || '');
              })()}
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
          {shuffledWords.map((word, index) => {
            const isUsed = userBlanks.includes(word);
            return (
              <button
                key={index}
                onClick={() => handleWordClick(word)}
                disabled={isUsed || finished || isCorrect !== null}
                style={{
                  padding: '15px 10px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  backgroundColor: isUsed ? '#ccc' : '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isUsed || finished || isCorrect !== null ? 'not-allowed' : 'pointer',
                  opacity: isUsed ? 0.5 : 1,
                  minHeight: '60px'
                }}
              >
                {word}
              </button>
            );
          })}
        </div>
      </div>

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