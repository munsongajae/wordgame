import { GoogleSheetsService } from './googleSheetsService';
import { SentenceProblemService } from './sentenceProblemService';
import { SentenceProblem } from '../types/word';

export class SentenceMigrationService {
  /**
   * 구글 시트에서 문장 문제를 가져와서 Supabase로 마이그레이션합니다
   */
  static async migrateFromGoogleSheets(): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
  }> {
    console.log('🚀 구글 시트에서 Supabase로 문장 문제 마이그레이션 시작...');
    
    const result = {
      success: false,
      imported: 0,
      errors: [] as string[]
    };

    try {
      // 1. 구글 시트에서 문장 문제 가져오기
      console.log('📥 구글 시트에서 문장 문제 데이터 로드...');
      const googleProblems = await GoogleSheetsService.fetchSentenceProblems();
      
      if (googleProblems.length === 0) {
        result.errors.push('구글 시트에서 문장 문제를 찾을 수 없습니다.');
        return result;
      }

      console.log(`✅ 구글 시트에서 ${googleProblems.length}개 문장 문제 로드 완료`);

      // 2. 기존 Supabase 데이터 초기화 (선택사항)
      const shouldClearExisting = window.confirm(
        `기존 Supabase 문장 문제 데이터를 모두 삭제하고 새로 가져오시겠습니까?\n\n` +
        `가져올 데이터: ${googleProblems.length}개 문장 문제\n` +
        `레벨별: ${this.getLevelStats(googleProblems)}\n` +
        `출처별: ${this.getSourceStats(googleProblems)}`
      );

      if (shouldClearExisting) {
        console.log('🗑️ 기존 Supabase 데이터 삭제...');
        await SentenceProblemService.clearAllProblems();
      }

      // 3. Supabase에 데이터 추가
      console.log('📤 Supabase에 문장 문제 데이터 추가...');
      const importedProblems = await SentenceProblemService.addProblems(
        googleProblems.map(problem => ({
          koreanSentence: problem.koreanSentence,
          englishSentence: problem.englishSentence,
          source: problem.source,
          targetWords: problem.targetWords,
          wordCount: problem.wordCount,
          level: problem.level
        }))
      );

      result.imported = importedProblems.length;
      result.success = true;

      console.log(`✅ 마이그레이션 완료! ${result.imported}개 문장 문제 추가됨`);

      // 4. 최종 통계 표시
      const stats = await SentenceProblemService.getStatistics();
      console.log('📊 최종 Supabase 통계:', stats);

    } catch (error) {
      console.error('❌ 마이그레이션 중 오류:', error);
      result.errors.push(`마이그레이션 실패: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * 구글 시트와 Supabase 데이터를 비교합니다
   */
  static async compareData(): Promise<{
    googleCount: number;
    supabaseCount: number;
    differences: string[];
  }> {
    console.log('🔍 구글 시트와 Supabase 데이터 비교 시작...');
    
    const result = {
      googleCount: 0,
      supabaseCount: 0,
      differences: [] as string[]
    };

    try {
      // 구글 시트 데이터
      const googleProblems = await GoogleSheetsService.fetchSentenceProblems();
      result.googleCount = googleProblems.length;

      // Supabase 데이터
      const supabaseProblems = await SentenceProblemService.fetchAllProblems();
      result.supabaseCount = supabaseProblems.length;

      // 데이터 비교
      if (result.googleCount !== result.supabaseCount) {
        result.differences.push(
          `데이터 개수 차이: 구글 시트 ${result.googleCount}개, Supabase ${result.supabaseCount}개`
        );
      }

      // 출처별 비교
      const googleSources = this.getSourceStats(googleProblems);
      const supabaseSources = this.getSourceStats(supabaseProblems);
      
      if (JSON.stringify(googleSources) !== JSON.stringify(supabaseSources)) {
        result.differences.push(
          `출처별 데이터 차이: 구글 ${JSON.stringify(googleSources)}, Supabase ${JSON.stringify(supabaseSources)}`
        );
      }

      console.log('✅ 데이터 비교 완료:', result);

    } catch (error) {
      console.error('❌ 데이터 비교 중 오류:', error);
      result.differences.push(`비교 실패: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * 테스트용 샘플 데이터를 Supabase에 추가합니다
   */
  static async addSampleData(): Promise<boolean> {
    console.log('🧪 테스트용 샘플 데이터 추가 시작...');
    
    const sampleProblems: Omit<SentenceProblem, 'id'>[] = [
      {
        koreanSentence: '나는 사과를 먹지 않아요.',
        englishSentence: 'I don\'t eat an apple.',
        source: '기적의파닉스1권',
        targetWords: ['I', 'don\'t', 'eat', 'apple', 'an'],
        wordCount: 5,
        level: 'BEGINNER'
      },
      {
        koreanSentence: '그녀는 책을 읽고 있어요.',
        englishSentence: 'She is reading a book.',
        source: '기적의파닉스1권',
        targetWords: ['She', 'is', 'reading', 'a', 'book'],
        wordCount: 5,
        level: 'BEGINNER'
      },
      {
        koreanSentence: '우리는 학교에 가요.',
        englishSentence: 'We go to school.',
        source: '기적의파닉스1권',
        targetWords: ['We', 'go', 'to', 'school'],
        wordCount: 4,
        level: 'BEGINNER'
      },
      {
        koreanSentence: '그들은 영화를 보고 있어요.',
        englishSentence: 'They are watching a movie.',
        source: '기적의파닉스1권',
        targetWords: ['They', 'are', 'watching', 'a', 'movie'],
        wordCount: 5,
        level: 'INTERMEDIATE'
      }
    ];

    try {
      const importedProblems = await SentenceProblemService.addProblems(sampleProblems);
      console.log(`✅ 샘플 데이터 추가 완료: ${importedProblems.length}개`);
      return true;
    } catch (error) {
      console.error('❌ 샘플 데이터 추가 실패:', error);
      return false;
    }
  }

  /**
   * 레벨별 통계를 가져옵니다
   */
  private static getLevelStats(problems: SentenceProblem[]): string {
    const stats = problems.reduce((acc, problem) => {
      acc[problem.level] = (acc[problem.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(stats)
      .map(([level, count]) => `${level}: ${count}개`)
      .join(', ');
  }

  /**
   * 출처별 통계를 가져옵니다
   */
  private static getSourceStats(problems: SentenceProblem[]): Record<string, number> {
    return problems.reduce((acc, problem) => {
      acc[problem.source] = (acc[problem.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
