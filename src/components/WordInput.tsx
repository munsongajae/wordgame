import React, { useState } from 'react';
import { Word } from '../types/word';
import './WordInput.css';

interface WordInputProps {
  onWordsSubmit: (words: Word[]) => void;
  onBack: () => void;
}

const WordInput: React.FC<WordInputProps> = ({ onWordsSubmit, onBack }) => {
  const [words, setWords] = useState<Word[]>([
    { id: '1', english: '', korean: '', pronunciation: '', example: '', difficulty: 'medium', category: 'general' }
  ]);

  const addWord = () => {
    setWords([...words, { 
      id: (words.length + 1).toString(), 
      english: '', 
      korean: '', 
      pronunciation: '', 
      example: '', 
      difficulty: 'medium', 
      category: 'general' 
    }]);
  };

  const removeWord = (index: number) => {
    if (words.length > 1) {
      setWords(words.filter((_, i) => i !== index));
    }
  };

  const updateWord = (index: number, field: keyof Word, value: string) => {
    const updatedWords = words.map((word, i) => 
      i === index ? { ...word, [field]: value } : word
    );
    setWords(updatedWords);
  };

  const handleSubmit = () => {
    const validWords = words.filter(word => word.english.trim() && word.korean.trim());
    if (validWords.length === 0) {
      alert('최소 하나의 단어를 입력해주세요.');
      return;
    }
    onWordsSubmit(validWords);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        alert('클립보드에 데이터가 없습니다.');
        return;
      }

      console.log('📋 클립보드 데이터:', text);
      console.log('📄 라인 수:', lines.length);

      const newWords: Word[] = [];
      lines.forEach((line, index) => {
        console.log(`🔍 라인 ${index + 1} 파싱:`, line);
        
        // 구글 시트에서 복사한 데이터는 보통 탭으로 구분됨
        let columns = line.split('\t');
        
        // 탭이 없으면 쉼표로 시도
        if (columns.length === 1) {
          columns = line.split(',');
        }
        
        console.log(`📝 파싱된 컬럼들:`, columns);
        
        if (columns.length >= 2 && columns[0].trim() && columns[1].trim()) {
          const word = {
            id: (index + 1).toString(),
            english: columns[0]?.trim() || '',
            korean: columns[1]?.trim() || '',
            pronunciation: columns[2]?.trim() || '',
            example: columns[3]?.trim() || '',
            difficulty: (columns[4]?.trim() as 'easy' | 'medium' | 'hard') || 'medium',
            category: columns[5]?.trim() || 'general'
          };
          newWords.push(word);
          console.log(`✅ 단어 추가됨:`, word);
        } else {
          console.log(`⚠️ 라인 ${index + 1} 건너뜀 - 유효하지 않은 데이터`);
        }
      });

      if (newWords.length > 0) {
        setWords(newWords);
        alert(`✅ ${newWords.length}개의 단어를 불러왔습니다!\n\n첫 번째 단어: ${newWords[0].english} - ${newWords[0].korean}`);
      } else {
        alert('⚠️ 유효한 데이터를 찾을 수 없습니다.\n\n구글 시트에서 다음과 같이 복사해주세요:\n영어단어\t한국어뜻\t발음기호\t예문');
      }
    } catch (error) {
      console.error('클립보드 읽기 실패:', error);
      alert('❌ 클립보드 읽기에 실패했습니다.\n브라우저에서 클립보드 접근을 허용해주세요.');
    }
  };

  return (
    <div className="word-input-container">
      <header className="word-input-header">
        <button className="back-button" onClick={onBack}>
          ⬅️ 메인으로
        </button>
        <h2>📝 단어 직접 입력</h2>
      </header>

      <div className="input-instructions">
        <h3>💡 사용 방법</h3>
        <ul>
          <li>아래 입력란에 영어 단어와 한국어 뜻을 직접 입력하거나</li>
          <li>구글 시트에서 데이터를 복사해서 붙여넣기 할 수 있습니다</li>
          <li>최소 영어 단어와 한국어 뜻은 필수입니다</li>
        </ul>
        
        <div className="paste-section">
          <button className="paste-button" onClick={pasteFromClipboard}>
            📋 구글 시트에서 붙여넣기
          </button>
          <div className="paste-help">
            <strong>📝 구글 시트 복사 방법:</strong><br/>
            1. 구글 시트에서 단어 데이터 선택 (A열부터)<br/>
            2. Ctrl+C (또는 Cmd+C)로 복사<br/>
            3. 위 버튼 클릭하여 붙여넣기
          </div>
        </div>
      </div>

      <div className="words-list">
        {words.map((word, index) => (
          <div key={word.id} className="word-input-item">
            <div className="word-input-header-row">
              <span className="word-number">#{index + 1}</span>
              <button 
                className="remove-word-button"
                onClick={() => removeWord(index)}
                disabled={words.length === 1}
              >
                ❌
              </button>
            </div>
            
            <div className="word-input-fields">
              <div className="input-group">
                <label>영어 단어 *</label>
                <input
                  type="text"
                  value={word.english}
                  onChange={(e) => updateWord(index, 'english', e.target.value)}
                  placeholder="예: apple"
                />
              </div>
              
              <div className="input-group">
                <label>한국어 뜻 *</label>
                <input
                  type="text"
                  value={word.korean}
                  onChange={(e) => updateWord(index, 'korean', e.target.value)}
                  placeholder="예: 사과"
                />
              </div>
              
              <div className="input-group">
                <label>발음기호</label>
                <input
                  type="text"
                  value={word.pronunciation}
                  onChange={(e) => updateWord(index, 'pronunciation', e.target.value)}
                  placeholder="예: /ˈæpəl/"
                />
              </div>
              
              <div className="input-group">
                <label>예문</label>
                <input
                  type="text"
                  value={word.example}
                  onChange={(e) => updateWord(index, 'example', e.target.value)}
                  placeholder="예: I eat an apple every day."
                />
              </div>
              
              <div className="input-group">
                <label>난이도</label>
                <select
                  value={word.difficulty}
                  onChange={(e) => updateWord(index, 'difficulty', e.target.value)}
                >
                  <option value="easy">쉬움</option>
                  <option value="medium">보통</option>
                  <option value="hard">어려움</option>
                </select>
              </div>
              
              <div className="input-group">
                <label>카테고리</label>
                <input
                  type="text"
                  value={word.category}
                  onChange={(e) => updateWord(index, 'category', e.target.value)}
                  placeholder="예: food, adjective"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="word-input-actions">
        <button className="add-word-button" onClick={addWord}>
          ➕ 단어 추가
        </button>
        <button className="submit-words-button" onClick={handleSubmit}>
          ✅ 단어 저장하고 시작
        </button>
      </div>
    </div>
  );
};

export default WordInput;
