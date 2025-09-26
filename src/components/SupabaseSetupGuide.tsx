import React, { useState } from 'react';
import { SentenceMigrationService } from '../services/sentenceMigrationService';

interface SupabaseSetupGuideProps {
  onBack: () => void;
}

const SupabaseSetupGuide: React.FC<SupabaseSetupGuideProps> = ({ onBack }) => {
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean;
    imported: number;
    errors: string[];
  } | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('SQL이 클립보드에 복사되었습니다!');
    }).catch(err => {
      console.error('복사 실패:', err);
    });
  };

  const migrateFromGoogleSheets = async () => {
    setMigrating(true);
    setMigrationResult(null);
    
    try {
      const result = await SentenceMigrationService.migrateFromGoogleSheets();
      setMigrationResult(result);
      
      if (result.success && result.imported > 0) {
        alert(`✅ 마이그레이션 완료!\n${result.imported}개의 문장 문제가 가져와졌습니다.`);
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      console.error('마이그레이션 실패:', error);
      setMigrationResult({
        success: false,
        imported: 0,
        errors: [`마이그레이션 실패: ${error instanceof Error ? error.message : String(error)}`]
      });
    } finally {
      setMigrating(false);
    }
  };


  const sqlCode = `-- 문장 문제 테이블 생성 (기존 테이블 구조 참고)
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

-- RLS (Row Level Security) 활성화 (기존 테이블들과 동일한 방식)
ALTER TABLE sentence_problems ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있도록 정책 설정 (기존 테이블들과 동일)
CREATE POLICY "Enable read access for all users" ON sentence_problems
  FOR SELECT USING (true);

-- 모든 사용자가 삽입/수정/삭제할 수 있도록 정책 설정 (기존 테이블들과 동일)
CREATE POLICY "Enable insert for all users" ON sentence_problems
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON sentence_problems
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for all users" ON sentence_problems
  FOR DELETE USING (true);`;

  const sampleDataSql = `-- 샘플 데이터 삽입
INSERT INTO sentence_problems (id, korean_sentence, english_sentence, source, target_words, word_count, level) VALUES
('sample_1', '나는 사과를 먹지 않아요.', 'I don''t eat an apple.', '기적의파닉스1권', '["I", "don''t", "eat", "apple", "an"]', 5, 'BEGINNER'),
('sample_2', '그녀는 책을 읽고 있어요.', 'She is reading a book.', '기적의파닉스1권', '["She", "is", "reading", "a", "book"]', 5, 'BEGINNER'),
('sample_3', '우리는 학교에 가요.', 'We go to school.', '기적의파닉스1권', '["We", "go", "to", "school"]', 4, 'BEGINNER'),
('sample_4', '그들은 영화를 보고 있어요.', 'They are watching a movie.', '기적의파닉스1권', '["They", "are", "watching", "a", "movie"]', 5, 'INTERMEDIATE'),
('sample_5', '나는 커피를 마셔요.', 'I drink coffee.', '기적의파닉스1권', '["I", "drink", "coffee"]', 3, 'BEGINNER'),
('sample_6', '당신은 무엇을 하고 있나요?', 'What are you doing?', '기적의파닉스1권', '["What", "are", "you", "doing"]', 4, 'INTERMEDIATE');`;

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h2>🔧 Supabase 설정 가이드</h2>
      
      <div style={{
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3 style={{ color: '#856404', margin: '0 0 10px 0' }}>
          ⚠️ 문장 문제 테이블이 존재하지 않습니다
        </h3>
        <p style={{ color: '#856404', margin: 0 }}>
          Supabase 연결은 정상이지만 <code>sentence_problems</code> 테이블만 없습니다. 
          아래 SQL을 실행하여 테이블을 생성하면 문장 만들기 게임을 사용할 수 있습니다.
        </p>
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '10px', 
          borderRadius: '4px', 
          marginTop: '10px',
          fontSize: '14px',
          color: '#856404'
        }}>
          ✅ 기존 테이블들 (sessions, attempts, progresses)은 정상 작동 중
        </div>
      </div>

      {/* 자동 테이블 생성 시도 */}
      <div style={{
        backgroundColor: '#e8f5e8',
        border: '1px solid #4caf50',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3 style={{ color: '#2e7d32', margin: '0 0 15px 0' }}>
          🚀 빠른 해결 방법
        </h3>
        <p style={{ color: '#2e7d32', margin: '0 0 15px 0' }}>
          아래 "SQL 복사" 버튼을 클릭한 후, Supabase Dashboard에서 붙여넣기만 하면 됩니다!
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => copyToClipboard(sqlCode)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#2e7d32',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            📋 SQL 복사하기
          </button>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '12px 24px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            🚀 Supabase Dashboard 열기
          </a>
        </div>
      </div>

      {/* 데이터 마이그레이션 */}
      <div style={{
        backgroundColor: '#e3f2fd',
        border: '1px solid #2196f3',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3 style={{ color: '#1976d2', margin: '0 0 15px 0' }}>
          📊 구글 시트 데이터 가져오기
        </h3>
        <p style={{ color: '#1976d2', margin: '0 0 15px 0' }}>
          테이블 생성이 완료되면 구글 시트2번의 문장 문제 데이터를 Supabase로 가져올 수 있습니다.
        </p>
        <button
          onClick={migrateFromGoogleSheets}
          disabled={migrating}
          style={{
            padding: '12px 24px',
            backgroundColor: migrating ? '#ccc' : '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: migrating ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {migrating ? '🔄 데이터 가져오는 중...' : '📥 구글 시트에서 데이터 가져오기'}
        </button>

        {migrationResult && (
          <div style={{
            backgroundColor: migrationResult.success ? '#e8f5e8' : '#fde8e8',
            border: `1px solid ${migrationResult.success ? '#4CAF50' : '#f44336'}`,
            padding: '15px',
            borderRadius: '4px',
            marginTop: '15px'
          }}>
            <h4 style={{ 
              color: migrationResult.success ? '#2e7d32' : '#c62828', 
              margin: '0 0 10px 0' 
            }}>
              {migrationResult.success ? '✅ 마이그레이션 완료' : '❌ 마이그레이션 실패'}
            </h4>
            
            {migrationResult.imported > 0 && (
              <p style={{ margin: '5px 0', color: '#2e7d32' }}>
                <strong>가져온 데이터:</strong> {migrationResult.imported}개 문장 문제
              </p>
            )}
            
            {migrationResult.errors.length > 0 && (
              <div>
                <strong style={{ color: '#c62828' }}>오류:</strong>
                <ul style={{ margin: '5px 0', paddingLeft: '20px', color: '#c62828' }}>
                  {migrationResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3>📋 1단계: Supabase Dashboard 접속 (테이블 생성)</h3>
        <ol>
          <li>
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#1976d2', textDecoration: 'none' }}
            >
              Supabase Dashboard
            </a>에 접속하세요
          </li>
          <li>프로젝트를 선택하세요</li>
          <li>왼쪽 메뉴에서 <strong>"SQL Editor"</strong>를 클릭하세요</li>
        </ol>
      </div>

      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3>📋 2단계: 테이블 생성 SQL 실행</h3>
        <p>아래 SQL 코드를 복사하여 SQL Editor에서 실행하세요:</p>
        
        <div style={{
          backgroundColor: '#f1f3f4',
          border: '1px solid #dadce0',
          borderRadius: '4px',
          padding: '15px',
          margin: '10px 0',
          position: 'relative'
        }}>
          <button
            onClick={() => copyToClipboard(sqlCode)}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              padding: '5px 10px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            복사
          </button>
          <pre style={{ 
            margin: 0, 
            fontSize: '14px', 
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'Monaco, Consolas, "Courier New", monospace'
          }}>
            {sqlCode}
          </pre>
        </div>
      </div>

      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3>📋 3단계: 샘플 데이터 삽입 (선택사항)</h3>
        <p>테스트를 위해 샘플 데이터를 추가하려면 아래 SQL을 실행하세요:</p>
        
        <div style={{
          backgroundColor: '#f1f3f4',
          border: '1px solid #dadce0',
          borderRadius: '4px',
          padding: '15px',
          margin: '10px 0',
          position: 'relative'
        }}>
          <button
            onClick={() => copyToClipboard(sampleDataSql)}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              padding: '5px 10px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            복사
          </button>
          <pre style={{ 
            margin: 0, 
            fontSize: '14px', 
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontFamily: 'Monaco, Consolas, "Courier New", monospace'
          }}>
            {sampleDataSql}
          </pre>
        </div>
      </div>

      <div style={{
        backgroundColor: '#e8f5e8',
        border: '1px solid #4caf50',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3 style={{ color: '#2e7d32', margin: '0 0 10px 0' }}>
          ✅ 4단계: 확인
        </h3>
        <ol style={{ color: '#2e7d32' }}>
          <li>SQL 실행이 완료되면 <strong>"Table Editor"</strong>에서 <code>sentence_problems</code> 테이블이 생성되었는지 확인하세요</li>
          <li>샘플 데이터를 추가했다면 데이터가 올바르게 삽입되었는지 확인하세요</li>
          <li>이 페이지를 새로고침하여 문장 만들기 게임을 시작하세요</li>
        </ol>
      </div>

      <div style={{
        backgroundColor: '#e3f2fd',
        border: '1px solid #2196f3',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3 style={{ color: '#1976d2', margin: '0 0 10px 0' }}>
          💡 추가 정보
        </h3>
        <ul style={{ color: '#1976d2' }}>
          <li><strong>target_words</strong> 필드는 JSON 배열 형태로 저장됩니다 (예: ["I", "don't", "eat", "apple"])</li>
          <li><strong>level</strong> 필드는 'BEGINNER', 'INTERMEDIATE', 'ADVANCED' 중 하나여야 합니다</li>
          <li>테이블 생성 후 RLS(Row Level Security)가 활성화되어 모든 사용자가 읽을 수 있습니다</li>
          <li>구글 시트에서 데이터를 가져오려면 마이그레이션 도구를 사용하세요</li>
        </ul>
      </div>

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

export default SupabaseSetupGuide;
