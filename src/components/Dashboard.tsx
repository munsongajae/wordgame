import React, { useEffect, useMemo, useState } from 'react';
import { getSupabase, getCurrentUserName, getOrCreateAnonUserId } from '../services/supabaseClient';
import { GoogleSheetsService } from '../services/googleSheetsService';
import { Word } from '../types/word';

type SessionRow = { id: string; mode: string; score: number; total: number; duration_sec: number; created_at: string };
type AttemptAgg = { word_id: string; wrongs: number };
type ProgressRow = { word_id: string; next_review_at: string | null };

interface DashboardProps {
  onBack: () => void;
}

export default function Dashboard({ onBack }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [wrongs7d, setWrongs7d] = useState<AttemptAgg[]>([]);
  const [dueToday, setDueToday] = useState<ProgressRow[]>([]);
  const [wordDict, setWordDict] = useState<Map<string, Word>>(new Map());
  const [showClearWeakWordsConfirm, setShowClearWeakWordsConfirm] = useState(false);

  const userId = getOrCreateAnonUserId();
  const userName = getCurrentUserName();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase 환경변수가 설정되어 있지 않습니다.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // 단어 사전 로드(구글 시트)
        try {
          const fetched = await GoogleSheetsService.fetchWords();
          const dict = new Map<string, Word>();
          fetched.forEach(w => dict.set(w.id, w));
          setWordDict(dict);
        } catch (e) {
          // 단어 사전은 실패해도 대시보드 나머지는 표시
        }
        const [sessRes, wrongRes, dueRes] = await Promise.all([
          supabase
            .from('sessions')
            .select('id, mode, score, total, duration_sec, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .rpc('exec_sql', { sql: `select word_id, count(*) as wrongs from attempts where user_id = '${userId}' and correct = false and created_at >= now() - interval '7 days' group by word_id order by wrongs desc limit 20;` })
            .select('*'),
          supabase
            .from('progresses')
            .select('word_id, next_review_at')
            .eq('user_id', userId)
            .lte('next_review_at', new Date().toISOString().slice(0,10))
            .order('next_review_at', { ascending: true })
        ]);

        if (sessRes.error) throw sessRes.error;
        if (wrongRes.error) {
          // fallback: aggregate in client (last 7d)
          const fallback = await supabase
            .from('attempts')
            .select('word_id, created_at, correct')
            .eq('user_id', userId)
            .gte('created_at', new Date(Date.now() - 7*86400000).toISOString());
          if (fallback.error) throw fallback.error;
          const counts = new Map<string, number>();
          (fallback.data ?? []).forEach((r: any) => {
            if (!r.correct) counts.set(r.word_id, (counts.get(r.word_id) ?? 0) + 1);
          });
          const agg = Array.from(counts.entries()).map(([word_id, wrongs]) => ({ word_id, wrongs } as AttemptAgg)).sort((a,b)=>b.wrongs-a.wrongs).slice(0,20);
          setWrongs7d(agg);
        } else {
          setWrongs7d((wrongRes.data as any) as AttemptAgg[]);
        }
        if (dueRes.error) throw dueRes.error;

        setSessions((sessRes.data ?? []) as SessionRow[]);
        setDueToday((dueRes.data ?? []) as ProgressRow[]);
      } catch (e: any) {
        console.error(e);
        setError(e.message ?? '대시보드 로드 실패');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const kpis = useMemo(() => {
    const totalSessions = sessions.length;
    const totalSolved = sessions.reduce((a, s) => a + s.total, 0);
    const totalScore = sessions.reduce((a, s) => a + s.score, 0);
    const acc = totalSolved > 0 ? Math.round((totalScore / totalSolved) * 100) : 0;
    const duration = sessions.reduce((a, s) => a + (s.duration_sec || 0), 0);
    return { totalSessions, acc, duration };
  }, [sessions]);

  if (loading) {
    return (
      <div className="no-words-message">
        <h3>📊 대시보드 불러오는 중...</h3>
        <p>잠시만 기다려주세요.</p>
        <button className="retry-button" onClick={onBack}>← 뒤로가기</button>
      </div>
    );
  }

  async function deleteSession(id: string) {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      // 본인 세션만 삭제
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw error;
      // 낙관적 업데이트
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (e: any) {
      console.error('deleteSession error', e);
      alert('세션 삭제에 실패했어요. 다시 시도해주세요.');
    }
  }

  async function clearWeakWords() {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      // 최근 7일 오답 기록 삭제
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('attempts')
        .delete()
        .eq('user_id', userId)
        .eq('correct', false)
        .gte('created_at', sevenDaysAgo);
      
      if (error) throw error;
      
      // 상태 업데이트
      setWrongs7d([]);
      setShowClearWeakWordsConfirm(false);
      alert('약한 단어 기록이 초기화되었습니다.');
    } catch (e: any) {
      console.error('clearWeakWords error', e);
      alert('약한 단어 초기화에 실패했어요. 다시 시도해주세요.');
    }
  }

  return (
    <div className="app-main" style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>👤 {userName} 대시보드</h2>
        <button className="back-button" onClick={onBack}>← 뒤로가기</button>
      </div>

      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KPI title="최근 세션 수" value={`${kpis.totalSessions}`} />
        <KPI title="정답률" value={`${kpis.acc}%`} />
        <KPI title="복습 대상" value={`${dueToday.length}개`} />
        <KPI title="총 시간" value={`${Math.round(kpis.duration/60)}분`} />
      </div>

      <section style={{ marginBottom: 20 }}>
        <h3>🧩 최근 세션</h3>
        <div 
          className="session-list-container"
          style={{ 
            maxHeight: '400px', 
            overflowY: 'auto', 
            border: '1px solid #e0e0e0', 
            borderRadius: '12px',
            backgroundColor: '#fafafa',
            scrollbarWidth: 'thin',
            scrollbarColor: '#c0c0c0 #f0f0f0'
          }}
        >
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            padding: '12px'
          }}>
            {sessions.map(s => (
              <div key={s.id} style={{ 
                background: '#fff', 
                borderRadius: '8px', 
                padding: '12px', 
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)', 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s ease'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 700, color: '#333' }}>{labelMode(s.mode)}</div>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#666',
                      backgroundColor: '#f0f0f0',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {s.score}/{s.total}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#888' }}>
                    <span>⏱️ {s.duration_sec || 0}초</span>
                    <span>📅 {new Date(s.created_at).toLocaleDateString()}</span>
                    <span>🕐 {new Date(s.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteSession(s.id)}
                  style={{
                    background: '#ff5252', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '6px',
                    padding: '6px 12px', 
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d32f2f'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff5252'}
                  title="세션 삭제"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
        {sessions.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#666',
            backgroundColor: '#fafafa',
            borderRadius: '12px',
            border: '1px solid #e0e0e0'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <p>아직 세션이 없습니다.</p>
            <p style={{ fontSize: '14px' }}>퀴즈를 풀어보세요!</p>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h3 style={{ margin: 0 }}>⚠️ 약한 단어(최근 7일 오답 상위)</h3>
          {wrongs7d.length > 0 && (
            <button
              onClick={() => setShowClearWeakWordsConfirm(true)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#ff5252',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                transition: 'background-color 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d32f2f'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff5252'}
              title="약한 단어 기록 초기화"
            >
              🗑️ 초기화
            </button>
          )}
        </div>
        {wrongs7d.length === 0 ? (
          <div style={{ 
            color: '#666', 
            textAlign: 'center',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
            <p>최근 7일 오답이 없습니다.</p>
            <p style={{ fontSize: '14px' }}>훌륭해요! 계속 열심히 공부하세요!</p>
          </div>
        ) : (
          <div style={{ 
            border: '1px solid #e9ecef', 
            borderRadius: '8px',
            backgroundColor: '#fafafa'
          }}>
            <ul style={{ 
              margin: 0, 
              padding: '12px',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              {wrongs7d.map((r, index) => {
                const w = wordDict.get(r.word_id);
                const label = w ? `${w.english}${w.korean ? ' ('+w.korean+')' : ''}` : r.word_id;
                return (
                  <li key={r.word_id} style={{ 
                    lineHeight: '1.8',
                    padding: '4px 0',
                    borderBottom: index < wrongs7d.length - 1 ? '1px solid #eee' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>{label}</span>
                    <span style={{ 
                      color: '#ff5252', 
                      fontWeight: 'bold',
                      backgroundColor: '#fff5f5',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}>
                      오답 {r.wrongs}회
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <h3>🔁 오늘 복습 대상</h3>
        {dueToday.length === 0 ? (
          <div style={{ color: '#666' }}>오늘 복습할 단어가 없습니다.</div>
        ) : (
          <ul>
            {dueToday.map(r => {
              const w = wordDict.get(r.word_id);
              const label = w ? `${w.english}${w.korean ? ' ('+w.korean+')' : ''}` : r.word_id;
              return (
                <li key={r.word_id} style={{ lineHeight: '1.8' }}>{label} — {r.next_review_at ?? ''}</li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 약한 단어 초기화 확인 다이얼로그 */}
      {showClearWeakWordsConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginTop: 0, color: '#333' }}>
              ⚠️ 약한 단어 기록 초기화
            </h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              최근 7일간의 오답 기록을 모두 삭제하시겠습니까?<br/>
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowClearWeakWordsConfirm(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                취소
              </button>
              <button
                onClick={clearWeakWords}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ color: '#666', fontSize: 14 }}>{title}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#2196F3' }}>{value}</div>
    </div>
  );
}

function labelMode(mode: string) {
  switch (mode) {
    case 'imageQuiz': return '그림 보고 맞추기';
    case 'spellingQuiz': return '철자 보고 맞추기';
    case 'meaningQuiz': return '뜻 보고 맞추기';
    case 'pronunciation': return '발음 연습하기';
    default: return mode;
  }
}


