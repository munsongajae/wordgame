import { getSupabase, getOrCreateAnonUserId } from './supabaseClient';

type Mode = 'imageQuiz' | 'spellingQuiz' | 'meaningQuiz' | 'pronunciation';

export async function saveSession(params: { mode: Mode; score: number; total: number; durationSec?: number; sessionIdHint?: string; }): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const userId = getOrCreateAnonUserId();
  const { data, error } = await supabase
    .from('sessions')
    .insert({ user_id: userId, mode: params.mode, score: params.score, total: params.total, duration_sec: params.durationSec ?? 0 })
    .select('id')
    .single();
  if (error) { console.error('saveSession error', error); return null; }
  return data?.id ?? null;
}

export async function logAttempt(params: { sessionId?: string | null; mode: Mode; wordId: string; correct: boolean; accuracy?: number; elapsedMs?: number; }) {
  const supabase = getSupabase();
  if (!supabase) return;
  const userId = getOrCreateAnonUserId();
  const { error } = await supabase
    .from('attempts')
    .insert({ user_id: userId, session_id: params.sessionId ?? null, word_id: params.wordId, mode: params.mode, correct: params.correct, accuracy: params.accuracy ?? null, elapsed_ms: params.elapsedMs ?? null });
  if (error) console.error('logAttempt error', error);
}

// 매우 단순한 SRS 규칙: 정답이면 interval 0->1->3->7, 오답이면 0으로 리셋
export async function updateProgress(params: { wordId: string; correct: boolean; }) {
  const supabase = getSupabase();
  if (!supabase) return;
  const userId = getOrCreateAnonUserId();

  // fetch current
  const { data } = await supabase
    .from('progresses')
    .select('interval_days, streak')
    .eq('user_id', userId)
    .eq('word_id', params.wordId)
    .single();

  let interval = data?.interval_days ?? 0;
  let streak = data?.streak ?? 0;
  if (params.correct) {
    streak += 1;
    interval = interval <= 0 ? 1 : interval === 1 ? 3 : 7;
  } else {
    streak = 0;
    interval = 0;
  }
  const next = interval > 0 ? new Date(Date.now() + interval * 86400000) : null;

  const { error } = await supabase
    .from('progresses')
    .upsert({ user_id: userId, word_id: params.wordId, interval_days: interval, next_review_at: next ? next.toISOString().slice(0,10) : null, streak, last_result: params.correct ? 'correct' : 'wrong' })
    .select('user_id')
    .single();
  if (error) console.error('updateProgress error', error);
}

export async function getWrongWordIdsForSession(sessionId: string): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('attempts')
    .select('word_id')
    .eq('session_id', sessionId)
    .eq('correct', false)
    .order('created_at', { ascending: true });
  if (error) { console.error('getWrongWordIdsForSession error', error); return []; }
  return (data ?? []).map(r => r.word_id);
}

export async function getRecentWrongWordIds(mode: Mode, limit: number = 20): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const userId = getOrCreateAnonUserId();
  const { data, error } = await supabase
    .from('attempts')
    .select('word_id')
    .eq('user_id', userId)
    .eq('mode', mode)
    .eq('correct', false)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('getRecentWrongWordIds error', error); return []; }
  // de-dup while preserving order
  const seen = new Set<string>();
  const result: string[] = [];
  for (const r of data ?? []) {
    if (!seen.has(r.word_id)) { seen.add(r.word_id); result.push(r.word_id); }
  }
  return result.reverse();
}


