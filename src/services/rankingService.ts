import { RankingRecord, RankingDisplay } from '../types/ranking';
import { getCurrentUserName, getSupabase } from './supabaseClient';

// Supabase 테이블 타입 정의
interface SupabaseRankingRow {
  id: string;
  quiz_type: string;
  user_name: string;
  score: number;
  total_questions: number;
  total_time_ms: number;
  accuracy: number;
  question_count: string;
  created_at: string;
  updated_at: string;
}

// Supabase 행을 RankingRecord로 변환
const mapSupabaseRowToRecord = (row: SupabaseRankingRow): RankingRecord => {
  return {
    id: row.id,
    quizType: row.quiz_type as RankingRecord['quizType'],
    userName: row.user_name as RankingRecord['userName'],
    score: row.score,
    totalQuestions: row.total_questions,
    totalTimeMs: row.total_time_ms,
    accuracy: row.accuracy,
    date: row.created_at,
    questionCount: row.question_count === 'infinite' ? 'infinite' : parseInt(row.question_count, 10),
  };
};

// RankingRecord를 Supabase 행으로 변환
const mapRecordToSupabaseRow = (record: Omit<RankingRecord, 'id' | 'date'>) => {
  return {
    quiz_type: record.quizType,
    user_name: record.userName,
    score: record.score,
    total_questions: record.totalQuestions,
    total_time_ms: record.totalTimeMs,
    accuracy: record.accuracy,
    question_count: record.questionCount === 'infinite' ? 'infinite' : record.questionCount.toString(),
  };
};

// 로컬 스토리지에서 순위 데이터 로드 (하위 호환성 유지, Supabase 실패 시 사용)
export const loadRankings = async (): Promise<RankingRecord[]> => {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('Supabase가 연결되지 않아 로컬 스토리지에서 로드합니다.');
    try {
      const data = localStorage.getItem('quizRankings');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('순위 데이터 로드 실패:', error);
      return [];
    }
  }

  try {
    const { data, error } = await supabase
      .from('rankings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase에서 순위 데이터 로드 실패:', error);
      return [];
    }

    return (data || []).map(mapSupabaseRowToRecord);
  } catch (error) {
    console.error('순위 데이터 로드 중 오류:', error);
    return [];
  }
};

// 신기록 추가
export const addRecord = async (record: Omit<RankingRecord, 'id' | 'date'>): Promise<boolean> => {
  const supabase = getSupabase();
  
  console.log('순위 기록 시도:', record);
  console.log('정답률:', record.accuracy);

  // 100% 정답률인 경우에만 기록
  if (record.accuracy !== 100) {
    console.log('100% 정답률이 아니어서 기록되지 않음');
    return false;
  }

  if (!supabase) {
    console.warn('Supabase가 연결되지 않아 로컬 스토리지에 저장합니다.');
    try {
      const data = localStorage.getItem('quizRankings');
      const rankings = data ? JSON.parse(data) : [];
      const newRecord: RankingRecord = {
        ...record,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        date: new Date().toISOString(),
      };
      rankings.push(newRecord);
      localStorage.setItem('quizRankings', JSON.stringify(rankings));
      console.log('로컬 스토리지에 순위 기록 성공!');
      return true;
    } catch (error) {
      console.error('로컬 스토리지 저장 실패:', error);
      return false;
    }
  }

  try {
    const row = mapRecordToSupabaseRow(record);
    const { data, error } = await supabase
      .from('rankings')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Supabase에 순위 기록 실패:', error);
      return false;
    }

    console.log('Supabase에 순위 기록 성공!', data);
    return true;
  } catch (error) {
    console.error('순위 기록 중 오류:', error);
    return false;
  }
};

// 퀴즈별 + 문제수별 순위 조회 (100% 정답률 기준, 시간 순 정렬)
export const getRankingsByQuiz = async (
  quizType: RankingRecord['quizType'],
  questionCount?: number | 'infinite'
): Promise<RankingRecord[]> => {
  const supabase = getSupabase();
  
  if (!supabase) {
    console.warn('Supabase가 연결되지 않아 빈 배열을 반환합니다.');
    return [];
  }

  try {
    let query = supabase
      .from('rankings')
      .select('*')
      .eq('quiz_type', quizType)
      .eq('accuracy', 100);

    if (questionCount !== undefined) {
      const countStr = questionCount === 'infinite' ? 'infinite' : questionCount.toString();
      query = query.eq('question_count', countStr);
    }

    let orderedQuery;
    if (quizType === 'memoryGame') {
      // 메모리 게임: 복합 점수로 정렬 (클라이언트 측에서 계산)
      orderedQuery = query.order('created_at', { ascending: false });
    } else if (quizType === 'speedChallenge') {
      // 스피드 챌린지: 점수 내림차순, 동점 시 시간 오름차순
      orderedQuery = query
        .order('score', { ascending: false })
        .order('total_time_ms', { ascending: true });
    } else {
      // 기존 로직: 시간이 짧은 순
      orderedQuery = query.order('total_time_ms', { ascending: true });
    }

    const { data, error } = await orderedQuery;

    if (error) {
      console.error('순위 조회 실패:', error);
      return [];
    }

    let records = (data || []).map(mapSupabaseRowToRecord);
    
    // 메모리 게임: 복합 점수로 정렬
    if (quizType === 'memoryGame') {
      records = records.sort((a, b) => {
        const scoreA = calculateMemoryGameScore(a.totalQuestions, a.totalTimeMs, a.score);
        const scoreB = calculateMemoryGameScore(b.totalQuestions, b.totalTimeMs, b.score);
        return scoreB - scoreA; // 점수가 높은 순
      });
    }

    return records;
  } catch (error) {
    console.error('순위 조회 중 오류:', error);
    return [];
  }
};

// 전체 순위 조회 (모든 퀴즈 + 문제수별 통합)
export const getAllRankings = async (): Promise<RankingDisplay[]> => {
  const quizTypes: Array<{ type: RankingRecord['quizType']; name: string }> = [
    { type: 'imageQuiz', name: '그림 보고 맞추기' },
    { type: 'spellingQuiz', name: '철자 보고 맞추기' },
    { type: 'meaningQuiz', name: '뜻 보고 맞추기' },
    { type: 'listeningQuiz', name: '듣기 퀴즈' },
    { type: 'spellingGame', name: '철자 조합 게임' },
    { type: 'fillBlankGame', name: '빈칸 채우기 게임' },
    { type: 'sentenceGame', name: '영어 문장 만들기' },
    { type: 'combinedQuiz', name: '종합 퀴즈' },
    { type: 'bossRaid', name: '외계인 침공' },
    { type: 'memoryGame', name: '단어 메모리 게임' },
    { type: 'speedChallenge', name: '단어 스피드 챌린지' },
  ];
  const questionCounts: Array<number | 'infinite'> = [10, 20, 30, 'infinite'];
  // 스피드 챌린지용 시간 제한 옵션
  const speedTimeLimits: number[] = [10, 20, 30, 60, 120];

  const result: RankingDisplay[] = [];
  
  for (const { type, name } of quizTypes) {
    if (type === 'speedChallenge') {
      // 스피드 챌린지: 시간 제한별로 분리
      for (const timeLimit of speedTimeLimits) {
        const records = await getRankingsByQuiz(type, timeLimit);
        if (records.length > 0) {
          result.push({
            quizType: type,
            quizName: `${name} (${timeLimit}초)`,
            records: records.slice(0, 10), // 상위 10개만
          });
        }
      }
    } else {
      // 다른 게임: 문제수별로 분리
      for (const count of questionCounts) {
        const records = await getRankingsByQuiz(type, count);
        if (records.length > 0) {
          result.push({
            quizType: type,
            quizName: `${name} (${count === 'infinite' ? '무제한' : `${count}문제`})`,
            records: records.slice(0, 10), // 상위 10개만
          });
        }
      }
    }
  }

  return result;
};

// 사용자의 최고 기록 조회 (문제수별)
export const getUserBestRecord = async (
  quizType: RankingRecord['quizType'],
  questionCount?: number | 'infinite'
): Promise<RankingRecord | null> => {
  const records = await getRankingsByQuiz(quizType, questionCount);
  const userRankings = records.filter(record => record.userName === getCurrentUserName());
  
  return userRankings.length > 0 ? userRankings[0] : null;
};

// 메모리 게임 복합 점수 계산 (시간 + 이동 횟수)
const calculateMemoryGameScore = (questionCount: number, totalTimeMs: number, moves: number): number => {
  // 점수 = (문제 수 * 1000) / (시간(초) + 이동 횟수 * 100)
  const timeSec = totalTimeMs / 1000;
  return (questionCount * 1000) / (timeSec + moves * 100);
};

// 신기록인지 확인 (문제수별)
export const isNewRecord = async (
  quizType: RankingRecord['quizType'],
  totalTimeMs: number,
  accuracy: number,
  questionCount: number | 'infinite',
  moves?: number // 메모리 게임용 이동 횟수
): Promise<boolean> => {
  console.log('신기록 확인:', { quizType, totalTimeMs, accuracy, questionCount, moves });
  
  if (accuracy !== 100) {
    console.log('100% 정답률이 아니어서 신기록 아님');
    return false;
  }
  
  const userBest = await getUserBestRecord(quizType, questionCount);
  console.log('사용자 최고 기록 (문제수별):', userBest);
  
  let isNew: boolean;
  
  if (quizType === 'memoryGame' && typeof questionCount === 'number' && moves !== undefined) {
    // 메모리 게임: 복합 점수로 비교
    const currentScore = calculateMemoryGameScore(questionCount, totalTimeMs, moves);
    const bestScore = userBest 
      ? calculateMemoryGameScore(userBest.totalQuestions, userBest.totalTimeMs, userBest.score)
      : 0;
    isNew = !userBest || currentScore > bestScore;
    console.log('메모리 게임 복합 점수 비교:', { currentScore, bestScore, isNew });
  } else if (quizType === 'speedChallenge') {
    // 스피드 챌린지: 점수(맞춘 개수)가 높을수록 좋음, 동점 시 시간이 짧을수록 좋음
    // totalTimeMs는 실제 사용한 시간이 아니라 남은 시간이므로, score를 비교
    // 하지만 score는 이미 기록에 저장되어 있으므로, 여기서는 moves를 score로 전달받아야 함
    // 실제로는 createRecordFromQuizResult에서 score에 맞춘 개수를 저장하므로
    // userBest.score와 비교하면 됨
    const currentScore = moves || 0; // moves 대신 실제 맞춘 개수를 전달받아야 함
    isNew = !userBest || currentScore > userBest.score || (currentScore === userBest.score && totalTimeMs < userBest.totalTimeMs);
    console.log('스피드 챌린지 점수 비교:', { currentScore, bestScore: userBest?.score, isNew });
  } else {
    // 기존 로직: 시간이 짧을수록 좋음
    isNew = !userBest || totalTimeMs < userBest.totalTimeMs;
  }
  
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
export const clearAllRankings = async (): Promise<void> => {
  console.log('전체 순위 초기화');
  const supabase = getSupabase();
  
  if (!supabase) {
    console.warn('Supabase가 연결되지 않아 로컬 스토리지만 초기화합니다.');
    localStorage.removeItem('quizRankings');
    return;
  }

  try {
    const { error } = await supabase
      .from('rankings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 행 삭제

    if (error) {
      console.error('순위 초기화 실패:', error);
    } else {
      console.log('순위 초기화 성공');
    }
  } catch (error) {
    console.error('순위 초기화 중 오류:', error);
  }
};

// 특정 퀴즈 타입의 순위 초기화
export const clearRankingsByQuiz = async (quizType: RankingRecord['quizType']): Promise<void> => {
  console.log('퀴즈별 순위 초기화:', quizType);
  const supabase = getSupabase();
  
  if (!supabase) {
    console.warn('Supabase가 연결되지 않아 로컬 스토리지만 초기화합니다.');
    try {
      const data = localStorage.getItem('quizRankings');
      const rankings = data ? JSON.parse(data) : [];
      const filteredRankings = rankings.filter((record: RankingRecord) => record.quizType !== quizType);
      localStorage.setItem('quizRankings', JSON.stringify(filteredRankings));
    } catch (error) {
      console.error('로컬 스토리지 초기화 실패:', error);
    }
    return;
  }

  try {
    const { error } = await supabase
      .from('rankings')
      .delete()
      .eq('quiz_type', quizType);

    if (error) {
      console.error('퀴즈별 순위 초기화 실패:', error);
    } else {
      console.log('퀴즈별 순위 초기화 성공');
    }
  } catch (error) {
    console.error('퀴즈별 순위 초기화 중 오류:', error);
  }
};

// 특정 퀴즈 타입 + 문제 수의 순위 초기화
export const clearRankingsByQuizAndCount = async (
  quizType: RankingRecord['quizType'],
  questionCount: number | 'infinite'
): Promise<void> => {
  console.log('퀴즈별 + 문제수별 순위 초기화:', quizType, questionCount);
  const supabase = getSupabase();
  
  if (!supabase) {
    console.warn('Supabase가 연결되지 않아 로컬 스토리지만 초기화합니다.');
    try {
      const data = localStorage.getItem('quizRankings');
      const rankings = data ? JSON.parse(data) : [];
      const filteredRankings = rankings.filter(
        (record: RankingRecord) =>
          !(record.quizType === quizType && record.questionCount === questionCount)
      );
      localStorage.setItem('quizRankings', JSON.stringify(filteredRankings));
    } catch (error) {
      console.error('로컬 스토리지 초기화 실패:', error);
    }
    return;
  }

  try {
    const countStr = questionCount === 'infinite' ? 'infinite' : questionCount.toString();
    const { error } = await supabase
      .from('rankings')
      .delete()
      .eq('quiz_type', quizType)
      .eq('question_count', countStr);

    if (error) {
      console.error('퀴즈별 + 문제수별 순위 초기화 실패:', error);
    } else {
      console.log('퀴즈별 + 문제수별 순위 초기화 성공');
    }
  } catch (error) {
    console.error('퀴즈별 + 문제수별 순위 초기화 중 오류:', error);
  }
};
