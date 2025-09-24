import React, { useState } from 'react';
import WordList from './components/WordList';
import PronunciationQuiz from './components/PronunciationQuiz';
import ImageQuiz from './components/ImageQuiz';
import SpellingQuiz from './components/SpellingQuiz';
import MeaningQuiz from './components/MeaningQuiz';
import { Word } from './types/word';
import { GoogleSheetsService } from './services/googleSheetsService';
import './App.css';

type AppMode = 'wordList' | 'pronunciation' | 'imageQuiz' | 'spellingQuiz' | 'meaningQuiz';

function App() {
  const [words, setWords] = useState<Word[]>([]);
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [mode, setMode] = useState<AppMode>('wordList');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWords = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 환경 변수 확인
      const sheetId = process.env.REACT_APP_GOOGLE_SHEET_ID;
      console.log('🔍 환경 변수 확인:', {
        sheetId: sheetId || '설정되지 않음',
        hasEnvFile: !!sheetId
      });
      
      if (!sheetId) {
        setError('.env 파일에 REACT_APP_GOOGLE_SHEET_ID가 설정되지 않았습니다.');
        return;
      }
      
      const fetchedWords = await GoogleSheetsService.fetchWords();
      
      // 구글 시트에서 데이터를 성공적으로 가져왔는지 확인
      if (fetchedWords.length > 0) {
        console.log('✅ 구글 시트에서 단어 로드 성공:', fetchedWords.length + '개');
        setWords(fetchedWords);
      } else {
        console.warn('⚠️ 구글 시트에 데이터가 없습니다. 샘플 데이터를 사용합니다.');
        // 샘플 데이터 사용
        const sampleWords = [
          {
            id: 'sample_1',
            english: 'apple',
            korean: '사과',
            pronunciation: '/ˈæpəl/',
            example: 'I eat an apple every day.',
            difficulty: 'easy' as const,
            category: 'food'
          },
          {
            id: 'sample_2',
            english: 'beautiful',
            korean: '아름다운',
            pronunciation: '/ˈbjuːtɪfəl/',
            example: 'The sunset is beautiful.',
            difficulty: 'medium' as const,
            category: 'adjective'
          },
          {
            id: 'sample_3',
            english: 'challenge',
            korean: '도전',
            pronunciation: '/ˈtʃælɪndʒ/',
            example: 'This is a great challenge for me.',
            difficulty: 'medium' as const,
            category: 'noun'
          }
        ];
        setWords(sampleWords);
      }
    } catch (err) {
      console.error('❌ 구글 시트 접근 실패:', err);
      console.log('🔄 샘플 데이터를 사용합니다.');
      
      // 오류 발생 시 샘플 데이터 사용
      const sampleWords = [
        {
          id: 'sample_1',
          english: 'apple',
          korean: '사과',
          pronunciation: '/ˈæpəl/',
          example: 'I eat an apple every day.',
          difficulty: 'easy' as const,
          category: 'food'
        },
        {
          id: 'sample_2',
          english: 'beautiful',
          korean: '아름다운',
          pronunciation: '/ˈbjuːtɪfəl/',
          example: 'The sunset is beautiful.',
          difficulty: 'medium' as const,
          category: 'adjective'
        },
        {
          id: 'sample_3',
          english: 'challenge',
          korean: '도전',
          pronunciation: '/ˈtʃælɪndʒ/',
          example: 'This is a great challenge for me.',
          difficulty: 'medium' as const,
          category: 'noun'
        }
      ];
        setWords(sampleWords);
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

  const handleRetry = () => {
    loadWords();
  };

  // 로딩 중이거나 에러가 있을 때는 메인 화면에서 처리

  // 단어 직접 입력 기능 제거됨

  // 단어 하나씩 보기 기능 제거됨

  // singleWord mode removed

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

  

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎓 영어 단어 익히기</h1>
        <p>제미나이 AI와 함께하는 영어 학습</p>
      </header>

      <main className="app-main">
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
        </div>

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

        {words.length > 0 ? (
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
            <p>구글 시트에서 단어를 가져오세요. 단어가 4개 이상이면 퀴즈를 시작할 수 있어요.</p>
            <div className="load-buttons">
              <button 
                className="load-google-sheet-button"
                onClick={loadWords}
                disabled={isLoading}
              >
                {isLoading ? '🔄 로딩 중...' : '📊 구글 시트에서 가져오기'}
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
