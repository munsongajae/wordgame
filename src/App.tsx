import React, { useState, useEffect } from 'react';
import WordList from './components/WordList';
import PronunciationQuiz from './components/PronunciationQuiz';
import Dashboard from './components/Dashboard';
import ImageQuiz from './components/ImageQuiz';
import SpellingQuiz from './components/SpellingQuiz';
import MeaningQuiz from './components/MeaningQuiz';
import CombinedQuiz from './components/CombinedQuiz';
import Ranking from './components/Ranking';
import { Word } from './types/word';
import { GoogleSheetsService } from './services/googleSheetsService';
import './App.css';
import { getCurrentUserName, setCurrentUserByName } from './services/supabaseClient';

type AppMode = 'sourceSelection' | 'wordList' | 'pronunciation' | 'imageQuiz' | 'spellingQuiz' | 'meaningQuiz';
type AppModeExtended = AppMode | 'dashboard' | 'userSelection' | 'combinedQuiz' | 'ranking';

function App() {
  const [words, setWords] = useState<Word[]>([]);
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [mode, setMode] = useState<AppModeExtended>('userSelection');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('전체');
  const [currentUserName, setCurrentUserName] = useState<'열음이' | '지음이'>(getCurrentUserName());
  const [showTtsSettings, setShowTtsSettings] = useState(false);
  const [ttsRate, setTtsRate] = useState<number>(1.0);
  const [ttsGender, setTtsGender] = useState<'default' | 'male' | 'female'>('default');
  const [ttsAccent, setTtsAccent] = useState<'us' | 'uk'>('us');

  // 앱 시작 시 전체 데이터 자동 로드
  useEffect(() => {
    loadWords('전체');
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

  // 출처 선택 후 단어 로드
  const loadWordsBySource = async (source: string) => {
    setSelectedSource(source);
    await loadWords(source);
  };

  const loadWords = async (source?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 환경 변수 확인
      const sheetId = process.env.REACT_APP_GOOGLE_SHEET_ID;
      console.log('🔍 환경 변수 확인:', {
        sheetId: sheetId || '설정되지 않음',
        hasEnvFile: !!sheetId,
        selectedSource: source
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
        console.log('🎯 선택된 출처:', source);
        console.log('📊 전체 단어 수:', fetchedWords.length);
        console.log('📝 첫 3개 단어 샘플:', fetchedWords.slice(0, 3));
        
        // 출처별 필터링
        let filteredWords = fetchedWords;
        if (source && source !== '전체') {
          filteredWords = fetchedWords.filter(word => 
            word.category && word.category === source
          );
          console.log(`🔍 필터링 결과: ${filteredWords.length}개 단어 (검색어: "${source}")`);
        }
        
        console.log(`✅ 구글 시트에서 단어 로드 성공: ${filteredWords.length}개 (전체: ${fetchedWords.length}개, 출처: ${source || '전체'})`);
        setWords(filteredWords);
        setMode('wordList'); // 단어 목록 화면으로 이동
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
        
        // 출처별 필터링
        let filteredSampleWords = sampleWords;
        if (source && source !== '전체') {
          filteredSampleWords = sampleWords.filter(word => 
            word.category && word.category === source
          );
        }
        
        setWords(filteredSampleWords);
        setMode('wordList');
      }
    } catch (err) {
      console.error('❌ 구글 시트 접근 실패:', err);
      console.log('🔄 샘플 데이터를 사용합니다.');
      
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
      
      // 출처별 필터링
      let filteredSampleWords = sampleWords;
      if (source && source !== '전체') {
        filteredSampleWords = sampleWords.filter(word => 
          word.category && word.category === source
        );
      }
      
      setWords(filteredSampleWords);
      setMode('wordList');
      setError('구글 시트에 접근할 수 없습니다. 구글 시트 공개 설정을 확인해주세요.');
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
    if (selectedSource) {
      loadWords(selectedSource);
    } else {
      setMode('sourceSelection');
    }
  };

  // 로딩 중이거나 에러가 있을 때는 메인 화면에서 처리

  // 단어 직접 입력 기능 제거됨

  // 단어 하나씩 보기 기능 제거됨

  // singleWord mode removed

  // 출처 선택 화면
  if (mode === 'sourceSelection') {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1>🌍 세계 여행을 위한<br />{currentUserName}의 영어 공부</h1>
        </header>

        <main className="app-main">
          <div className="source-selection">
            <h2>📚 학습할 단어 교재를 선택하세요</h2>

            
            <div className="source-buttons">
              <button 
                className="source-button"
                onClick={() => loadWordsBySource('전체')}
                disabled={isLoading}
              >
                <div className="source-icon">📚</div>
                <div className="source-title">전체</div>
              </button>
              
              <button 
                className="source-button"
                onClick={() => loadWordsBySource('기적의파닉스1권')}
                disabled={isLoading}
              >
                <div className="source-icon">📖</div>
                <div className="source-title">기적의 파닉스 1권</div>
              </button>
              
              <button 
                className="source-button"
                onClick={() => loadWordsBySource('기적의파닉스2권')}
                disabled={isLoading}
              >
                <div className="source-icon">📚</div>
                <div className="source-title">기적의 파닉스 2권</div>
              </button>
              
              <button 
                className="source-button"
                onClick={() => loadWordsBySource('기적의파닉스3권')}
                disabled={isLoading}
              >
                <div className="source-icon">📘</div>
                <div className="source-title">기적의 파닉스 3권</div>
              </button>
            </div>

            {isLoading && (
              <div className="loading-message">
                <h3>🔄 구글 시트에서 단어를 가져오는 중...</h3>
                <p>잠시만 기다려주세요.</p>
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
          </div>
        </main>

        <footer className="app-footer">
          <p>💡 팁: 구글 시트의 D열에 '기적의파닉스1권' 또는 '기적의파닉스2권'으로 분류된 단어만 불러옵니다.</p>
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
        {/* 출처 선택 버튼들 */}
        <div className="source-filter-buttons">
          <h3>📚 교재 선택</h3>
          <div className="source-filter-container">
            <button 
              className={`source-filter-button ${selectedSource === '전체' ? 'active' : ''}`}
              onClick={() => loadWordsBySource('전체')}
              disabled={isLoading}
            >
              전체
            </button>
            <button 
              className={`source-filter-button ${selectedSource === '기적의파닉스1권' ? 'active' : ''}`}
              onClick={() => loadWordsBySource('기적의파닉스1권')}
              disabled={isLoading}
            >
              기적의파닉스1권
            </button>
            <button 
              className={`source-filter-button ${selectedSource === '기적의파닉스2권' ? 'active' : ''}`}
              onClick={() => loadWordsBySource('기적의파닉스2권')}
              disabled={isLoading}
            >
              기적의파닉스2권
            </button>
            <button 
              className={`source-filter-button ${selectedSource === '기적의파닉스3권' ? 'active' : ''}`}
              onClick={() => loadWordsBySource('기적의파닉스3권')}
              disabled={isLoading}
            >
              기적의파닉스3권
            </button>
          </div>
        </div>

        <div className="action-buttons">
          <button 
            className="quiz-button"
            onClick={() => setMode('pronunciation')}
            disabled={words.length < 1}
          >
            🎤 발음 연습하기
          </button>
          <button 
            className="quiz-button"
            onClick={() => setMode('imageQuiz')}
            disabled={words.length < 4}
          >
            🖼️ 그림 보고 맞추기
          </button>
          <button 
            className="quiz-button"
            onClick={() => setMode('spellingQuiz')}
            disabled={words.length < 4}
          >
            🔤 철자 보고 맞추기
          </button>
          <button 
            className="quiz-button"
            onClick={() => setMode('meaningQuiz')}
            disabled={words.length < 4}
          >
            🇰🇷 뜻 보고 맞추기
          </button>
          <button 
            className="quiz-button"
            onClick={() => setMode('combinedQuiz')}
            disabled={words.length < 4}
          >
            🧩 종합 퀴즈
          </button>
        </div>

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

        {isLoading ? (
          <div className="loading-message">
            <h3>🔄 구글 시트에서 단어를 가져오는 중...</h3>
            <p>잠시만 기다려주세요.</p>
          </div>
        ) : words.length > 0 ? (
          <>
            <WordList
              words={words}
              onWordSelect={handleWordSelect}
              selectedWord={selectedWord || undefined}
            />
          </>
        ) : (
          <div className="no-words-message">
            <h3>📚 영어 단어 학습을 시작해보세요!</h3>
            <p>단어가 4개 이상이면 퀴즈를 시작할 수 있어요.</p>
            <div className="load-buttons">
              <button 
                className="load-google-sheet-button"
                onClick={() => handleRetry()}
                disabled={isLoading}
              >
                🔄 다시 시도
              </button>
            </div>
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

export default App;
