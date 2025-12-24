import React, { useState, useRef, useEffect } from 'react';
import { Word } from '../types/word';
import { PronunciationResult } from '../types/word';

import WordList from './WordList';
import './PronunciationPractice.css';

// 음성 인식 서비스
class SpeechRecognitionService {
  private recognition: any = null;
  private isSpeechSupported: boolean = false;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.isSpeechSupported = true;
      this.setupRecognition();
    } else {
      console.warn('음성 인식이 지원되지 않는 브라우저입니다.');
    }
  }

  private setupRecognition() {
    if (!this.recognition) return;
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;
  }

  public isSupported(): boolean {
    return this.isSpeechSupported;
  }

  async recognizeSpeech(): Promise<string> {
    if (!this.isSpeechSupported || !this.recognition) {
      throw new Error('음성 인식이 지원되지 않습니다.');
    }

    return new Promise((resolve, reject) => {
      let hasResult = false;

      this.recognition.onstart = () => {
        console.log('🎤 음성 인식 시작...');
      };

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('📝 인식된 텍스트:', transcript);
        hasResult = true;
        resolve(transcript);
      };

      this.recognition.onerror = (event: any) => {
        console.error('❌ 음성 인식 오류:', event.error);
        if (event.error === 'no-speech') {
          reject(new Error('음성이 감지되지 않았습니다.'));
        } else {
          reject(new Error(`음성 인식 오류: ${event.error}`));
        }
      };

      this.recognition.onend = () => {
        console.log('🔚 음성 인식 종료');
        if (!hasResult) {
          reject(new Error('음성 인식이 결과 없이 종료되었습니다.'));
        }
      };

      this.recognition.start();
    });
  }

  stopRecognition() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }
}

const speechRecognition = new SpeechRecognitionService();

interface PronunciationPracticeProps {
  word: Word | null;
  words: Word[];
  onBack: () => void;
}

const PronunciationPractice: React.FC<PronunciationPracticeProps> = ({ word, words, onBack }) => {
  const [selectedWord, setSelectedWord] = useState<Word | null>(word);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleWordSelect = (selectedWord: Word) => {
    setSelectedWord(selectedWord);
  };

  useEffect(() => {
    // 음성 인식 지원 여부 확인
    if (!speechRecognition.isSupported()) {
      console.log('음성 인식이 지원되지 않는 브라우저입니다.');
    }
  }, []);

  const speakWord = () => {
    if ('speechSynthesis' in window && selectedWord) {
      const utterance = new SpeechSynthesisUtterance(selectedWord.english);
      utterance.lang = 'en-US';
      utterance.rate = 0.7;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      setTimeout(() => {
        mediaRecorder.stop();
        setIsRecording(false);
      }, 3000);
    } catch (error) {
      console.error('녹음 오류:', error);
      alert('마이크 접근이 허용되지 않았습니다.');
    }
  };

  const handleSpeechRecognition = async () => {
    try {
      setIsRecognizing(true);
      setUserInput('');
      setResult(null);

      const transcript = await speechRecognition.recognizeSpeech();
      setUserInput(transcript);

      // 자동으로 분석 시작
      await analyzePronunciation(transcript);
    } catch (error) {
      console.error('음성 인식 오류:', error);
      alert('음성 인식에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsRecognizing(false);
    }
  };

  const analyzePronunciation = async (inputText?: string) => {
    const textToAnalyze = inputText || userInput;

    if (!textToAnalyze.trim()) {
      alert('발음을 입력하거나 음성으로 녹음해주세요.');
      return;
    }

    if (!selectedWord) {
      alert('단어를 선택해주세요.');
      return;
    }

    setIsAnalyzing(true);
    try {
      // Simple local comparison
      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
      const target = normalize(selectedWord.english);
      const input = normalize(textToAnalyze);

      const isCorrect = target === input;
      const accuracy = isCorrect ? 100 : 0;

      const localResult = {
        accuracy: accuracy,
        feedback: isCorrect
          ? "완벽해요! (Perfect)"
          : `아쉬워요. 들린 단어: "${textToAnalyze}"`,
        suggestions: isCorrect
          ? ["다음 단어도 연습해보세요!"]
          : ["다시 한 번 또박또박 말해보세요."]
      };

      setResult(localResult);
    } catch (error) {
      console.error('발음 분석 오류:', error);
      alert('발음 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const playAudio = () => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play();
    }
  };

  // 단어가 선택되지 않았을 때 단어 선택 화면 표시
  if (!selectedWord) {
    return (
      <div className="pronunciation-practice">
        <div className="practice-header">
          <button className="back-button" onClick={onBack}>
            ← 뒤로가기
          </button>
          <h2>🎤 발음 연습하기</h2>
        </div>

        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h3>발음 연습할 단어를 선택하세요</h3>
          <p>단어를 클릭하면 발음 연습을 시작할 수 있습니다.</p>
        </div>

        <WordList
          words={words}
          onWordSelect={handleWordSelect}
          selectedWord={undefined}
        />
      </div>
    );
  }

  return (
    <div className="pronunciation-practice">
      <div className="practice-header">
        <button className="back-button" onClick={onBack}>
          ← 뒤로가기
        </button>
        <h2>발음 연습</h2>
      </div>

      <div className="word-card">
        <div className="word-display">
          {/* 그림을 먼저 가운데 정렬로 표시 */}
          {selectedWord.imageUrl && (
            <div className="word-image-container">
              <img
                src={selectedWord.imageUrl}
                alt={selectedWord.english}
                className="word-image"
              />
            </div>
          )}

          {/* 텍스트를 그림 아래로 이동 */}
          <div className="word-text-container">
            <h1 className="word-english">{selectedWord.english}</h1>
            <div className="word-korean">{selectedWord.korean}</div>
            {selectedWord.pronunciation && (
              <div className="word-pronunciation">
                /{selectedWord.pronunciation}/
              </div>
            )}
            {selectedWord.example && (
              <div className="word-example">
                "{selectedWord.example}"
              </div>
            )}
          </div>
        </div>

        <div className="pronunciation-controls">
          <button className="speak-button" onClick={speakWord}>
            🔊 발음 듣기
          </button>

          <div className="recording-section">
            <button
              className={`record-button ${isRecording ? 'recording' : ''}`}
              onClick={startRecording}
              disabled={isRecording}
            >
              {isRecording ? '🎤 녹음 중...' : '🎤 녹음하기'}
            </button>

            {audioUrl && (
              <button className="play-button" onClick={playAudio}>
                ▶️ 재생
              </button>
            )}
          </div>
        </div>

        <div className="input-section">
          <div className="speech-input-section">
            <button
              className={`speech-recognition-button ${isRecognizing ? 'recognizing' : ''}`}
              onClick={handleSpeechRecognition}
              disabled={isRecognizing || isAnalyzing}
            >
              {isRecognizing ? '🎤 음성 인식 중...' : '🎤 발음 녹음하기'}
            </button>
            <p className="speech-help">
              버튼을 클릭하고 "{selectedWord.english}"를 발음해주세요
            </p>
          </div>

          {userInput && (
            <div className="recognized-text">
              <strong>인식된 발음:</strong> "{userInput}"
            </div>
          )}
        </div>

        {result && (
          <div className="analysis-result">
            <h3>🎊 발음 평가 결과 🎊</h3>
            <div className="accuracy-score">
              <div className="score-label">내 점수는?</div>
              <span className="score">{result.accuracy}점</span>
              <div className="score-emoji">
                {result.accuracy >= 90 ? '🏆' : result.accuracy >= 70 ? '⭐' : result.accuracy >= 50 ? '👍' : '💪'}
              </div>
            </div>
            <div className="feedback">
              <div className="feedback-icon">💬</div>
              <div className="feedback-text">{result.feedback}</div>
            </div>
            {result.suggestions.length > 0 && (
              <div className="suggestions">
                <div className="suggestions-title">🌟 더 잘하는 방법 🌟</div>
                <div className="suggestions-list">
                  {result.suggestions.map((suggestion, index) => (
                    <div key={index} className="suggestion-item">
                      <span className="suggestion-number">{index + 1}</span>
                      <span className="suggestion-text">{suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <audio ref={audioRef} src={audioUrl || undefined} />
      </div>
    </div>
  );
};

export default PronunciationPractice;
