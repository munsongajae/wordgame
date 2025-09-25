export interface RankingRecord {
  id: string;
  quizType: 'imageQuiz' | 'spellingQuiz' | 'meaningQuiz' | 'combinedQuiz' | 'listeningQuiz' | 'spellingGame' | 'fillBlankGame';
  userName: '열음이' | '지음이';
  score: number;
  totalQuestions: number;
  totalTimeMs: number; // 전체 풀이 시간 (밀리초)
  accuracy: number; // 정답률 (0-100)
  date: string; // ISO 날짜 문자열
  questionCount: number | 'infinite'; // 선택한 문제 수
}

export interface RankingDisplay {
  quizType: 'imageQuiz' | 'spellingQuiz' | 'meaningQuiz' | 'combinedQuiz' | 'listeningQuiz' | 'spellingGame' | 'fillBlankGame';
  quizName: string;
  records: RankingRecord[];
}
