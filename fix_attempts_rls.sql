-- attempts 테이블에 RLS 활성화 및 정책 설정
-- Supabase 보안 경고 해결을 위한 마이그레이션

-- 1. RLS 활성화
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;

-- 2. 기존 정책이 있으면 삭제 (중복 방지)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.attempts;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.attempts;
DROP POLICY IF EXISTS "Enable update for all users" ON public.attempts;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.attempts;

-- 3. 새로운 정책 생성
-- 모든 사용자가 읽을 수 있도록
CREATE POLICY "Enable read access for all users" 
  ON public.attempts
  FOR SELECT 
  USING (true);

-- 모든 사용자가 삽입할 수 있도록
CREATE POLICY "Enable insert for all users" 
  ON public.attempts
  FOR INSERT 
  WITH CHECK (true);

-- 모든 사용자가 수정할 수 있도록
CREATE POLICY "Enable update for all users" 
  ON public.attempts
  FOR UPDATE 
  USING (true);

-- 모든 사용자가 삭제할 수 있도록
CREATE POLICY "Enable delete for all users" 
  ON public.attempts
  FOR DELETE 
  USING (true);

-- 확인: RLS가 활성화되었는지 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'attempts';

-- 확인: 정책이 생성되었는지 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'attempts';


