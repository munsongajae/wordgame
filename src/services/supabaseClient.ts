import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  const url = process.env.REACT_APP_SUPABASE_URL as string | undefined;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    console.warn('Supabase URL or Anon Key is missing. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env');
    return null;
  }
  supabase = createClient(url, key);
  return supabase;
}

export function getOrCreateAnonUserId(): string {
  const storageKey = 'anon_user_id';
  let id = localStorage.getItem(storageKey);
  console.log('현재 저장된 anon_user_id:', id);
  
  // UUID 형식 검증 (8-4-4-4-12 패턴)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!id || !uuidRegex.test(id)) {
    console.log('잘못된 UUID 형식 감지, 새로운 UUID 생성');
    id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
    console.log('새로 생성된 UUID:', id);
  }
  
  return id;
}

export function setCurrentUserByName(name: '열음' | '지음') {
  const ids: Record<'열음' | '지음', string> = {
    // 유효한 UUID 값 사용 (고정)
    '열음': '11111111-1111-1111-1111-111111111111',
    '지음': '22222222-2222-2222-2222-222222222222'
  };
  console.log('사용자 변경:', name, 'UUID:', ids[name]);
  localStorage.setItem('user_name', name);
  localStorage.setItem('anon_user_id', ids[name]);
}

export function getCurrentUserName(): '열음' | '지음' {
  const v = localStorage.getItem('user_name');
  console.log('getCurrentUserName 호출, 저장된 사용자명:', v);
  if (v === '열음' || v === '지음') return v;
  // default 초기값: 열음
  setCurrentUserByName('열음');
  return '열음';
}


