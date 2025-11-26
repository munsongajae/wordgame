// 퀴즈 관련 공통 상수
export const QUIZ_CONSTANTS = {
  NUM_OPTIONS: 4,
  AUTO_NEXT_DELAY_MS: 800,
  COUNTDOWN_BEEP_DURATION: 0.12,
  TIMER_DURATION: 10,
} as const;

// 사운드 파일 경로
export const SOUND_PATHS = {
  SUCCESS: '/success.mp3',
  WRONG: '/wrong.mp3',
  RECORD: '/record.mp3',
  TIMER: '/timer.mp3',
} as const;

// 퀴즈 모드 타입 (trackingService와 동일)
export type QuizMode =
  | 'imageQuiz'
  | 'spellingQuiz'
  | 'meaningQuiz'
  | 'pronunciation'
  | 'combinedQuiz'
  | 'listeningQuiz'
  | 'spellingGame'
  | 'fillBlankGame'
  | 'sentenceGame';

// TTS 설정 타입
export interface TTSSettings {
  rate: number;
  gender: 'default' | 'male' | 'female';
  accent: 'us' | 'uk';
}

// 기본 TTS 설정
export const DEFAULT_TTS_SETTINGS: TTSSettings = {
  rate: 1.0,
  gender: 'default',
  accent: 'us',
};
