import { getSupabase } from './supabaseClient';
import { SentenceProblem } from '../types/word';

export class SentenceProblemService {
  /**
   * 모든 문장 문제를 가져옵니다
   */
  static async fetchAllProblems(): Promise<SentenceProblem[]> {
    try {
      console.log('🔍 Supabase에서 문장 문제 데이터 로드 시작...');
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      const { data, error } = await supabase
        .from('sentence_problems')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Supabase 문장 문제 조회 실패:', error);
        
        // 테이블이 존재하지 않는 경우 샘플 데이터 반환
        if (error.code === 'PGRST205') {
          console.log('📝 테이블이 존재하지 않습니다. 샘플 데이터를 반환합니다.');
          return this.getSampleProblems();
        }
        
        throw error;
      }

      console.log('✅ Supabase에서 로드된 문장 문제 수:', data?.length || 0);
      
      if (data && data.length > 0) {
        console.log('📝 첫 번째 문제 (원본):', data[0]);
        console.log('📝 첫 번째 문제의 target_words 타입:', typeof data[0].target_words);
        console.log('📝 첫 번째 문제의 target_words 값:', data[0].target_words);
        console.log('📝 모든 문장들:', data.map(d => d.english_sentence));
        
        // 데이터 변환 테스트
        const firstProblem = data[0];
        const convertedProblem = {
          id: firstProblem.id,
          koreanSentence: firstProblem.korean_sentence,
          englishSentence: firstProblem.english_sentence,
          source: firstProblem.source,
          targetWords: typeof firstProblem.target_words === 'string' 
            ? JSON.parse(firstProblem.target_words) 
            : firstProblem.target_words,
          wordCount: firstProblem.word_count,
          level: firstProblem.level
        };
        console.log('📝 변환된 첫 번째 문제:', convertedProblem);
      }

      // Supabase 데이터를 SentenceProblem 형식으로 변환
      const convertedData = (data || []).map((item: any) => ({
        id: item.id,
        koreanSentence: item.korean_sentence,
        englishSentence: item.english_sentence,
        source: item.source,
        targetWords: typeof item.target_words === 'string' 
          ? JSON.parse(item.target_words) 
          : item.target_words,
        wordCount: item.word_count,
        level: item.level
      }));

      console.log('📝 변환된 데이터 첫 번째 항목:', convertedData[0]);
      return convertedData;
    } catch (error) {
      console.error('❌ 문장 문제 로드 중 오류:', error);
      return [];
    }
  }

  /**
   * 특정 레벨의 문장 문제를 가져옵니다
   */
  static async fetchProblemsByLevel(level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'): Promise<SentenceProblem[]> {
    try {
      console.log(`🔍 Supabase에서 ${level} 레벨 문장 문제 로드 시작...`);
      
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      const { data, error } = await supabase
        .from('sentence_problems')
        .select('*')
        .eq('level', level)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`❌ ${level} 레벨 문장 문제 조회 실패:`, error);
        throw error;
      }

      console.log(`✅ ${level} 레벨 문장 문제 수:`, data?.length || 0);
      
      // Supabase 데이터를 SentenceProblem 형식으로 변환
      const convertedData = (data || []).map((item: any) => ({
        id: item.id,
        koreanSentence: item.korean_sentence,
        englishSentence: item.english_sentence,
        source: item.source,
        targetWords: typeof item.target_words === 'string' 
          ? JSON.parse(item.target_words) 
          : item.target_words,
        wordCount: item.word_count,
        level: item.level
      }));
      
      return convertedData;
    } catch (error) {
      console.error(`❌ ${level} 레벨 문장 문제 로드 중 오류:`, error);
      return [];
    }
  }

  /**
   * 특정 출처의 문장 문제를 가져옵니다
   */
  static async fetchProblemsBySource(source: string): Promise<SentenceProblem[]> {
    try {
      console.log(`🔍 Supabase에서 "${source}" 출처 문장 문제 로드 시작...`);
      
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      const { data, error } = await supabase
        .from('sentence_problems')
        .select('*')
        .eq('source', source)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`❌ "${source}" 출처 문장 문제 조회 실패:`, error);
        throw error;
      }

      console.log(`✅ "${source}" 출처 문장 문제 수:`, data?.length || 0);
      return data || [];
    } catch (error) {
      console.error(`❌ "${source}" 출처 문장 문제 로드 중 오류:`, error);
      return [];
    }
  }

  /**
   * 문장 문제를 추가합니다
   */
  static async addProblem(problem: Omit<SentenceProblem, 'id'>): Promise<SentenceProblem | null> {
    try {
      console.log('➕ Supabase에 문장 문제 추가 시작...');
      
      const problemData = {
        ...problem,
        id: `sentence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      const { data, error } = await supabase
        .from('sentence_problems')
        .insert([problemData])
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase 문장 문제 추가 실패:', error);
        throw error;
      }

      console.log('✅ Supabase에 문장 문제 추가 완료:', data);
      return data;
    } catch (error) {
      console.error('❌ 문장 문제 추가 중 오류:', error);
      return null;
    }
  }

  /**
   * 여러 문장 문제를 일괄 추가합니다
   */
  static async addProblems(problems: Omit<SentenceProblem, 'id'>[]): Promise<SentenceProblem[]> {
    try {
      console.log(`➕ Supabase에 ${problems.length}개 문장 문제 일괄 추가 시작...`);
      
      const problemsData = problems.map(problem => ({
        ...problem,
        id: `sentence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      const { data, error } = await supabase
        .from('sentence_problems')
        .insert(problemsData)
        .select();

      if (error) {
        console.error('❌ Supabase 문장 문제 일괄 추가 실패:', error);
        throw error;
      }

      console.log(`✅ Supabase에 ${data?.length || 0}개 문장 문제 추가 완료`);
      return data || [];
    } catch (error) {
      console.error('❌ 문장 문제 일괄 추가 중 오류:', error);
      return [];
    }
  }

  /**
   * 문장 문제를 업데이트합니다
   */
  static async updateProblem(id: string, updates: Partial<SentenceProblem>): Promise<SentenceProblem | null> {
    try {
      console.log(`🔄 Supabase 문장 문제 업데이트 시작 (ID: ${id})...`);
      
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      const { data, error } = await supabase
        .from('sentence_problems')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase 문장 문제 업데이트 실패:', error);
        throw error;
      }

      console.log('✅ Supabase 문장 문제 업데이트 완료:', data);
      return data;
    } catch (error) {
      console.error('❌ 문장 문제 업데이트 중 오류:', error);
      return null;
    }
  }

  /**
   * 문장 문제를 삭제합니다
   */
  static async deleteProblem(id: string): Promise<boolean> {
    try {
      console.log(`🗑️ Supabase 문장 문제 삭제 시작 (ID: ${id})...`);
      
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      const { error } = await supabase
        .from('sentence_problems')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Supabase 문장 문제 삭제 실패:', error);
        throw error;
      }

      console.log('✅ Supabase 문장 문제 삭제 완료');
      return true;
    } catch (error) {
      console.error('❌ 문장 문제 삭제 중 오류:', error);
      return false;
    }
  }

  /**
   * 모든 문장 문제를 삭제합니다 (초기화용)
   */
  static async clearAllProblems(): Promise<boolean> {
    try {
      console.log('🗑️ Supabase 모든 문장 문제 삭제 시작...');
      
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      const { error } = await supabase
        .from('sentence_problems')
        .delete()
        .neq('id', ''); // 모든 행 삭제

      if (error) {
        console.error('❌ Supabase 모든 문장 문제 삭제 실패:', error);
        throw error;
      }

      console.log('✅ Supabase 모든 문장 문제 삭제 완료');
      return true;
    } catch (error) {
      console.error('❌ 모든 문장 문제 삭제 중 오류:', error);
      return false;
    }
  }

  /**
   * 기존 테이블에 RLS를 활성화합니다 (보안 경고 해결용)
   */
  static async enableRLSOnExistingTable(): Promise<boolean> {
    try {
      console.log('🔒 sentence_problems 테이블에 RLS 활성화 시도...');
      
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      // RLS 활성화 및 정책 생성 SQL
      const enableRLSSQL = `
        -- RLS 활성화
        ALTER TABLE public.sentence_problems ENABLE ROW LEVEL SECURITY;

        -- 기존 정책이 있으면 삭제 (중복 방지)
        DROP POLICY IF EXISTS "Enable read access for all users" ON public.sentence_problems;
        DROP POLICY IF EXISTS "Enable insert for all users" ON public.sentence_problems;
        DROP POLICY IF EXISTS "Enable update for all users" ON public.sentence_problems;
        DROP POLICY IF EXISTS "Enable delete for all users" ON public.sentence_problems;

        -- 새로운 정책 생성
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
      `;

      const { error } = await supabase.rpc('exec_sql', { sql: enableRLSSQL });
      
      if (error) {
        console.error('❌ RLS 활성화 실패:', error);
        return false;
      }

      console.log('✅ sentence_problems 테이블에 RLS 활성화 완료');
      return true;
    } catch (error) {
      console.error('❌ RLS 활성화 중 오류:', error);
      return false;
    }
  }

  /**
   * 테이블을 자동으로 생성합니다
   */
  static async createTableIfNotExists(): Promise<boolean> {
    try {
      console.log('🔧 sentence_problems 테이블 생성 시도...');
      
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      // 테이블 생성 SQL 실행
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS sentence_problems (
          id TEXT PRIMARY KEY,
          korean_sentence TEXT NOT NULL,
          english_sentence TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT '',
          target_words JSONB NOT NULL DEFAULT '[]',
          word_count INTEGER NOT NULL DEFAULT 0,
          level TEXT NOT NULL DEFAULT 'BEGINNER' CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- 인덱스 생성
        CREATE INDEX IF NOT EXISTS idx_sentence_problems_level ON sentence_problems(level);
        CREATE INDEX IF NOT EXISTS idx_sentence_problems_source ON sentence_problems(source);
        CREATE INDEX IF NOT EXISTS idx_sentence_problems_word_count ON sentence_problems(word_count);

        -- RLS 활성화
        ALTER TABLE sentence_problems ENABLE ROW LEVEL SECURITY;

        -- 정책 생성 (기존 정책이 있으면 무시)
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sentence_problems' AND policyname = 'Enable read access for all users') THEN
            CREATE POLICY "Enable read access for all users" ON sentence_problems FOR SELECT USING (true);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sentence_problems' AND policyname = 'Enable insert for all users') THEN
            CREATE POLICY "Enable insert for all users" ON sentence_problems FOR INSERT WITH CHECK (true);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sentence_problems' AND policyname = 'Enable update for all users') THEN
            CREATE POLICY "Enable update for all users" ON sentence_problems FOR UPDATE USING (true);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sentence_problems' AND policyname = 'Enable delete for all users') THEN
            CREATE POLICY "Enable delete for all users" ON sentence_problems FOR DELETE USING (true);
          END IF;
        END $$;
      `;

      const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      
      if (error) {
        console.error('❌ 테이블 생성 실패:', error);
        return false;
      }

      console.log('✅ sentence_problems 테이블 생성 완료');
      return true;
    } catch (error) {
      console.error('❌ 테이블 생성 중 오류:', error);
      return false;
    }
  }

  /**
   * 테이블이 없을 때 사용할 샘플 데이터를 반환합니다
   */
  private static getSampleProblems(): SentenceProblem[] {
    console.log('🎯 샘플 문장 문제 데이터 반환');
    
    return [
      {
        id: 'sample_1',
        koreanSentence: '나는 사과를 먹지 않아요.',
        englishSentence: 'I don\'t eat an apple.',
        source: '기적의파닉스1권',
        targetWords: ['I', 'don\'t', 'eat', 'apple', 'an'],
        wordCount: 5,
        level: 'BEGINNER'
      },
      {
        id: 'sample_2',
        koreanSentence: '그녀는 책을 읽고 있어요.',
        englishSentence: 'She is reading a book.',
        source: '기적의파닉스1권',
        targetWords: ['She', 'is', 'reading', 'a', 'book'],
        wordCount: 5,
        level: 'BEGINNER'
      },
      {
        id: 'sample_3',
        koreanSentence: '우리는 학교에 가요.',
        englishSentence: 'We go to school.',
        source: '기적의파닉스1권',
        targetWords: ['We', 'go', 'to', 'school'],
        wordCount: 4,
        level: 'BEGINNER'
      },
      {
        id: 'sample_4',
        koreanSentence: '그들은 영화를 보고 있어요.',
        englishSentence: 'They are watching a movie.',
        source: '기적의파닉스1권',
        targetWords: ['They', 'are', 'watching', 'a', 'movie'],
        wordCount: 5,
        level: 'INTERMEDIATE'
      },
      {
        id: 'sample_5',
        koreanSentence: '나는 커피를 마셔요.',
        englishSentence: 'I drink coffee.',
        source: '기적의파닉스1권',
        targetWords: ['I', 'drink', 'coffee'],
        wordCount: 3,
        level: 'BEGINNER'
      },
      {
        id: 'sample_6',
        koreanSentence: '당신은 무엇을 하고 있나요?',
        englishSentence: 'What are you doing?',
        source: '기적의파닉스1권',
        targetWords: ['What', 'are', 'you', 'doing'],
        wordCount: 4,
        level: 'INTERMEDIATE'
      }
    ];
  }

  /**
   * 통계 정보를 가져옵니다
   */
  static async getStatistics(): Promise<{
    total: number;
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    try {
      console.log('📊 Supabase 문장 문제 통계 조회 시작...');
      
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Supabase 클라이언트를 초기화할 수 없습니다.');
      }

      const { data, error } = await supabase
        .from('sentence_problems')
        .select('level, source');

      if (error) {
        console.error('❌ Supabase 문장 문제 통계 조회 실패:', error);
        
        // 테이블이 존재하지 않는 경우 샘플 데이터 통계 반환
        if (error.code === 'PGRST205') {
          console.log('📝 테이블이 존재하지 않습니다. 샘플 데이터 통계를 반환합니다.');
          const sampleProblems = this.getSampleProblems();
          const sampleStats = {
            total: sampleProblems.length,
            byLevel: {} as Record<string, number>,
            bySource: {} as Record<string, number>
          };
          
          sampleProblems.forEach(problem => {
            sampleStats.byLevel[problem.level] = (sampleStats.byLevel[problem.level] || 0) + 1;
            sampleStats.bySource[problem.source] = (sampleStats.bySource[problem.source] || 0) + 1;
          });
          
          return sampleStats;
        }
        
        throw error;
      }

      const stats = {
        total: data?.length || 0,
        byLevel: {} as Record<string, number>,
        bySource: {} as Record<string, number>
      };

      // 레벨별 통계
      data?.forEach((item: { level: string; source: string }) => {
        stats.byLevel[item.level] = (stats.byLevel[item.level] || 0) + 1;
        stats.bySource[item.source] = (stats.bySource[item.source] || 0) + 1;
      });

      console.log('✅ 문장 문제 통계:', stats);
      return stats;
    } catch (error) {
      console.error('❌ 문장 문제 통계 조회 중 오류:', error);
      return { total: 0, byLevel: {}, bySource: {} };
    }
  }
}
