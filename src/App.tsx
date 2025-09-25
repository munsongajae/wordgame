import React, { useState, useEffect } from 'react';
import WordList from './components/WordList';
import PronunciationQuiz from './components/PronunciationQuiz';
import Dashboard from './components/Dashboard';
import ImageQuiz from './components/ImageQuiz';
import SpellingQuiz from './components/SpellingQuiz';
import MeaningQuiz from './components/MeaningQuiz';
import CombinedQuiz from './components/CombinedQuiz';
import FallingQuiz from './components/FallingQuiz';
import ListeningQuiz from './components/ListeningQuiz';
import SpellingGame from './components/SpellingGame';
import FillBlankGame from './components/FillBlankGame';
import SentenceGame from './components/SentenceGame';
import Ranking from './components/Ranking';
import { Word } from './types/word';
import { GoogleSheetsService } from './services/googleSheetsService';
import './App.css';
import { getCurrentUserName, setCurrentUserByName } from './services/supabaseClient';

type AppMode = 'sourceSelection' | 'wordList' | 'pronunciation' | 'imageQuiz' | 'spellingQuiz' | 'meaningQuiz';
type AppModeExtended = AppMode | 'dashboard' | 'userSelection' | 'combinedQuiz' | 'ranking' | 'fallingQuiz' | 'listeningQuiz' | 'spellingGame' | 'fillBlankGame' | 'sentenceGame' | 'categoryBasic' | 'categoryQuiz' | 'categoryGame' | 'categoryCombined';

function App() {
  const [words, setWords] = useState<Word[]>([]);
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [mode, setMode] = useState<AppModeExtended>('sourceSelection');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>(['전체']);
  const [currentUserName, setCurrentUserName] = useState<'열음이' | '지음이'>(getCurrentUserName());
  const [showTtsSettings, setShowTtsSettings] = useState(false);
  const [ttsRate, setTtsRate] = useState<number>(1.0);
  const [ttsGender, setTtsGender] = useState<'default' | 'male' | 'female'>('default');
  const [ttsAccent, setTtsAccent] = useState<'us' | 'uk'>('us');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 앱 시작 시 전체 데이터 자동 로드
  useEffect(() => {
    loadWords(['전체']);
  }, []);

  // 전역 TTS 설정 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ttsSettings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.rate === 'number') setTtsRate(parsed.rate);
        if (parsed.gender === 'male' || parsed.gender === 'female' || parsed.gender === 'default') setTtsGender(parsed.gender);
        if (parsed.accent === 'us' || parsed.accent === 'uk') setTtsAccent(parsed.accent);
      }
    } catch {}
  }, []);

  // 전역 TTS 설정 저장
  useEffect(() => {
    try {
      localStorage.setItem('ttsSettings', JSON.stringify({ rate: ttsRate, gender: ttsGender, accent: ttsAccent }));
    } catch {}
  }, [ttsRate, ttsGender, ttsAccent]);

  // 교재 선택/해제 토글 함수
  const toggleSource = async (source: string) => {
    let newSources: string[];
    
    if (source === '전체') {
      // '전체' 선택 시 다른 모든 선택 해제
      newSources = ['전체'];
    } else {
      // 개별 교재 선택/해제
      if (selectedSources.includes('전체')) {
        // '전체'가 선택되어 있으면 해제하고 새 교재 추가
        newSources = [source];
      } else if (selectedSources.includes(source)) {
        // 이미 선택된 교재면 해제
        newSources = selectedSources.filter(s => s !== source);
        // 모든 교재가 해제되면 '전체' 선택
        if (newSources.length === 0) {
          newSources = ['전체'];
        }
      } else {
        // 새 교재 추가
        newSources = [...selectedSources, source];
      }
    }
    
    setSelectedSources(newSources);
    await loadWords(newSources);
  };

  const loadWords = async (sources?: string[] | string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 환경 변수 확인
      const sheetId = process.env.REACT_APP_GOOGLE_SHEET_ID;
      const sourcesArray = Array.isArray(sources) ? sources : (sources ? [sources] : ['전체']);
      console.log('🔍 환경 변수 확인:', {
        sheetId: sheetId || '설정되지 않음',
        hasEnvFile: !!sheetId,
        selectedSources: sourcesArray
      });
      
      if (!sheetId) {
        setError('.env 파일에 REACT_APP_GOOGLE_SHEET_ID가 설정되지 않았습니다.');
        return;
      }
      
      const fetchedWords = await GoogleSheetsService.fetchWords();
      
      // 구글 시트에서 데이터를 성공적으로 가져왔는지 확인
      if (fetchedWords.length > 0) {
        // 디버깅: 구글 시트에서 가져온 카테고리들 확인
        const allCategories = fetchedWords.map(word => word.category).filter(Boolean);
        const categories = Array.from(new Set(allCategories));
        console.log('🔍 구글 시트에서 발견된 카테고리들:', categories);
        console.log('🎯 선택된 교재들:', sourcesArray);
        console.log('📊 전체 단어 수:', fetchedWords.length);
        console.log('📝 첫 3개 단어 샘플:', fetchedWords.slice(0, 3));
        
        // 출처별 필터링 (복수 선택 지원)
        let filteredWords = fetchedWords;
        if (!sourcesArray.includes('전체')) {
          filteredWords = fetchedWords.filter(word => 
            word.category && sourcesArray.includes(word.category)
          );
          console.log(`🔍 필터링 결과: ${filteredWords.length}개 단어 (선택된 교재: ${sourcesArray.join(', ')})`);
        }
        
        console.log(`✅ 구글 시트에서 단어 로드 성공: ${filteredWords.length}개 (전체: ${fetchedWords.length}개, 선택된 교재: ${sourcesArray.join(', ')})`);
        setWords(filteredWords);
        // 카테고리 화면을 유지하기 위해 모드 변경 제거
      } else {
        console.warn('⚠️ 구글 시트에 데이터가 없습니다. 샘플 데이터를 사용합니다.');
        // 샘플 데이터 사용 (품사가 포함된 단어들로 테스트)
        const sampleWords = [
          {
            id: 'sample_1',
            english: GoogleSheetsService.removePartOfSpeech('apple (n.)'),
            korean: '사과',
            pronunciation: undefined,
            example: undefined,
            difficulty: undefined,
            category: '기적의파닉스1권'
          },
          {
            id: 'sample_2',
            english: GoogleSheetsService.removePartOfSpeech('beautiful adj.'),
            korean: '아름다운',
            pronunciation: undefined,
            example: undefined,
            difficulty: undefined,
            category: '기적의파닉스2권'
          },
          {
            id: 'sample_3',
            english: GoogleSheetsService.removePartOfSpeech('challenge noun'),
            korean: '도전',
            pronunciation: undefined,
            example: undefined,
            difficulty: undefined,
            category: '기적의파닉스1권'
          },
          {
            id: 'sample_4',
            english: GoogleSheetsService.removePartOfSpeech('adventure'),
            korean: '모험',
            pronunciation: undefined,
            example: undefined,
            difficulty: undefined,
            category: '기적의파닉스3권'
          }
        ];
        
        // 출처별 필터링 (복수 선택 지원)
        let filteredSampleWords = sampleWords;
        if (!sourcesArray.includes('전체')) {
          filteredSampleWords = sampleWords.filter(word => 
            word.category && sourcesArray.includes(word.category)
          );
        }
        
        setWords(filteredSampleWords);
        // 카테고리 화면을 유지하기 위해 모드 변경 제거
      }
    } catch (err) {
      console.error('❌ 구글 시트 접근 실패:', err);
      console.log('🔄 샘플 데이터를 사용합니다.');
      
      // sourcesArray를 catch 블록에서도 사용하기 위해 재정의
      const sourcesArray = Array.isArray(sources) ? sources : (sources ? [sources] : ['전체']);
      
      // 오류 발생 시 샘플 데이터 사용 (품사가 포함된 단어들로 테스트)
      const sampleWords = [
        {
          id: 'sample_1',
          english: GoogleSheetsService.removePartOfSpeech('apple (n.)'),
          korean: '사과',
          pronunciation: undefined,
          example: undefined,
          difficulty: undefined,
          category: '기적의파닉스1권'
        },
        {
          id: 'sample_2',
          english: GoogleSheetsService.removePartOfSpeech('beautiful adj.'),
          korean: '아름다운',
          pronunciation: undefined,
          example: undefined,
          difficulty: undefined,
          category: '기적의파닉스2권'
        },
        {
          id: 'sample_3',
          english: GoogleSheetsService.removePartOfSpeech('challenge noun'),
          korean: '도전',
          pronunciation: undefined,
          example: undefined,
          difficulty: undefined,
          category: '기적의파닉스1권'
        },
        {
          id: 'sample_4',
          english: GoogleSheetsService.removePartOfSpeech('adventure'),
          korean: '모험',
          pronunciation: undefined,
          example: undefined,
          difficulty: undefined,
          category: '기적의파닉스3권'
        }
      ];
      
      // 출처별 필터링 (복수 선택 지원)
      let filteredSampleWords = sampleWords;
      if (!sourcesArray.includes('전체')) {
        filteredSampleWords = sampleWords.filter(word => 
          word.category && sourcesArray.includes(word.category)
        );
      }
      
      setWords(filteredSampleWords);
      setError('구글 시트에 접근할 수 없습니다. 구글 시트 공개 설정을 확인해주세요.');
      // 카테고리 화면을 유지하기 위해 모드 변경 제거
    } finally {
      setIsLoading(false);
    }
  };

  const handleWordSelect = (word: Word) => {
    setSelectedWord(word);
  };


  // 단어 직접 입력 기능 제거됨

  const handleBackToWordList = () => {
    setMode('wordList');
    setSelectedWord(null);
  };

  // 출처 선택 화면으로 돌아가는 핸들러는 현재 사용하지 않음(버튼 제거됨)

  const handleRetry = () => {
    if (selectedSources.length > 0) {
      loadWords(selectedSources);
    } else {
      setMode('sourceSelection');
    }
  };

  // 로딩 중이거나 에러가 있을 때는 메인 화면에서 처리

  // 단어 직접 입력 기능 제거됨

  // 단어 하나씩 보기 기능 제거됨

  // singleWord mode removed

  // 메인 카테고리 선택 화면
  if (mode === 'sourceSelection') {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <div className="header-main">
              <h1>🌍 세계 여행을 위한<br />{currentUserName}의 영어 공부</h1>
              {/* 중앙 컨트롤 영역 */}
              <div className="header-controls">
                <div className="user-switch">
                  <button
                    className={currentUserName === '열음이' ? 'active' : ''}
                    onClick={() => { setCurrentUserByName('열음이'); setCurrentUserName('열음이'); }}
                  >
                    열음이
                  </button>
                  <button
                    className={currentUserName === '지음이' ? 'active' : ''}
                    onClick={() => { setCurrentUserByName('지음이'); setCurrentUserName('지음이'); }}
                  >
                    지음이
                  </button>
                </div>
              <button className="back-to-source-button" onClick={() => setMode('dashboard')}>📊 내 점수</button>
              <button className="back-to-source-button" onClick={() => setMode('ranking')} style={{ marginLeft: 8 }}>🏆 순위</button>
              <div style={{ position: 'relative', display: 'inline-block', marginLeft: 8 }}>
                <button className="back-to-source-button" onClick={() => setShowTtsSettings(s => !s)}>⚙️ 발음 설정</button>
                {showTtsSettings && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    zIndex: 1000,
                    marginTop: 8,
                    backgroundColor: '#fafafa',
                    border: '1px solid #e0e0e0',
                    borderRadius: 12,
                    padding: 12,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                  }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ minWidth: 60 }}>속도</span>
                        <input
                          type="range"
                          min={0.5}
                          max={1.5}
                          step={0.1}
                          value={ttsRate}
                          onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                        />
                        <span>{ttsRate.toFixed(1)}x</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ minWidth: 60 }}>악센트</span>
                        <select
                          value={ttsAccent}
                          onChange={(e) => setTtsAccent(e.target.value as 'us' | 'uk')}
                          style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd' }}
                        >
                          <option value="us">미국식</option>
                          <option value="uk">영국식</option>
                        </select>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ minWidth: 60 }}>성우</span>
                        <select
                          value={ttsGender}
                          onChange={(e) => setTtsGender(e.target.value as any)}
                          style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd' }}
                        >
                          <option value="default">기본</option>
                          <option value="male">남성</option>
                          <option value="female">여성</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowTtsSettings(false)}
                          style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
                        >
                          확인
                        </button>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
            <div className="header-actions" />
          </div>
          {/* 출처/단어 수 배지 제거 */}
        </header>

        <main className="app-main">
          {/* 출처 선택 버튼들 (복수 선택 가능) */}
          <div className="source-filter-buttons">
            <h3>📚 교재 선택 {selectedSources.length > 1 && <span style={{ fontSize: '14px', color: '#666' }}>({selectedSources.length}개 선택됨)</span>}</h3>
            <div className="source-filter-container">
              <button 
                className={`source-filter-button ${selectedSources.includes('전체') ? 'active' : ''}`}
                onClick={() => toggleSource('전체')}
                disabled={isLoading}
              >
                전체
              </button>
              <button 
                className={`source-filter-button ${selectedSources.includes('기적의파닉스1권') ? 'active' : ''}`}
                onClick={() => toggleSource('기적의파닉스1권')}
                disabled={isLoading}
              >
                기적의파닉스1권
              </button>
              <button 
                className={`source-filter-button ${selectedSources.includes('기적의파닉스2권') ? 'active' : ''}`}
                onClick={() => toggleSource('기적의파닉스2권')}
                disabled={isLoading}
              >
                기적의파닉스2권
              </button>
              <button 
                className={`source-filter-button ${selectedSources.includes('기적의파닉스3권') ? 'active' : ''}`}
                onClick={() => toggleSource('기적의파닉스3권')}
                disabled={isLoading}
              >
                기적의파닉스3권
              </button>
            </div>
          </div>

          {/* 카테고리 선택이 없으면 메인 카테고리 4개만 표시 */}
          {!selectedCategory ? (
            <div className="main-categories">
              <div className="category-grid">
                <div 
                  className="category-card"
                  onClick={() => setSelectedCategory('basic')}
                  style={{ backgroundColor: '#4CAF50' }}
                >
                  <div className="category-icon">📚</div>
                  <div className="category-title">기본 학습</div>
                  <div className="category-subtitle">발음 연습 · 단어 목록</div>
                </div>
                
                <div 
                  className="category-card"
                  onClick={() => setSelectedCategory('quiz')}
                  style={{ backgroundColor: '#2196F3' }}
                >
                  <div className="category-icon">🎯</div>
                  <div className="category-title">퀴즈</div>
                  <div className="category-subtitle">7가지 퀴즈 모드</div>
                </div>
                
                <div 
                  className="category-card"
                  onClick={() => setSelectedCategory('game')}
                  style={{ backgroundColor: '#FF9800' }}
                >
                  <div className="category-icon">🎮</div>
                  <div className="category-title">게임</div>
                  <div className="category-subtitle">화성 침공 방어</div>
                </div>
                
                <div 
                  className="category-card"
                  onClick={() => setSelectedCategory('combined')}
                  style={{ backgroundColor: '#9C27B0' }}
                >
                  <div className="category-icon">🏆</div>
                  <div className="category-title">종합</div>
                  <div className="category-subtitle">종합 퀴즈</div>
                </div>
              </div>
            </div>
          ) : (
            /* 카테고리별 세부 메뉴 */
            <div className="category-detail">
              <button 
                className="back-button"
                onClick={() => setSelectedCategory(null)}
                style={{
                  padding: '10px 20px',
                  marginBottom: '20px',
                  backgroundColor: '#757575',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ← 돌아가기
              </button>
              
              {selectedCategory === 'basic' && (
                <div className="basic-category">
                  <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#4CAF50' }}>📚 기본 학습</h3>
                  <div className="action-buttons">
                    <button 
                      className="quiz-button"
                      onClick={() => setMode('pronunciation')}
                      disabled={words.length < 1}
                    >
                      🎤 발음 연습하기
                    </button>
                  </div>
                  
                  {/* 단어 목록은 기본 학습에서만 표시 */}
                  {words.length > 0 && (
                    <div style={{ marginTop: '30px' }}>
                      <WordList
                        words={words}
                        onWordSelect={handleWordSelect}
                        selectedWord={selectedWord || undefined}
                      />
                    </div>
                  )}
                </div>
              )}
              
              {selectedCategory === 'quiz' && (
                <div className="quiz-category">
                  <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#2196F3' }}>🎯 퀴즈</h3>
                  <div className="action-buttons">
                    <button 
                      className="quiz-button"
                      onClick={() => setMode('imageQuiz')}
                      disabled={words.length < 4}
                    >
                      🖼️ 그림 퀴즈
                    </button>
                    <button 
                      className="quiz-button"
                      onClick={() => setMode('spellingQuiz')}
                      disabled={words.length < 4}
                    >
                      🔤 철자 퀴즈
                    </button>
                    <button 
                      className="quiz-button"
                      onClick={() => setMode('meaningQuiz')}
                      disabled={words.length < 4}
                    >
                      🇰🇷 뜻 퀴즈
                    </button>
                    <button 
                      className="quiz-button"
                      onClick={() => setMode('listeningQuiz')}
                      disabled={words.length < 4}
                    >
                      🎧 듣기 퀴즈
                    </button>
                    <button 
                      className="quiz-button"
                      onClick={() => setMode('spellingGame')}
                      disabled={words.length < 4}
                    >
                      🧩 철자 조합
                    </button>
                    <button 
                      className="quiz-button"
                      onClick={() => setMode('fillBlankGame')}
                      disabled={words.length < 4}
                    >
                      📝 빈칸 채우기
                    </button>
                    <button 
                      className="quiz-button"
                      onClick={() => setMode('sentenceGame')}
                      disabled={words.length < 4}
                    >
                      📖 문장 만들기
                    </button>
                  </div>
                </div>
              )}
              
              {selectedCategory === 'game' && (
                <div className="game-category">
                  <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#FF9800' }}>🎮 게임</h3>
                  <div className="action-buttons">
                    <button 
                      className="quiz-button"
                      onClick={() => setMode('fallingQuiz')}
                      disabled={words.length < 4}
                    >
                      🚀 화성 침공 방어
                    </button>
                  </div>
                </div>
              )}
              
              {selectedCategory === 'combined' && (
                <div className="combined-category">
                  <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#9C27B0' }}>🏆 종합</h3>
                  <div className="action-buttons">
                    <button 
                      className="quiz-button highlight"
                      onClick={() => setMode('combinedQuiz')}
                      disabled={words.length < 4}
                    >
                      🧩 종합 퀴즈
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 전역 TTS 설정 바는 헤더 버튼 아래에 렌더링됨 */}

          {error && (
            <div className="error-message">
              <p>❌ {error}</p>
              <div className="error-help">
                <h4>💡 해결 방법:</h4>
                <ol>
                  <li>구글 시트가 <strong>공개 설정</strong>되어 있는지 확인하세요
                    <br />→ 구글 시트 → 공유 → "링크가 있는 모든 사용자" 선택</li>
                  <li>.env 파일에 올바른 시트 ID가 설정되어 있는지 확인하세요
                    <br />→ REACT_APP_GOOGLE_SHEET_ID=your_sheet_id_here</li>
                  <li>서버를 재시작하세요 (Ctrl+C 후 npm start)</li>
                </ol>
              </div>
              <button className="retry-button" onClick={handleRetry}>
                🔄 다시 시도
              </button>
            </div>
          )}

          {isLoading && (
            <div className="loading-message">
              <h3>🔄 구글 시트에서 단어를 가져오는 중...</h3>
              <p>잠시만 기다려주세요.</p>
            </div>
          )}
        </main>

        <footer className="app-footer">
          <p>💡 팁: 단어를 클릭하여 선택한 후 발음 연습을 시작하세요!</p>
          <p>구글 시트에 단어 데이터를 추가하면 더 많은 단어를 학습할 수 있습니다.</p>
        </footer>
      </div>
    );
  }

  if (mode === 'pronunciation') {
    return <PronunciationQuiz words={words} onBack={handleBackToWordList} />;
  }

  if (mode === 'imageQuiz') {
    return <ImageQuiz words={words} onBack={handleBackToWordList} />;
  }

  if (mode === 'spellingQuiz') {
    return <SpellingQuiz words={words} onBack={handleBackToWordList} />;
  }

  if (mode === 'meaningQuiz') {
    return <MeaningQuiz words={words} onBack={handleBackToWordList} />;
  }

  if (mode === 'combinedQuiz') {
    return <CombinedQuiz words={words} onBack={handleBackToWordList} />;
  }
  if (mode === 'fallingQuiz') {
    return <FallingQuiz words={words} onBack={handleBackToWordList} />;
  }
  if (mode === 'listeningQuiz') {
    return <ListeningQuiz words={words} onBack={handleBackToWordList} />;
  }

  if (mode === 'spellingGame') {
    return <SpellingGame words={words} onBack={handleBackToWordList} />;
  }

  if (mode === 'fillBlankGame') {
    return <FillBlankGame words={words} onBack={handleBackToWordList} />;
  }

  if (mode === 'sentenceGame') {
    return <SentenceGame words={words} onBack={handleBackToWordList} />;
  }

  if (mode === 'dashboard') {
    return <Dashboard onBack={handleBackToWordList} />;
  }

  if (mode === 'ranking') {
    return <Ranking onBack={handleBackToWordList} />;
  }

  // 사용자 선택 전용 화면
  if (mode === 'userSelection') {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <div className="header-main" style={{ width: '100%' }}>
              <h1>🌍 세계 여행을 위한<br />{currentUserName}의 영어 공부</h1>
              <div className="header-controls" style={{ marginTop: 24 }}>
                <div className="user-switch">
                <button
                  className={currentUserName === '열음이' ? 'active' : ''}
                  onClick={() => { setCurrentUserByName('열음이'); setCurrentUserName('열음이'); setMode('sourceSelection'); }}
                >
                  열음이
                </button>
                <button
                  className={currentUserName === '지음이' ? 'active' : ''}
                  onClick={() => { setCurrentUserByName('지음이'); setCurrentUserName('지음이'); setMode('sourceSelection'); }}
                >
                  지음이
                </button>
                </div>
              </div>
            </div>
            <div className="header-actions" />
          </div>
        </header>
      </div>
    );
  }

  

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="header-main">
            <h1>🌍 세계 여행을 위한<br />{currentUserName}의 영어 공부</h1>
            {/* 중앙 컨트롤 영역 */}
            <div className="header-controls">
              <div className="user-switch">
                <button
                  className={currentUserName === '열음이' ? 'active' : ''}
                  onClick={() => { setCurrentUserByName('열음이'); setCurrentUserName('열음이'); }}
                >
                  열음이
                </button>
                <button
                  className={currentUserName === '지음이' ? 'active' : ''}
                  onClick={() => { setCurrentUserByName('지음이'); setCurrentUserName('지음이'); }}
                >
                  지음이
                </button>
              </div>
            <button className="back-to-source-button" onClick={() => setMode('dashboard')}>📊 내 점수</button>
            <button className="back-to-source-button" onClick={() => setMode('ranking')} style={{ marginLeft: 8 }}>🏆 순위</button>
            <div style={{ position: 'relative', display: 'inline-block', marginLeft: 8 }}>
              <button className="back-to-source-button" onClick={() => setShowTtsSettings(s => !s)}>⚙️ 발음 설정</button>
              {showTtsSettings && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 1000,
                  marginTop: 8,
                  backgroundColor: '#fafafa',
                  border: '1px solid #e0e0e0',
                  borderRadius: 12,
                  padding: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ minWidth: 60 }}>속도</span>
                      <input
                        type="range"
                        min={0.5}
                        max={1.5}
                        step={0.1}
                        value={ttsRate}
                        onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                      />
                      <span>{ttsRate.toFixed(1)}x</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ minWidth: 60 }}>악센트</span>
                      <select
                        value={ttsAccent}
                        onChange={(e) => setTtsAccent(e.target.value as 'us' | 'uk')}
                        style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd' }}
                      >
                        <option value="us">미국식</option>
                        <option value="uk">영국식</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ minWidth: 60 }}>성우</span>
                      <select
                        value={ttsGender}
                        onChange={(e) => setTtsGender(e.target.value as any)}
                        style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd' }}
                      >
                        <option value="default">기본</option>
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowTtsSettings(false)}
                        style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
                      >
                        확인
                      </button>
                    </label>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
          <div className="header-actions" />
        </div>
        {/* 출처/단어 수 배지 제거 */}
      </header>

      <main className="app-main">
        {/* 카테고리 선택이 없으면 메인 카테고리 4개만 표시 */}
        {!selectedCategory ? (
          <div className="main-categories">
            <div className="category-grid">
              <div 
                className="category-card"
                onClick={() => setSelectedCategory('basic')}
                style={{ backgroundColor: '#4CAF50' }}
              >
                <div className="category-icon">📚</div>
                <div className="category-title">기본 학습</div>
                <div className="category-subtitle">발음 연습 · 단어 목록</div>
              </div>
              
              <div 
                className="category-card"
                onClick={() => setSelectedCategory('quiz')}
                style={{ backgroundColor: '#2196F3' }}
              >
                <div className="category-icon">🎯</div>
                <div className="category-title">퀴즈</div>
                <div className="category-subtitle">7가지 퀴즈 모드</div>
              </div>
              
              <div 
                className="category-card"
                onClick={() => setSelectedCategory('game')}
                style={{ backgroundColor: '#FF9800' }}
              >
                <div className="category-icon">🎮</div>
                <div className="category-title">게임</div>
                <div className="category-subtitle">화성 침공 방어</div>
              </div>
              
              <div 
                className="category-card"
                onClick={() => setSelectedCategory('combined')}
                style={{ backgroundColor: '#9C27B0' }}
              >
                <div className="category-icon">🏆</div>
                <div className="category-title">종합</div>
                <div className="category-subtitle">종합 퀴즈</div>
              </div>
            </div>
          </div>
        ) : (
          /* 카테고리별 세부 메뉴 */
          <div className="category-detail">
            <button 
              className="back-button"
              onClick={() => setSelectedCategory(null)}
              style={{
                padding: '10px 20px',
                marginBottom: '20px',
                backgroundColor: '#757575',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ← 돌아가기
            </button>
            
            {/* 출처 선택 버튼들 (카테고리 선택 시에만 표시) */}
            <div className="source-filter-buttons" style={{ marginBottom: '20px' }}>
              <h3>📚 교재 선택 {selectedSources.length > 1 && <span style={{ fontSize: '14px', color: '#666' }}>({selectedSources.length}개 선택됨)</span>}</h3>
              <div className="source-filter-container">
                <button 
                  className={`source-filter-button ${selectedSources.includes('전체') ? 'active' : ''}`}
                  onClick={() => toggleSource('전체')}
                  disabled={isLoading}
                >
                  전체
                </button>
                <button 
                  className={`source-filter-button ${selectedSources.includes('기적의파닉스1권') ? 'active' : ''}`}
                  onClick={() => toggleSource('기적의파닉스1권')}
                  disabled={isLoading}
                >
                  기적의파닉스1권
                </button>
                <button 
                  className={`source-filter-button ${selectedSources.includes('기적의파닉스2권') ? 'active' : ''}`}
                  onClick={() => toggleSource('기적의파닉스2권')}
                  disabled={isLoading}
                >
                  기적의파닉스2권
                </button>
                <button 
                  className={`source-filter-button ${selectedSources.includes('기적의파닉스3권') ? 'active' : ''}`}
                  onClick={() => toggleSource('기적의파닉스3권')}
                  disabled={isLoading}
                >
                  기적의파닉스3권
                </button>
              </div>
            </div>
            
            {selectedCategory === 'basic' && (
              <div className="basic-category">
                <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#4CAF50' }}>📚 기본 학습</h3>
                <div className="action-buttons">
                  <button 
                    className="quiz-button"
                    onClick={() => setMode('pronunciation')}
                    disabled={words.length < 1}
                  >
                    🎤 발음 연습하기
                  </button>
                </div>
                
                {/* 단어 목록은 기본 학습에서만 표시 */}
                {words.length > 0 && (
                  <div style={{ marginTop: '30px' }}>
                    <WordList
                      words={words}
                      onWordSelect={handleWordSelect}
                      selectedWord={selectedWord || undefined}
                    />
                  </div>
                )}
              </div>
            )}
            
            {selectedCategory === 'quiz' && (
              <div className="quiz-category">
                <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#2196F3' }}>🎯 퀴즈</h3>
                <div className="action-buttons">
                  <button 
                    className="quiz-button"
                    onClick={() => setMode('imageQuiz')}
                    disabled={words.length < 4}
                  >
                    🖼️ 그림 퀴즈
                  </button>
                  <button 
                    className="quiz-button"
                    onClick={() => setMode('spellingQuiz')}
                    disabled={words.length < 4}
                  >
                    🔤 철자 퀴즈
                  </button>
                  <button 
                    className="quiz-button"
                    onClick={() => setMode('meaningQuiz')}
                    disabled={words.length < 4}
                  >
                    🇰🇷 뜻 퀴즈
                  </button>
                  <button 
                    className="quiz-button"
                    onClick={() => setMode('listeningQuiz')}
                    disabled={words.length < 4}
                  >
                    🎧 듣기 퀴즈
                  </button>
                  <button 
                    className="quiz-button"
                    onClick={() => setMode('spellingGame')}
                    disabled={words.length < 4}
                  >
                    🧩 철자 조합
                  </button>
                  <button 
                    className="quiz-button"
                    onClick={() => setMode('fillBlankGame')}
                    disabled={words.length < 4}
                  >
                    📝 빈칸 채우기
                  </button>
                  <button 
                    className="quiz-button"
                    onClick={() => setMode('sentenceGame')}
                    disabled={words.length < 4}
                  >
                    📖 문장 만들기
                  </button>
                </div>
              </div>
            )}
            
            {selectedCategory === 'game' && (
              <div className="game-category">
                <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#FF9800' }}>🎮 게임</h3>
                <div className="action-buttons">
                  <button 
                    className="quiz-button"
                    onClick={() => setMode('fallingQuiz')}
                    disabled={words.length < 4}
                  >
                    🚀 화성 침공 방어
                  </button>
                </div>
              </div>
            )}
            
            {selectedCategory === 'combined' && (
              <div className="combined-category">
                <h3 style={{ textAlign: 'center', marginBottom: '30px', color: '#9C27B0' }}>🏆 종합</h3>
                <div className="action-buttons">
                  <button 
                    className="quiz-button highlight"
                    onClick={() => setMode('combinedQuiz')}
                    disabled={words.length < 4}
                  >
                    🧩 종합 퀴즈
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>❌ {error}</p>
            <div className="error-help">
              <h4>💡 해결 방법:</h4>
              <ol>
                <li>구글 시트가 <strong>공개 설정</strong>되어 있는지 확인하세요
                  <br />→ 구글 시트 → 공유 → "링크가 있는 모든 사용자" 선택</li>
                <li>.env 파일에 올바른 시트 ID가 설정되어 있는지 확인하세요
                  <br />→ REACT_APP_GOOGLE_SHEET_ID=your_sheet_id_here</li>
                <li>서버를 재시작하세요 (Ctrl+C 후 npm start)</li>
              </ol>
            </div>
            <button className="retry-button" onClick={handleRetry}>
              🔄 다시 시도
            </button>
          </div>
        )}

        {isLoading && (
          <div className="loading-message">
            <h3>🔄 구글 시트에서 단어를 가져오는 중...</h3>
            <p>잠시만 기다려주세요.</p>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>💡 팁: 원하는 카테고리를 선택하여 학습을 시작하세요!</p>
        <p>구글 시트에 단어 데이터를 추가하면 더 많은 단어를 학습할 수 있습니다.</p>
      </footer>
    </div>
  );
}

export default App;
