import React, { useState } from 'react';
import { Word } from '../types/word';
import './WordList.css';

interface WordListProps {
  words: Word[];
  onWordSelect: (word: Word) => void;
  selectedWord?: Word;
}

const WordList: React.FC<WordListProps> = ({ words, onWordSelect, selectedWord }) => {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handleImageError = (wordId: string) => {
    setImageErrors(prev => new Set(prev).add(wordId));
  };

  const speakWord = (english: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && english) {
      try {
        // 전역 설정 로드
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

        window.speechSynthesis.cancel();
        
        // 음성 목록을 다시 로드 (브라우저에 따라 필요)
        const loadVoices = () => {
          return new Promise<SpeechSynthesisVoice[]>((resolve) => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              resolve(voices);
            } else {
              window.speechSynthesis.onvoiceschanged = () => {
                resolve(window.speechSynthesis.getVoices());
              };
              // 타임아웃 설정
              setTimeout(() => resolve([]), 1000);
            }
          });
        };

        loadVoices().then(voices => {
          const utter = new SpeechSynthesisUtterance(english);
          utter.lang = accent === 'uk' ? 'en-GB' : 'en-US';
          utter.rate = rate;
          utter.pitch = gender === 'male' ? 0.8 : gender === 'female' ? 1.3 : 1.0;
          
          // 디버깅용: 사용 가능한 음성 목록 출력
          console.log('Available voices:', voices.map(v => ({ name: v.name, lang: v.lang, localService: v.localService })));
          
          if (voices.length > 0) {
            const preferLang = accent === 'uk' ? 'en-GB' : 'en-US';
            
            // 1순위: 정확한 언어 매칭
            let candidates = voices.filter(v => v.lang?.toLowerCase() === preferLang.toLowerCase());
            
            // 2순위: 언어 코드만 매칭 (en-US -> en)
            if (candidates.length === 0) {
              const langCode = preferLang.split('-')[0].toLowerCase();
              candidates = voices.filter(v => v.lang?.toLowerCase().startsWith(langCode));
            }
            
            // 3순위: 영어 계열 모두
            if (candidates.length === 0) {
              candidates = voices.filter(v => v.lang?.toLowerCase().includes('en'));
            }
            
            // 성별 필터 적용
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
              utter.voice = selectedVoice;
              console.log('Selected voice:', selectedVoice.name, selectedVoice.lang);
            }
          }
          
          window.speechSynthesis.speak(utter);
        }).catch(() => {
          // 폴백: 기본 설정으로 재생
          const utter = new SpeechSynthesisUtterance(english);
          utter.lang = accent === 'uk' ? 'en-GB' : 'en-US';
          utter.rate = rate;
          utter.pitch = gender === 'male' ? 0.8 : gender === 'female' ? 1.3 : 1.0;
          window.speechSynthesis.speak(utter);
        });
      } catch (e) {
        // no-op
      }
    }
  };
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'hard': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '쉬움';
      case 'medium': return '';
      case 'hard': return '어려움';
      default: return '미분류';
    }
  };

  return (
    <div className="word-list-container">
      <h2>단어 목록 ({words.length}개)</h2>
      <div
        style={{
          color: '#1a237e',
          fontSize: 16,
          fontWeight: 700,
          margin: '8px 0 12px 0',
          background: 'rgba(25,118,210,0.08)',
          padding: '8px 12px',
          borderRadius: 8,
          display: 'inline-block'
        }}
      >
        🔊 단어를 누르면 발음이 재생됩니다
      </div>
      <div className="word-list">
        {words.map((word) => (
          <div
            key={word.id}
            className={`word-item ${selectedWord?.id === word.id ? 'selected' : ''}`}
            onClick={() => { speakWord(word.english); onWordSelect(word); }}
          >
            {/* 그림을 먼저 표시 */}
            {word.imageUrl && !imageErrors.has(word.id) && (
              <div className="word-image-container">
                <img
                  src={word.imageUrl}
                  alt={word.english}
                  className="word-image"
                  onError={() => handleImageError(word.id)}
                />
              </div>
            )}
            
            {/* 텍스트 정보를 다음에 표시 */}
            <div className="word-main">
              <div className="word-english">{word.english}</div>
              <div className="word-korean">{word.korean}</div>
            </div>
            
            {/* 세부 정보를 마지막에 표시 */}
            <div className="word-details"></div>
            
            {/* 예문은 별도로 표시 */}
            {word.example && (
              <div className="word-example">
                "{word.example}"
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WordList;
