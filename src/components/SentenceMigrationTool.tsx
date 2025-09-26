import React, { useState } from 'react';
import { SentenceMigrationService } from '../services/sentenceMigrationService';
import { SentenceProblemService } from '../services/sentenceProblemService';

interface SentenceMigrationToolProps {
  onBack: () => void;
}

const SentenceMigrationTool: React.FC<SentenceMigrationToolProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    imported: number;
    errors: string[];
  } | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
  } | null>(null);

  // 통계 조회
  const loadStats = async () => {
    try {
      setLoading(true);
      const statistics = await SentenceProblemService.getStatistics();
      setStats(statistics);
    } catch (error) {
      console.error('통계 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 구글 시트에서 마이그레이션
  const handleMigration = async () => {
    try {
      setLoading(true);
      setResult(null);
      
      const migrationResult = await SentenceMigrationService.migrateFromGoogleSheets();
      setResult(migrationResult);
      
      // 마이그레이션 후 통계 새로고침
      await loadStats();
    } catch (error) {
      console.error('마이그레이션 실패:', error);
      setResult({
        success: false,
        imported: 0,
        errors: [`마이그레이션 실패: ${error instanceof Error ? error.message : String(error)}`]
      });
    } finally {
      setLoading(false);
    }
  };

  // 샘플 데이터 추가
  const handleAddSampleData = async () => {
    try {
      setLoading(true);
      setResult(null);
      
      const success = await SentenceMigrationService.addSampleData();
      setResult({
        success,
        imported: success ? 4 : 0,
        errors: success ? [] : ['샘플 데이터 추가 실패']
      });
      
      // 추가 후 통계 새로고침
      await loadStats();
    } catch (error) {
      console.error('샘플 데이터 추가 실패:', error);
      setResult({
        success: false,
        imported: 0,
        errors: [`샘플 데이터 추가 실패: ${error instanceof Error ? error.message : String(error)}`]
      });
    } finally {
      setLoading(false);
    }
  };

  // 데이터 비교
  const handleCompareData = async () => {
    try {
      setLoading(true);
      const compareResult = await SentenceMigrationService.compareData();
      
      setResult({
        success: compareResult.differences.length === 0,
        imported: compareResult.supabaseCount,
        errors: compareResult.differences
      });
    } catch (error) {
      console.error('데이터 비교 실패:', error);
      setResult({
        success: false,
        imported: 0,
        errors: [`데이터 비교 실패: ${error instanceof Error ? error.message : String(error)}`]
      });
    } finally {
      setLoading(false);
    }
  };

  // 모든 데이터 삭제
  const handleClearAllData = async () => {
    if (window.confirm('⚠️ 모든 문장 문제 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      try {
        setLoading(true);
        const success = await SentenceProblemService.clearAllProblems();
        
        setResult({
          success,
          imported: 0,
          errors: success ? [] : ['데이터 삭제 실패']
        });
        
        // 삭제 후 통계 새로고침
        await loadStats();
      } catch (error) {
        console.error('데이터 삭제 실패:', error);
        setResult({
          success: false,
          imported: 0,
          errors: [`데이터 삭제 실패: ${error instanceof Error ? error.message : String(error)}`]
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🔧 문장 문제 관리 도구</h2>
      
      {/* 현재 통계 */}
      <div style={{
        backgroundColor: '#f5f5f5',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3>📊 현재 Supabase 데이터 통계</h3>
        {loading ? (
          <p>통계 로드 중...</p>
        ) : stats ? (
          <div>
            <p><strong>총 문장 문제:</strong> {stats.total}개</p>
            <div style={{ marginTop: '10px' }}>
              <strong>레벨별:</strong>
              <ul>
                {Object.entries(stats.byLevel).map(([level, count]) => (
                  <li key={level}>{level}: {count}개</li>
                ))}
              </ul>
            </div>
            <div style={{ marginTop: '10px' }}>
              <strong>출처별:</strong>
              <ul>
                {Object.entries(stats.bySource).map(([source, count]) => (
                  <li key={source}>{source}: {count}개</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <button 
            onClick={loadStats}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            통계 조회
          </button>
        )}
      </div>

      {/* 마이그레이션 도구 */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3>🚀 데이터 마이그레이션</h3>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button
            onClick={handleMigration}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            구글 시트 → Supabase 마이그레이션
          </button>
          
          <button
            onClick={handleCompareData}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            데이터 비교
          </button>
          
          <button
            onClick={handleAddSampleData}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            샘플 데이터 추가
          </button>
          
          <button
            onClick={handleClearAllData}
            disabled={loading}
            style={{
              padding: '12px 24px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            모든 데이터 삭제
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p>작업 중...</p>
          </div>
        )}

        {result && (
          <div style={{
            backgroundColor: result.success ? '#e8f5e8' : '#fde8e8',
            border: `1px solid ${result.success ? '#4CAF50' : '#f44336'}`,
            padding: '15px',
            borderRadius: '4px',
            marginTop: '10px'
          }}>
            <h4 style={{ color: result.success ? '#2e7d32' : '#c62828', margin: '0 0 10px 0' }}>
              {result.success ? '✅ 작업 완료' : '❌ 작업 실패'}
            </h4>
            
            {result.imported > 0 && (
              <p style={{ margin: '5px 0' }}>
                <strong>가져온 데이터:</strong> {result.imported}개
              </p>
            )}
            
            {result.errors.length > 0 && (
              <div>
                <strong>오류:</strong>
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  {result.errors.map((error, index) => (
                    <li key={index} style={{ color: '#c62828' }}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 사용 방법 */}
      <div style={{
        backgroundColor: '#e3f2fd',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3>📖 사용 방법</h3>
        <ol>
          <li><strong>통계 조회:</strong> 현재 Supabase에 저장된 문장 문제 데이터의 통계를 확인합니다.</li>
          <li><strong>마이그레이션:</strong> 구글 시트에서 문장 문제를 가져와서 Supabase에 저장합니다.</li>
          <li><strong>데이터 비교:</strong> 구글 시트와 Supabase의 데이터를 비교합니다.</li>
          <li><strong>샘플 데이터:</strong> 테스트용 샘플 문장 문제 4개를 추가합니다.</li>
          <li><strong>데이터 삭제:</strong> 모든 문장 문제 데이터를 삭제합니다 (주의!).</li>
        </ol>
      </div>

      {/* 돌아가기 버튼 */}
      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <button
          onClick={onBack}
          style={{
            padding: '12px 24px',
            backgroundColor: '#757575',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
};

export default SentenceMigrationTool;
