-- rankings 테이블 생성
-- Supabase 기반 랭킹 시스템을 위한 테이블

CREATE TABLE IF NOT EXISTS public.rankings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_type TEXT NOT NULL,
  user_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  total_time_ms INTEGER NOT NULL,
  accuracy INTEGER NOT NULL,
  question_count TEXT NOT NULL, -- '10', '20', '30', 'infinite'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_rankings_quiz_type ON public.rankings(quiz_type);
CREATE INDEX IF NOT EXISTS idx_rankings_user_name ON public.rankings(user_name);
CREATE INDEX IF NOT EXISTS idx_rankings_quiz_question ON public.rankings(quiz_type, question_count);
CREATE INDEX IF NOT EXISTS idx_rankings_time ON public.rankings(quiz_type, question_count, total_time_ms);

-- RLS 활성화
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (중복 방지)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.rankings;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.rankings;
DROP POLICY IF EXISTS "Enable update for all users" ON public.rankings;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.rankings;

-- 새로운 정책 생성
CREATE POLICY "Enable read access for all users" 
  ON public.rankings
  FOR SELECT 
  USING (true);

CREATE POLICY "Enable insert for all users" 
  ON public.rankings
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
  ON public.rankings
  FOR UPDATE 
  USING (true);

CREATE POLICY "Enable delete for all users" 
  ON public.rankings
  FOR DELETE 
  USING (true);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS update_rankings_updated_at ON public.rankings;
CREATE TRIGGER update_rankings_updated_at
  BEFORE UPDATE ON public.rankings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 확인 쿼리
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'rankings';

















