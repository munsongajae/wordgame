-- 모든 학습 기록 테이블에 RLS 활성화 및 정책 설정
-- Supabase 보안 경고 및 406 오류 해결을 위한 마이그레이션

-- ============================================
-- 1. progresses 테이블
-- ============================================
ALTER TABLE public.progresses ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (중복 방지)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.progresses;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.progresses;
DROP POLICY IF EXISTS "Enable update for all users" ON public.progresses;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.progresses;

-- 새로운 정책 생성
CREATE POLICY "Enable read access for all users" 
  ON public.progresses
  FOR SELECT 
  USING (true);

CREATE POLICY "Enable insert for all users" 
  ON public.progresses
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
  ON public.progresses
  FOR UPDATE 
  USING (true);

CREATE POLICY "Enable delete for all users" 
  ON public.progresses
  FOR DELETE 
  USING (true);

-- ============================================
-- 2. sessions 테이블
-- ============================================
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.sessions;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.sessions;
DROP POLICY IF EXISTS "Enable update for all users" ON public.sessions;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.sessions;

CREATE POLICY "Enable read access for all users" 
  ON public.sessions
  FOR SELECT 
  USING (true);

CREATE POLICY "Enable insert for all users" 
  ON public.sessions
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
  ON public.sessions
  FOR UPDATE 
  USING (true);

CREATE POLICY "Enable delete for all users" 
  ON public.sessions
  FOR DELETE 
  USING (true);

-- ============================================
-- 3. attempts 테이블
-- ============================================
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.attempts;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.attempts;
DROP POLICY IF EXISTS "Enable update for all users" ON public.attempts;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.attempts;

CREATE POLICY "Enable read access for all users" 
  ON public.attempts
  FOR SELECT 
  USING (true);

CREATE POLICY "Enable insert for all users" 
  ON public.attempts
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
  ON public.attempts
  FOR UPDATE 
  USING (true);

CREATE POLICY "Enable delete for all users" 
  ON public.attempts
  FOR DELETE 
  USING (true);

-- ============================================
-- 4. sentence_problems 테이블 (이미 있으면 스킵)
-- ============================================
ALTER TABLE public.sentence_problems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.sentence_problems;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.sentence_problems;
DROP POLICY IF EXISTS "Enable update for all users" ON public.sentence_problems;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.sentence_problems;

CREATE POLICY "Enable read access for all users" 
  ON public.sentence_problems
  FOR SELECT 
  USING (true);

CREATE POLICY "Enable insert for all users" 
  ON public.sentence_problems
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Enable update for all users" 
  ON public.sentence_problems
  FOR UPDATE 
  USING (true);

CREATE POLICY "Enable delete for all users" 
  ON public.sentence_problems
  FOR DELETE 
  USING (true);

-- ============================================
-- 확인: 모든 테이블의 RLS 상태 확인
-- ============================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('progresses', 'sessions', 'attempts', 'sentence_problems')
ORDER BY tablename;

-- ============================================
-- 확인: 모든 테이블의 정책 확인
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('progresses', 'sessions', 'attempts', 'sentence_problems')
ORDER BY tablename, policyname;


