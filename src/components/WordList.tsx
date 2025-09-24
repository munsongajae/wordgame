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
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(english);
        utter.lang = 'en-US';
        utter.rate = 0.8;
        utter.pitch = 1;
        window.speechSynthesis.speak(utter);
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
      case 'medium': return '보통';
      case 'hard': return '어려움';
      default: return '미분류';
    }
  };

  return (
    <div className="word-list-container">
      <h2>단어 목록 ({words.length}개)</h2>
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
            <div className="word-details">
              {word.pronunciation && (
                <div className="word-pronunciation">
                  /{word.pronunciation}/
                </div>
              )}
              <div 
                className="word-difficulty"
                style={{ backgroundColor: getDifficultyColor(word.difficulty || 'medium') }}
              >
                {getDifficultyText(word.difficulty || 'medium')}
              </div>
            </div>
            
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
