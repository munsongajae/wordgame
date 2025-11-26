import { RankingRecord, RankingDisplay } from '../types/ranking';
import { getCurrentUserName } from './supabaseClient';

const STORAGE_KEY = 'quizRankings';

// 로컬 스토리지에서 순위 데이터 로드
export const loadRankings = (): RankingRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    console.log('로컬 스토리지에서 순위 데이터 로드:', data);
    const rankings = data ? JSON.parse(data) : [];
    console.log('파싱된 순위 데이터:', rankings);
    return rankings;
  } catch (error) {
    console.error('순위 데이터 로드 실패:', error);
    return [];
  }
};

// 로컬 스토리지에 순위 데이터 저장
export const saveRankings = (rankings: RankingRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rankings));
  } catch (error) {
    console.error('Failed to save rankings:', error);
  }
};

// 신기록 추가
export const addRecord = (record: Omit<RankingRecord, 'id' | 'date'>): boolean => {
  const rankings = loadRankings();
  const newRecord: RankingRecord = {
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: new Date().toISOString(),
  };

  console.log('순위 기록 시도:', newRecord);
  console.log('정답률:', newRecord.accuracy);

  // 100% 정답률인 경우에만 기록
  if (newRecord.accuracy === 100) {
    rankings.push(newRecord);
    saveRankings(rankings);
    console.log('순위 기록 성공!');
    return true;
  }
  
  console.log('100% 정답률이 아니어서 기록되지 않음');
  return false;
};

// 퀴즈별 + 문제수별 순위 조회 (100% 정답률 기준, 시간 순 정렬)
export const getRankingsByQuiz = (quizType: RankingRecord['quizType'], questionCount?: number | 'infinite'): RankingRecord[] => {
  const rankings = loadRankings();
  return rankings
    .filter(record => {
      const typeMatch = record.quizType === quizType;
      if (questionCount === undefined) return typeMatch;
      return typeMatch && record.questionCount === questionCount;
    })
    .sort((a, b) => a.totalTimeMs - b.totalTimeMs); // 시간이 짧은 순
};

// 전체 순위 조회 (모든 퀴즈 + 문제수별 통합)
export const getAllRankings = (): RankingDisplay[] => {
  loadRankings(); // 순위 데이터 로드 (필요시 사용)
  const quizTypes: Array<{ type: RankingRecord['quizType']; name: string }> = [
    { type: 'imageQuiz', name: '그림 보고 맞추기' },
    { type: 'spellingQuiz', name: '철자 보고 맞추기' },
    { type: 'meaningQuiz', name: '뜻 보고 맞추기' },
    { type: 'listeningQuiz', name: '듣기 퀴즈' },
    { type: 'spellingGame', name: '철자 조합 게임' },
    { type: 'fillBlankGame', name: '빈칸 채우기 게임' },
    { type: 'sentenceGame', name: '영어 문장 만들기' },
    { type: 'combinedQuiz', name: '종합 퀴즈' },
    { type: 'bossRaid', name: '보스 레이드' },
    { type: 'memoryGame', name: '단어 메모리 게임' },
    { type: 'speedChallenge', name: '단어 스피드 챌린지' },
  ];
  const questionCounts: Array<number | 'infinite'> = [10, 20, 30, 'infinite'];

  const result: RankingDisplay[] = [];
  
  quizTypes.forEach(({ type, name }) => {
    questionCounts.forEach(count => {
      const records = getRankingsByQuiz(type, count);
      if (records.length > 0) {
        result.push({
          quizType: type,
          quizName: `${name} (${count === 'infinite' ? '무제한' : `${count}문제`})`,
          records: records.slice(0, 10), // 상위 10개만
        });
      }
    });
  });

  return result;
};

// 사용자의 최고 기록 조회 (문제수별)
export const getUserBestRecord = (quizType: RankingRecord['quizType'], questionCount?: number | 'infinite'): RankingRecord | null => {
  const userRankings = getRankingsByQuiz(quizType, questionCount)
    .filter(record => record.userName === getCurrentUserName());
  
  return userRankings.length > 0 ? userRankings[0] : null;
};

// 신기록인지 확인 (문제수별)
export const isNewRecord = (
  quizType: RankingRecord['quizType'],
  totalTimeMs: number,
  accuracy: number,
  questionCount: number | 'infinite'
): boolean => {
  console.log('신기록 확인:', { quizType, totalTimeMs, accuracy, questionCount });
  
  if (accuracy !== 100) {
    console.log('100% 정답률이 아니어서 신기록 아님');
    return false;
  }
  
  const userBest = getUserBestRecord(quizType, questionCount);
  console.log('사용자 최고 기록 (문제수별):', userBest);
  
  const isNew = !userBest || totalTimeMs < userBest.totalTimeMs;
  console.log('신기록 여부:', isNew);
  
  return isNew;
};

// 퀴즈 결과에서 순위 기록 생성
export const createRecordFromQuizResult = (
  quizType: RankingRecord['quizType'],
  score: number,
  totalQuestions: number,
  startTime: number,
  endTime: number,
  questionCount: number | 'infinite'
): Omit<RankingRecord, 'id' | 'date'> => {
  const totalTimeMs = endTime - startTime;
  const accuracy = Math.round((score / totalQuestions) * 100);
  
  console.log('createRecordFromQuizResult 계산:', {
    score,
    totalQuestions,
    accuracy,
    calculation: `(${score} / ${totalQuestions}) * 100 = ${accuracy}`,
    isExactly100: accuracy === 100
  });
  
  return {
    quizType,
    userName: getCurrentUserName(),
    score,
    totalQuestions,
    totalTimeMs,
    accuracy,
    questionCount,
  };
};

// 전체 순위 초기화
export const clearAllRankings = (): void => {
  console.log('전체 순위 초기화');
  localStorage.removeItem(STORAGE_KEY);
};

// 특정 퀴즈 타입의 순위 초기화
export const clearRankingsByQuiz = (quizType: RankingRecord['quizType']): void => {
  console.log('퀴즈별 순위 초기화:', quizType);
  const rankings = loadRankings();
  const filteredRankings = rankings.filter(record => record.quizType !== quizType);
  saveRankings(filteredRankings);
};

// 특정 퀴즈 타입 + 문제 수의 순위 초기화
export const clearRankingsByQuizAndCount = (quizType: RankingRecord['quizType'], questionCount: number | 'infinite'): void => {
  console.log('퀴즈별 + 문제수별 순위 초기화:', quizType, questionCount);
  const rankings = loadRankings();
  const filteredRankings = rankings.filter(record => 
    !(record.quizType === quizType && record.questionCount === questionCount)
  );
  saveRankings(filteredRankings);
};
