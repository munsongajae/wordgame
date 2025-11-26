import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
let supabaseInitialized = false;

export function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  if (supabaseInitialized) return null; // 이미 초기화 시도했지만 실패한 경우
  
  const url = process.env.REACT_APP_SUPABASE_URL as string | undefined;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    supabaseInitialized = true;
    // 환경 변수가 없으면 조용히 null 반환 (콘솔 경고 제거)
    return null;
  }
  
  try {
    supabase = createClient(url, key, {
      // 네트워크 오류 시 조용히 처리
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    supabaseInitialized = true;
    return supabase;
  } catch (error) {
    supabaseInitialized = true;
    // 초기화 실패 시 조용히 null 반환
    return null;
  }
}

export function getOrCreateAnonUserId(): string {
  const storageKey = 'anon_user_id';
  let id = localStorage.getItem(storageKey);
  
  // UUID 형식 검증 (8-4-4-4-12 패턴)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!id || !uuidRegex.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
  }
  
  return id;
}

export function setCurrentUserByName(name: '열음이' | '지음이') {
  const ids: Record<'열음이' | '지음이', string> = {
    // 유효한 UUID 값 사용 (고정)
    '열음이': '11111111-1111-1111-1111-111111111111',
    '지음이': '22222222-2222-2222-2222-222222222222'
  };
  localStorage.setItem('user_name', name);
  localStorage.setItem('anon_user_id', ids[name]);
}

export function getCurrentUserName(): '열음이' | '지음이' {
  const v = localStorage.getItem('user_name');
  if (v === '열음이' || v === '지음이') return v;
  // default 초기값: 열음이
  setCurrentUserByName('열음이');
  return '열음이';
}

/**
 * Supabase 연결 상태 확인
 */
export async function checkSupabaseConnection(): Promise<{
  connected: boolean;
  hasEnvVars: boolean;
  error?: string;
  url?: string;
}> {
  const url = process.env.REACT_APP_SUPABASE_URL as string | undefined;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY as string | undefined;
  
  if (!url || !key) {
    return {
      connected: false,
      hasEnvVars: false,
      error: '환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.',
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      connected: false,
      hasEnvVars: true,
      error: 'Supabase 클라이언트 초기화 실패',
      url,
    };
  }

  try {
    // 간단한 연결 테스트 (sessions 테이블 조회 시도)
    const { error } = await supabase
      .from('sessions')
      .select('id')
      .limit(1);
    
    if (error) {
      // 네트워크 오류인지 확인
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_NAME_NOT_RESOLVED')) {
        return {
          connected: false,
          hasEnvVars: true,
          error: `네트워크 연결 실패: ${error.message}. Supabase URL(${url})에 접근할 수 없습니다.`,
          url,
        };
      }
      return {
        connected: false,
        hasEnvVars: true,
        error: `연결 오류: ${error.message}`,
        url,
      };
    }

    return {
      connected: true,
      hasEnvVars: true,
      url,
    };
  } catch (error) {
    return {
      connected: false,
      hasEnvVars: true,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      url,
    };
  }
}


