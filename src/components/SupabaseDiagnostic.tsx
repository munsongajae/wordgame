import React, { useState, useEffect } from 'react';
import { getSupabase } from '../services/supabaseClient';

interface SupabaseDiagnosticProps {
  onBack: () => void;
}

const SupabaseDiagnostic: React.FC<SupabaseDiagnosticProps> = ({ onBack }) => {
  const [diagnostics, setDiagnostics] = useState<{
    envVars: {
      url: boolean;
      key: boolean;
      urlValue?: string;
      keyValue?: string;
    };
    connection: boolean | null;
    error?: string;
    tables: string[];
    canCreateTable: boolean | null;
  }>({
    envVars: { url: false, key: false, urlValue: undefined, keyValue: undefined },
    connection: null,
    tables: [],
    canCreateTable: null
  });

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    console.log('🔍 Supabase 진단 시작...');
    
    const newDiagnostics = {
      envVars: {
        url: false,
        key: false,
        urlValue: undefined as string | undefined,
        keyValue: undefined as string | undefined
      },
      connection: null as boolean | null,
      error: undefined as string | undefined,
      tables: [] as string[],
      canCreateTable: null as boolean | null
    };

    // 1. 환경 변수 확인
    const url = process.env.REACT_APP_SUPABASE_URL;
    const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
    
    newDiagnostics.envVars.url = !!url;
    newDiagnostics.envVars.key = !!key;
    newDiagnostics.envVars.urlValue = url;
    newDiagnostics.envVars.keyValue = key ? `${key.substring(0, 20)}...` : undefined;

    console.log('📋 환경 변수:', {
      url: !!url,
      key: !!key,
      urlValue: url,
      keyPrefix: key ? key.substring(0, 20) + '...' : '없음'
    });

    if (!url || !key) {
      newDiagnostics.error = '환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.';
      setDiagnostics(newDiagnostics);
      return;
    }

    // 2. Supabase 클라이언트 초기화 확인
    try {
      const supabase = getSupabase();
      if (!supabase) {
        newDiagnostics.error = 'Supabase 클라이언트 초기화 실패';
        setDiagnostics(newDiagnostics);
        return;
      }

      newDiagnostics.connection = true;
      console.log('✅ Supabase 클라이언트 초기화 성공');

      // 3. 연결 테스트 (기존 테이블 사용)
      try {
        // 기존에 존재하는 테이블로 연결 테스트
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('sessions')
          .select('id')
          .limit(1);

        if (sessionsError && sessionsError.code === 'PGRST116') {
          // sessions 테이블이 없으면 attempts 테이블로 시도
          const { data: attemptsData, error: attemptsError } = await supabase
            .from('attempts')
            .select('id')
            .limit(1);

          if (attemptsError && attemptsError.code === 'PGRST116') {
            // attempts 테이블도 없으면 progresses 테이블로 시도
            const { data: progressesData, error: progressesError } = await supabase
              .from('progresses')
              .select('user_id')
              .limit(1);

            if (progressesError && progressesError.code === 'PGRST116') {
              newDiagnostics.connection = false;
              newDiagnostics.error = '모든 기존 테이블(sessions, attempts, progresses)을 찾을 수 없습니다.';
            } else if (progressesError) {
              newDiagnostics.connection = false;
              newDiagnostics.error = `연결 테스트 실패: ${progressesError.message}`;
            } else {
              newDiagnostics.connection = true;
              newDiagnostics.tables = ['progresses'];
              console.log('✅ Supabase 연결 성공 (progresses 테이블 확인)');
            }
          } else if (attemptsError) {
            newDiagnostics.connection = false;
            newDiagnostics.error = `연결 테스트 실패: ${attemptsError.message}`;
          } else {
            newDiagnostics.connection = true;
            newDiagnostics.tables = ['attempts'];
            console.log('✅ Supabase 연결 성공 (attempts 테이블 확인)');
          }
        } else if (sessionsError) {
          newDiagnostics.connection = false;
          newDiagnostics.error = `연결 테스트 실패: ${sessionsError.message}`;
        } else {
          newDiagnostics.connection = true;
          newDiagnostics.tables = ['sessions'];
          console.log('✅ Supabase 연결 성공 (sessions 테이블 확인)');
        }

        // 추가 테이블들 확인
        if (newDiagnostics.connection) {
          try {
            const { data: additionalTables } = await supabase
              .from('information_schema.tables')
              .select('table_name')
              .eq('table_schema', 'public')
              .in('table_name', ['attempts', 'progresses', 'sessions', 'sentence_problems']);

            if (additionalTables) {
              newDiagnostics.tables = additionalTables.map(item => item.table_name);
              console.log('📋 발견된 테이블들:', newDiagnostics.tables);
            }
          } catch (schemaError) {
            console.log('⚠️ information_schema 접근 실패, 기본 테이블만 표시');
          }
        }
      } catch (testError) {
        console.error('❌ 연결 테스트 실패:', testError);
        newDiagnostics.connection = false;
        newDiagnostics.error = `연결 테스트 실패: ${testError instanceof Error ? testError.message : String(testError)}`;
      }

      // 4. 테이블 생성 권한 테스트
      if (newDiagnostics.connection) {
        try {
          // sentence_problems 테이블이 있는지 확인
          const { data, error } = await supabase
            .from('sentence_problems')
            .select('id')
            .limit(1);

          if (error && error.code === 'PGRST116') {
            // 테이블이 없으면 권한이 있다고 가정 (생성 가능)
            newDiagnostics.canCreateTable = true;
            console.log('📝 sentence_problems 테이블이 없습니다. 생성이 필요합니다.');
          } else if (error) {
            newDiagnostics.canCreateTable = false;
            console.log('❌ sentence_problems 테이블 접근 실패:', error.message);
          } else {
            newDiagnostics.canCreateTable = true;
            console.log('✅ sentence_problems 테이블이 이미 존재합니다.');
          }
        } catch (createError) {
          console.log('⚠️ 테이블 권한 테스트 실패:', createError);
          newDiagnostics.canCreateTable = false;
        }
      }

    } catch (error) {
      console.error('❌ Supabase 클라이언트 오류:', error);
      newDiagnostics.connection = false;
      newDiagnostics.error = `클라이언트 오류: ${error instanceof Error ? error.message : String(error)}`;
    }

    setDiagnostics(newDiagnostics);
    console.log('🎯 진단 완료:', newDiagnostics);
  };

  const getStatusColor = (status: boolean | null) => {
    if (status === true) return '#4caf50';
    if (status === false) return '#f44336';
    return '#ff9800';
  };

  const getStatusText = (status: boolean | null) => {
    if (status === true) return '✅ 성공';
    if (status === false) return '❌ 실패';
    return '⚠️ 확인 중';
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>🔧 Supabase 진단 도구</h2>
      
      {/* 환경 변수 확인 */}
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3>📋 1. 환경 변수 확인</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <strong>REACT_APP_SUPABASE_URL:</strong>
            <div style={{ 
              color: getStatusColor(diagnostics.envVars.url),
              fontWeight: 'bold',
              marginTop: '5px'
            }}>
              {getStatusText(diagnostics.envVars.url)}
            </div>
            {diagnostics.envVars.urlValue && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                {diagnostics.envVars.urlValue}
              </div>
            )}
          </div>
          <div>
            <strong>REACT_APP_SUPABASE_ANON_KEY:</strong>
            <div style={{ 
              color: getStatusColor(diagnostics.envVars.key),
              fontWeight: 'bold',
              marginTop: '5px'
            }}>
              {getStatusText(diagnostics.envVars.key)}
            </div>
            {diagnostics.envVars.keyValue && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                {diagnostics.envVars.keyValue}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 연결 상태 확인 */}
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3>📋 2. Supabase 연결 상태</h3>
        <div style={{ 
          color: getStatusColor(diagnostics.connection),
          fontWeight: 'bold',
          fontSize: '18px',
          margin: '10px 0'
        }}>
          {getStatusText(diagnostics.connection)}
        </div>
        
        {diagnostics.error && (
          <div style={{
            backgroundColor: '#fde8e8',
            border: '1px solid #f44336',
            padding: '15px',
            borderRadius: '4px',
            marginTop: '10px',
            color: '#c62828'
          }}>
            <strong>오류:</strong> {diagnostics.error}
          </div>
        )}

        {diagnostics.tables.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <strong>기존 테이블:</strong>
            <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
              {diagnostics.tables.map(table => (
                <li key={table}>{table}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 테이블 생성 권한 확인 */}
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3>📋 3. 테이블 생성 권한</h3>
        <div style={{ 
          color: getStatusColor(diagnostics.canCreateTable),
          fontWeight: 'bold',
          fontSize: '18px',
          margin: '10px 0'
        }}>
          {getStatusText(diagnostics.canCreateTable)}
        </div>
      </div>

      {/* 해결 방법 */}
      <div style={{
        backgroundColor: '#e3f2fd',
        border: '1px solid #2196f3',
        padding: '20px',
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h3 style={{ color: '#1976d2', margin: '0 0 15px 0' }}>💡 문제 해결 방법</h3>
        
        {!diagnostics.envVars.url || !diagnostics.envVars.key ? (
          <div>
            <h4 style={{ color: '#1976d2' }}>환경 변수 문제:</h4>
            <ol style={{ color: '#1976d2' }}>
              <li>프로젝트 루트에 <code>.env</code> 파일이 있는지 확인</li>
              <li>파일 내용이 <code>env.example</code>과 동일한지 확인</li>
              <li>서버를 재시작했는지 확인 (<code>npm start</code>)</li>
            </ol>
          </div>
        ) : !diagnostics.connection ? (
          <div>
            <h4 style={{ color: '#1976d2' }}>연결 문제:</h4>
            <ol style={{ color: '#1976d2' }}>
              <li>Supabase 프로젝트가 활성화되어 있는지 확인</li>
              <li>URL과 API 키가 올바른지 확인</li>
              <li>인터넷 연결 상태 확인</li>
            </ol>
          </div>
        ) : !diagnostics.canCreateTable ? (
          <div>
            <h4 style={{ color: '#1976d2' }}>권한 문제:</h4>
            <ol style={{ color: '#1976d2' }}>
              <li>Supabase Dashboard에서 관리자 권한 확인</li>
              <li>RLS(Row Level Security) 설정 확인</li>
              <li>API 키 권한 확인</li>
            </ol>
          </div>
        ) : (
          <div>
            <h4 style={{ color: '#1976d2' }}>연결 성공!</h4>
            <p style={{ color: '#1976d2' }}>
              Supabase 연결이 정상입니다. 이제 SQL Editor에서 테이블을 생성할 수 있습니다.
            </p>
          </div>
        )}
      </div>

      {/* 관리자 도구 버튼 */}
      {diagnostics.connection && (
        <div style={{
          backgroundColor: '#e8f5e8',
          border: '1px solid #4CAF50',
          padding: '20px',
          borderRadius: '8px',
          margin: '20px 0',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#2e7d32', margin: '0 0 15px 0' }}>
            🛠️ 관리자 도구
          </h3>
          <p style={{ color: '#2e7d32', margin: '0 0 15px 0' }}>
            Supabase 연결이 정상입니다. 데이터 마이그레이션을 진행할 수 있습니다.
          </p>
          <button
            onClick={async () => {
              try {
                // SentenceMigrationService를 직접 호출
                const { SentenceMigrationService } = await import('../services/sentenceMigrationService');
                const result = await SentenceMigrationService.migrateFromGoogleSheets();
                
                if (result.success) {
                  alert(`✅ 마이그레이션 완료!\n가져온 데이터: ${result.imported}개 문장 문제`);
                } else {
                  alert(`❌ 마이그레이션 실패:\n${result.errors.join('\n')}`);
                }
              } catch (error) {
                console.error('마이그레이션 오류:', error);
                alert(`❌ 마이그레이션 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`);
              }
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            📥 구글 시트에서 데이터 가져오기
          </button>
        </div>
      )}

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '30px' }}>
        <button
          onClick={runDiagnostics}
          style={{
            padding: '12px 24px',
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          🔄 다시 진단
        </button>
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

export default SupabaseDiagnostic;
