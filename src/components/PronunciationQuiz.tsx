import React, { useMemo, useState } from 'react';
import { logAttempt, saveSession, updateProgress, getWrongWordIdsForSession } from '../services/trackingService';
import { Word } from '../types/word';

import './PronunciationPractice.css';
import { QuizResult } from './common/QuizResult';

interface PronunciationQuizProps {
  words: Word[];
  onBack: () => void;
}

const NUM_QUESTIONS = 10;

function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

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
          // Just ignore no-speech errors in the console, but still reject to clean up
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

export default function PronunciationQuiz({ words, onBack }: PronunciationQuizProps) {
  const questions = useMemo(() => pickRandom(words, Math.min(NUM_QUESTIONS, words.length)), [words]);
  const [index, setIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [wrongQuestions, setWrongQuestions] = useState<Word[]>([]);
  const [quizStartTime, setQuizStartTime] = useState(Date.now());

  if (words.length === 0) {
    return (
      <div className="quiz-container">
        <button className="back-button" onClick={onBack}>← 뒤로가기</button>
        <p>단어가 없습니다.</p>
      </div>
    );
  }

  const current = questions[index];

  const speakWord = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(current.english);
      utterance.lang = 'en-US';
      utterance.rate = 0.7;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
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

    setIsAnalyzing(true);
    try {
      // Simple local comparison
      const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
      const target = normalize(current.english);
      const input = normalize(textToAnalyze);

      const isCorrect = target === input;
      const accuracy = isCorrect ? 100 : 0; // Simple binary scoring

      const localResult = {
        accuracy: accuracy,
        feedback: isCorrect
          ? "완벽해요! (Perfect)"
          : `아쉬워요. 들린 단어: "${textToAnalyze}"`,
        suggestions: isCorrect
          ? ["다음 문제도 도전해보세요!"]
          : ["다시 한 번 또박또박 말해보세요."]
      };

      setResult(localResult);

      // 점수 계산
      if (isCorrect) {
        setScore(s => s + 1);
      } else {
        setWrongQuestions(prev => [...prev, current]);
      }

      logAttempt({ sessionId, mode: 'pronunciation', wordId: current.id, correct: isCorrect, accuracy });
      updateProgress({ wordId: current.id, correct: isCorrect });
    } catch (error) {
      console.error('발음 분석 오류:', error);
      alert('발음 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      if (!sessionId) {
        saveSession({ mode: 'pronunciation', score, total: questions.length }).then(id => setSessionId(id));
      }
      return;
    }
    setIndex(i => i + 1);
    setUserInput('');
    setResult(null);
  };

  return (
    <div className="quiz-container">
      {/* 퀴즈 진행 중일 때만 헤더 표시 */}
      {!finished && (
        <div className="quiz-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          gap: '20px'
        }}>
          <button className="back-button" onClick={onBack}>← 뒤로가기</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h2 style={{ margin: 0, color: '#333' }}>🎤 발음 연습하기 ({index + 1}/{questions.length})</h2>
          </div>
          <div style={{
            backgroundColor: '#f5f5f5',
            padding: '8px 16px',
            borderRadius: '20px',
            fontWeight: 'bold',
            color: '#2196F3',
            minWidth: '80px',
            textAlign: 'center'
          }}>
            점수: {score}
          </div>
        </div>
      )}

      {!finished && (
        <div className="question-card" style={{ textAlign: 'center' }}>
          <div className="word-display" style={{ margin: '20px 0' }}>
            {/* 그림을 먼저 표시 */}
            {current.imageUrl && (
              <div className="word-image-container" style={{ order: 1 }}>
                <img
                  src={current.imageUrl}
                  alt={current.english}
                  className="word-image"
                />
              </div>
            )}

            {/* 단어 정보를 다음 줄에 표시 */}
            <div className="word-text-container" style={{ order: 2, textAlign: 'center', width: '100%' }}>
              <h1 className="word-english" style={{ fontWeight: 700, margin: '12px 0', color: '#2196F3' }}>
                {current.english}
              </h1>
              <div style={{ fontSize: 20, color: '#666', margin: '8px 0' }}>
                {current.korean}
              </div>
              {current.pronunciation && (
                <div style={{ fontSize: 18, color: '#888', fontStyle: 'italic', margin: '8px 0' }}>
                  /{current.pronunciation}/
                </div>
              )}
            </div>

            {current.example && (
              <div style={{ fontSize: 16, color: '#666', fontStyle: 'italic', margin: '20px 0', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                "{current.example}"
              </div>
            )}
          </div>

          <div className="pronunciation-controls" style={{ margin: '20px 0' }}>
            <button
              className="speak-button"
              onClick={speakWord}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                margin: '0 8px'
              }}
            >
              🔊 발음 듣기
            </button>
          </div>

          <div className="input-section" style={{ margin: '20px 0' }}>
            <div className="speech-input-section">
              <button
                className={`speech-recognition-button ${isRecognizing ? 'recognizing' : ''}`}
                onClick={handleSpeechRecognition}
                disabled={isRecognizing || isAnalyzing}
                style={{
                  padding: '16px 32px',
                  fontSize: '18px',
                  backgroundColor: isRecognizing ? '#FF9800' : '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: isRecognizing ? 'not-allowed' : 'pointer',
                  margin: '16px 0'
                }}
              >
                {isRecognizing ? '🎤 음성 인식 중...' : '🎤 발음 녹음하기'}
              </button>
              <p style={{ color: '#666', fontSize: '14px' }}>
                버튼을 클릭하고 "{current.english}"를 발음해주세요
              </p>
            </div>

            {userInput && (
              <div style={{ margin: '16px 0', padding: '12px', backgroundColor: '#f0f8ff', borderRadius: '8px' }}>
                <strong>인식된 발음:</strong> "{userInput}"
              </div>
            )}
          </div>

          {result && (
            <div className="analysis-result" style={{ margin: '20px 0', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '12px' }}>
              <h3 style={{ color: '#333', marginBottom: '16px' }}>🎊 발음 평가 결과 🎊</h3>
              <div className="accuracy-score" style={{ textAlign: 'center', margin: '16px 0' }}>
                <div style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>내 점수는?</div>
                <span style={{ fontSize: '48px', fontWeight: 'bold', color: result.accuracy >= 70 ? '#4CAF50' : '#FF9800' }}>
                  {result.accuracy}점
                </span>
                <div style={{ fontSize: '24px', marginTop: '8px' }}>
                  {result.accuracy >= 90 ? '🏆' : result.accuracy >= 70 ? '⭐' : result.accuracy >= 50 ? '👍' : '💪'}
                </div>
              </div>
              <div className="feedback" style={{ margin: '16px 0', padding: '12px', backgroundColor: '#fff', borderRadius: '8px' }}>
                <div style={{ fontSize: '16px', color: '#333' }}>{result.feedback}</div>
              </div>
              {result.suggestions && result.suggestions.length > 0 && (
                <div className="suggestions" style={{ margin: '16px 0' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', marginBottom: '12px' }}>🌟 더 잘하는 방법 🌟</div>
                  <div className="suggestions-list">
                    {result.suggestions.map((suggestion: string, index: number) => (
                      <div key={index} style={{ margin: '8px 0', padding: '8px', backgroundColor: '#fff', borderRadius: '6px' }}>
                        <span style={{ fontWeight: 'bold', color: '#2196F3' }}>{index + 1}.</span> {suggestion}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button
              className="next-button"
              onClick={next}
              disabled={isAnalyzing}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                backgroundColor: isAnalyzing ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isAnalyzing ? 'not-allowed' : 'pointer'
              }}
            >
              다음
            </button>
          </div>
        </div>
      )}

      {finished && (
        <QuizResult
          score={score}
          total={questions.length}
          duration={Math.round((Date.now() - quizStartTime) / 1000)}
          wrongWords={wrongQuestions}
          onRestart={() => {
            // 전체 재시작 (questions는 처음에만 랜덤 픽하므로 다시 섞을지 여부는 선택사항이나, 여기서는 간단히 index와 score만 리셋)
            // 더 완벽하게 하려면 questions를 다시 셔플해야 하지만 useMemo로 되어있어 컴포넌트 리마운트 필요할 수도 있음.
            // 일단 단순 리셋
            setIndex(0);
            setScore(0);
            setFinished(false);
            setResult(null);
            setUserInput('');
            setWrongQuestions([]);
            setQuizStartTime(Date.now());
          }}
          onRetryWrong={wrongQuestions.length > 0 ? () => {
            // 틀린 문제만 다시 풀기
            // questions array를 직접 수정해야 하는데 useMemo로 되어 있어 약간 까다로움.
            // 하지만 JS 객체 참조를 이용해 questions 내용을 바꿔치기 하거나, 
            // 별도의 state로 displayQuestions를 두는게 정석.
            // 여기서는 기존 로직(splice 등)을 활용해봄.
            setIndex(0);
            (questions as any).splice(0, questions.length, ...wrongQuestions);
            setFinished(false);
            setResult(null);
            setUserInput('');
            setScore(0);
            setWrongQuestions([]);
            setQuizStartTime(Date.now());
          } : undefined}
          onBack={onBack}
        />
      )}
    </div>
  );
}