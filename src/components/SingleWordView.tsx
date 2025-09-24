import React, { useState } from 'react';
import { Word } from '../types/word';
import './SingleWordView.css';

interface SingleWordViewProps {
  words: Word[];
  onBack: () => void;
}

const SingleWordView: React.FC<SingleWordViewProps> = ({ words, onBack }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const currentWord = words[currentIndex];

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

  const handleNext = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % words.length);
  };

  const handlePrevious = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev - 1 + words.length) % words.length);
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  const speakWord = () => {
    if ('speechSynthesis' in window && currentWord) {
      const utterance = new SpeechSynthesisUtterance(currentWord.english);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  if (!currentWord) {
    return (
      <div className="single-word-container">
        <div className="no-words">
          <h2>📚 단어가 없습니다</h2>
          <p>구글 시트에 단어를 입력해주세요!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="single-word-container">
      <header className="single-word-header">
        <button className="back-button" onClick={onBack}>
          ⬅️ 메인으로
        </button>
        <h2>📚 단어 하나씩 학습</h2>
      </header>

      <div className="word-progress">
        <span className="progress-text">
          {currentIndex + 1} / {words.length}
        </span>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="word-card">
        <div className="word-header">
          <div className="word-english">{currentWord.english}</div>
          <div 
            className="word-difficulty"
            style={{ backgroundColor: getDifficultyColor(currentWord.difficulty || 'medium') }}
          >
            {getDifficultyText(currentWord.difficulty || 'medium')}
          </div>
        </div>

        <div className="word-content">
          {showAnswer ? (
            <div className="word-answer">
              <div className="word-korean">🇰🇷 {currentWord.korean}</div>
              {currentWord.pronunciation && (
                <div className="word-pronunciation">
                  🔊 /{currentWord.pronunciation}/
                </div>
              )}
              {currentWord.example && (
                <div className="word-example">
                  💬 "{currentWord.example}"
                </div>
              )}
              {currentWord.category && (
                <div className="word-category">
                  🏷️ {currentWord.category}
                </div>
              )}
            </div>
          ) : (
            <div className="word-question">
              <div className="question-text">이 단어의 뜻은 무엇일까요? 🤔</div>
              <button className="show-answer-button" onClick={handleShowAnswer}>
                답 보기 👀
              </button>
            </div>
          )}
        </div>

        <div className="word-actions">
          <button className="speak-button" onClick={speakWord}>
            🔊 발음 듣기
          </button>
        </div>
      </div>

      <div className="navigation-controls">
        <button 
          className="nav-button prev-button" 
          onClick={handlePrevious}
          disabled={words.length <= 1}
        >
          ⬅️ 이전
        </button>
        
        <button 
          className="nav-button next-button" 
          onClick={handleNext}
          disabled={words.length <= 1}
        >
          다음 ➡️
        </button>
      </div>

      <div className="study-tips">
        <h3>📖 학습 팁</h3>
        <ul>
          <li>먼저 단어를 보고 뜻을 생각해보세요</li>
          <li>발음을 듣고 따라해보세요</li>
          <li>예문을 통해 단어를 기억해보세요</li>
          
        </ul>
      </div>
    </div>
  );
};

export default SingleWordView;
