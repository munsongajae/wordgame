export interface Word {
  id: string;
  english: string;
  korean: string;
  imageUrl?: string;
  pronunciation?: string;
  example?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
}

// QuizQuestion 타입 제거 (퀴즈 기능 삭제)

export interface PronunciationResult {
  accuracy: number;
  feedback: string;
  suggestions: string[];
}
