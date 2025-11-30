import { getSupabase, getOrCreateAnonUserId } from './supabaseClient';
import { UserName } from '../types/ranking';

/**
 * 현재 사용자의 모든 학습 기록 삭제
 */
export async function deleteAllRecords(userName: UserName): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase가 연결되지 않았습니다.' };
  }

  const userIdMap: Record<UserName, string> = {
    '열음이': '11111111-1111-1111-1111-111111111111',
    '지음이': '22222222-2222-2222-2222-222222222222',
    '규진이': '33333333-3333-3333-3333-333333333333',
    '규선이': '44444444-4444-4444-4444-444444444444'
  };
  const userId = userIdMap[userName];

  try {
    // 1. attempts 삭제 (sessions와 연결되어 있으므로 먼저 삭제)
    const { error: attemptsError } = await supabase
      .from('attempts')
      .delete()
      .eq('user_id', userId);

    if (attemptsError) {
      console.error('attempts 삭제 실패:', attemptsError);
      return { success: false, error: `시도 기록 삭제 실패: ${attemptsError.message}` };
    }

    // 2. sessions 삭제
    const { error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .eq('user_id', userId);

    if (sessionsError) {
      console.error('sessions 삭제 실패:', sessionsError);
      return { success: false, error: `세션 기록 삭제 실패: ${sessionsError.message}` };
    }

    // 3. rankings 삭제 (user_name으로 필터링)
    const { error: rankingsError } = await supabase
      .from('rankings')
      .delete()
      .eq('user_name', userName);

    if (rankingsError) {
      console.error('rankings 삭제 실패:', rankingsError);
      return { success: false, error: `랭킹 기록 삭제 실패: ${rankingsError.message}` };
    }

    // 4. progresses 삭제
    const { error: progressesError } = await supabase
      .from('progresses')
      .delete()
      .eq('user_id', userId);

    if (progressesError) {
      console.error('progresses 삭제 실패:', progressesError);
      return { success: false, error: `진행도 기록 삭제 실패: ${progressesError.message}` };
    }

    return { success: true };
  } catch (error) {
    console.error('기록 삭제 중 오류:', error);
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
}

/**
 * 특정 날짜 범위의 학습 기록 삭제
 */
export async function deleteRecordsByDateRange(
  userName: UserName,
  startDate: Date,
  endDate: Date
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: 'Supabase가 연결되지 않았습니다.' };
  }

  const userIdMap: Record<UserName, string> = {
    '열음이': '11111111-1111-1111-1111-111111111111',
    '지음이': '22222222-2222-2222-2222-222222222222',
    '규진이': '33333333-3333-3333-3333-333333333333',
    '규선이': '44444444-4444-4444-4444-444444444444'
  };
  const userId = userIdMap[userName];

  // 날짜 범위 설정 (하루 전체를 포함하도록)
  const startOfDay = new Date(startDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(endDate);
  endOfDay.setHours(23, 59, 59, 999);

  const startISO = startOfDay.toISOString();
  const endISO = endOfDay.toISOString();

  try {
    let deletedCount = 0;

    // 1. 해당 날짜 범위의 sessions 조회
    const { data: sessions, error: sessionsSelectError } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (sessionsSelectError) {
      console.error('sessions 조회 실패:', sessionsSelectError);
      return { success: false, error: `세션 조회 실패: ${sessionsSelectError.message}` };
    }

    const sessionIds = sessions?.map(s => s.id) || [];

    // 2. 해당 sessions와 연결된 attempts 삭제
    if (sessionIds.length > 0) {
      const { error: attemptsError } = await supabase
        .from('attempts')
        .delete()
        .in('session_id', sessionIds);

      if (attemptsError) {
        console.error('attempts 삭제 실패:', attemptsError);
        return { success: false, error: `시도 기록 삭제 실패: ${attemptsError.message}` };
      }
    }

    // 3. 해당 날짜 범위의 attempts 삭제 (user_id로 직접)
    const { error: attemptsDirectError } = await supabase
      .from('attempts')
      .delete()
      .eq('user_id', userId)
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (attemptsDirectError) {
      console.error('attempts 직접 삭제 실패:', attemptsDirectError);
    }

    // 4. 해당 날짜 범위의 sessions 삭제
    const { error: sessionsError } = await supabase
      .from('sessions')
      .delete()
      .eq('user_id', userId)
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (sessionsError) {
      console.error('sessions 삭제 실패:', sessionsError);
      return { success: false, error: `세션 기록 삭제 실패: ${sessionsError.message}` };
    }

    deletedCount += sessions?.length || 0;

    // 5. 해당 날짜 범위의 rankings 삭제
    const { error: rankingsError } = await supabase
      .from('rankings')
      .delete()
      .eq('user_name', userName)
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (rankingsError) {
      console.error('rankings 삭제 실패:', rankingsError);
      return { success: false, error: `랭킹 기록 삭제 실패: ${rankingsError.message}` };
    }

    // rankings 삭제 개수는 조회 후 계산
    const { data: rankings, error: rankingsSelectError } = await supabase
      .from('rankings')
      .select('id')
      .eq('user_name', userName)
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    if (!rankingsSelectError && rankings) {
      deletedCount += rankings.length;
    }

    return { success: true, deletedCount };
  } catch (error) {
    console.error('기록 삭제 중 오류:', error);
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
}

/**
 * 특정 날짜의 학습 기록 삭제
 */
export async function deleteRecordsByDate(
  userName: UserName,
  date: Date
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  return deleteRecordsByDateRange(userName, date, date);
}

