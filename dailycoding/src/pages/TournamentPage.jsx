import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import './TournamentPage.css';

const SIZE_OPTIONS = [8, 16, 32];

const STATUS_LABEL = { open: '모집 중', in_progress: '진행 중', complete: '완료', expired: '만료' };
const STATUS_COLOR = { open: 'var(--green)', in_progress: 'var(--blue)', complete: 'var(--text3)', expired: 'var(--text3)' };

export default function TournamentPage() {
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', size: 8 });
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/tournaments');
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
  }, []);

  const refreshSelected = useCallback(async (id) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/tournaments/${id}`);
      setSelected(data);
      setItems((prev) => prev.map((t) => t.id === id ? { ...t, status: data.status, participantCount: data.participants?.length ?? t.participantCount } : t));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected?.id || selected.status !== 'in_progress') {
      clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => refreshSelected(selected.id), 15000);
    return () => clearInterval(pollRef.current);
  }, [selected?.id, selected?.status, refreshSelected]);

  const openDetail = async (id) => {
    try {
      const { data } = await api.get(`/tournaments/${id}`);
      setSelected(data);
    } catch {
      toast?.show('토너먼트를 불러오지 못했습니다.', 'error');
    }
  };

  const create = async () => {
    if (!form.name.trim()) return;
    if (!user) { toast?.show('로그인이 필요합니다.', 'error'); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/tournaments', { name: form.name.trim(), size: Number(form.size) });
      setItems((prev) => [data, ...prev]);
      setSelected(data);
      setForm({ name: '', size: 8 });
      toast?.show('토너먼트를 만들었습니다! 참가자를 모아 브라켓을 시작하세요.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '토너먼트를 만들지 못했습니다.', 'error');
    }
    setBusy(false);
  };

  const join = async (id) => {
    if (!user) { toast?.show('로그인 후 참가할 수 있습니다.', 'error'); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/tournaments/${id}/join`);
      setSelected(data);
      await load();
      toast?.show('토너먼트에 참가했습니다! 브라켓이 시작되면 알림을 확인하세요.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '참가하지 못했습니다.', 'error');
    }
    setBusy(false);
  };

  const start = async (id) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/tournaments/${id}/start`);
      setSelected(data);
      await load();
      toast?.show('브라켓이 생성됐습니다! 참가자들이 각 매치에서 배틀을 만들 수 있습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '시작하지 못했습니다.', 'error');
    }
    setBusy(false);
  };

  const deleteTournament = async (id) => {
    if (!window.confirm('토너먼트를 삭제하시겠습니까?')) return;
    setBusy(true);
    try {
      await api.delete(`/tournaments/${id}`);
      setSelected(null);
      await load();
      toast?.show('토너먼트가 삭제됐습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '삭제하지 못했습니다.', 'error');
    }
    setBusy(false);
  };

  const createMatchBattle = async (match) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/tournaments/${selected.id}/matches/${match.id}/battle`);
      setSelected(data.tournament);
      toast?.show('배틀 방이 만들어졌습니다! 상대방이 입장하면 시작됩니다.', 'success');
      if (data.roomId) navigate(`/battle/watch/${data.roomId}`);
    } catch (err) {
      toast?.show(err.response?.data?.message || '매치 배틀을 만들지 못했습니다.', 'error');
    }
    setBusy(false);
  };

  const rounds = useMemo(() => {
    const map = new Map();
    for (const match of selected?.matches || []) {
      const list = map.get(match.round) || [];
      list.push(match);
      map.set(match.round, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([round, matches]) => ({ round, matches }));
  }, [selected]);

  const userById = useMemo(() => {
    const map = new Map();
    for (const entry of selected?.participants || []) map.set(entry.userId, entry.user?.username || `User ${entry.userId}`);
    return map;
  }, [selected]);

  const isJoined = selected?.participants?.some((e) => e.userId === user?.id);
  const isCreator = selected?.createdBy === user?.id;

  const myActiveMatches = useMemo(() => {
    if (!user || !selected?.matches) return [];
    return selected.matches.filter((m) =>
      !m.winnerId && !m.battleId && m.player1Id && m.player2Id &&
      (m.player1Id === user.id || m.player2Id === user.id)
    );
  }, [selected, user]);

  const myOngoingMatches = useMemo(() => {
    if (!user || !selected?.matches) return [];
    return selected.matches.filter((m) =>
      m.battleId && !m.winnerId &&
      (m.player1Id === user.id || m.player2Id === user.id)
    );
  }, [selected, user]);

  return (
    <div className="tournament-page page-enter">
      <div className="tournament-hero">
        <div>
          <h1>🏟 토너먼트</h1>
          <p>8/16/32강 싱글 엘리미네이션 방식으로 코딩 배틀 토너먼트를 운영합니다.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowGuide((p) => !p)}>
            {showGuide ? '📖 안내 닫기' : '📖 사용 방법'}
          </button>
          {user && (
            <div className="tournament-create card">
              <input
                placeholder="토너먼트 이름"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
              <select value={form.size} onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))}>
                {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}강</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={create} disabled={busy || !form.name.trim()}>생성</button>
            </div>
          )}
        </div>
      </div>

      {showGuide && (
        <div className="tournament-guide card">
          <h3 style={{ marginBottom: 12, fontSize: 14 }}>🗺 토너먼트 사용 방법</h3>
          <div className="tournament-guide-steps">
            <div className="tournament-guide-step">
              <span className="step-num">1</span>
              <div><strong>토너먼트 생성</strong><br /><span>이름과 인원(8/16/32강)을 정해 생성합니다. 생성하면 24시간 동안 모집됩니다.</span></div>
            </div>
            <div className="tournament-guide-step">
              <span className="step-num">2</span>
              <div><strong>참가 신청</strong><br /><span>목록에서 원하는 토너먼트를 클릭하고 <strong>참가</strong> 버튼을 누릅니다. 로그인이 필요합니다.</span></div>
            </div>
            <div className="tournament-guide-step">
              <span className="step-num">3</span>
              <div><strong>브라켓 시작</strong><br /><span>충분한 인원이 모이면 토너먼트 생성자가 <strong>브라켓 시작</strong> 버튼을 눌러 대진표를 확정합니다.</span></div>
            </div>
            <div className="tournament-guide-step">
              <span className="step-num">4</span>
              <div><strong>매치 배틀</strong><br /><span>대진표에서 내 매치를 찾아 <strong>매치 만들기</strong>를 누르면 배틀 방이 생성됩니다. 상대방도 입장하면 배틀 시작!</span></div>
            </div>
            <div className="tournament-guide-step">
              <span className="step-num">5</span>
              <div><strong>자동 승급</strong><br /><span>배틀이 끝나면 승자가 자동으로 다음 라운드로 올라갑니다. 최후의 1인이 우승!</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="tournament-layout">
        <div className="tournament-list card">
          <h2>목록</h2>
          {items.length === 0 && (
            <div className="tournament-empty">
              <div style={{ fontSize: 28, marginBottom: 8 }}>🏟</div>
              <div>토너먼트가 없습니다.</div>
              {user ? <div style={{ fontSize: 11, marginTop: 4 }}>위에서 새 토너먼트를 만들어보세요!</div>
                    : <div style={{ fontSize: 11, marginTop: 4 }}>로그인하면 토너먼트를 만들 수 있습니다.</div>}
            </div>
          )}
          {items.map((item) => {
            const expiresAt = item.expiresAt ? new Date(item.expiresAt) : null;
            const minsLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - Date.now()) / 60000)) : null;
            return (
              <button
                key={item.id}
                className={`tournament-list-item ${selected?.id === item.id ? 'active' : ''}`}
                onClick={() => openDetail(item.id)}
              >
                <strong>{item.name}</strong>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: STATUS_COLOR[item.status], fontWeight: 600, fontSize: 11 }}>
                    ● {STATUS_LABEL[item.status]}
                  </span>
                  · {item.participantCount || 0}/{item.size}명
                  {item.status === 'open' && minsLeft !== null && (
                    <> · ⏳ {minsLeft < 60 ? `${minsLeft}분` : `${Math.floor(minsLeft / 60)}시간`}</>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="tournament-detail card">
          {!selected ? (
            <div className="tournament-empty" style={{ padding: '48px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👈</div>
              <div style={{ fontWeight: 600 }}>토너먼트를 선택하세요</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                왼쪽 목록에서 참가하거나 관전할 토너먼트를 클릭하세요.
              </div>
            </div>
          ) : (
            <>
              <div className="tournament-detail-head">
                <div>
                  <h2 style={{ marginBottom: 4 }}>{selected.name}</h2>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: STATUS_COLOR[selected.status], fontWeight: 700 }}>
                      ● {STATUS_LABEL[selected.status]}
                    </span>
                    <span>· {selected.participants?.length || 0}/{selected.size}명 참가</span>
                  </p>
                </div>
                <div className="tournament-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => refreshSelected(selected.id)}
                    disabled={busy}
                    title="새로고침"
                  >🔄</button>
                  {selected.status === 'open' && !isJoined && (
                    <button className="btn btn-primary btn-sm" onClick={() => join(selected.id)} disabled={busy}>
                      참가하기
                    </button>
                  )}
                  {selected.status === 'open' && isJoined && !isCreator && (
                    <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>✓ 참가 중</span>
                  )}
                  {(isAdmin || isCreator) && selected.status === 'open' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => start(selected.id)}
                      disabled={busy || (selected.participants?.length || 0) < 2}
                      title={(selected.participants?.length || 0) < 2 ? '최소 2명 이상 참가해야 합니다' : ''}
                    >
                      브라켓 시작
                    </button>
                  )}
                  {(isAdmin || isCreator) && selected.status === 'open' && (
                    <button className="btn btn-danger btn-sm" onClick={() => deleteTournament(selected.id)} disabled={busy}>삭제</button>
                  )}
                </div>
              </div>

              {selected.status === 'open' && (
                <div className="tournament-status-banner" style={{ background: 'rgba(74,194,107,.08)', border: '1px solid rgba(74,194,107,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                  {isCreator
                    ? `참가자가 충분히 모이면 브라켓 시작 버튼을 눌러 대진표를 만드세요. (현재 ${selected.participants?.length || 0}/${selected.size}명)`
                    : isJoined
                      ? '✓ 참가 완료! 브라켓이 시작될 때까지 기다려주세요.'
                      : '참가하기 버튼을 눌러 토너먼트에 참가할 수 있습니다. 로그인이 필요합니다.'}
                </div>
              )}

              {myActiveMatches.length > 0 && (
                <div className="tournament-my-action" style={{ background: 'rgba(93,168,255,.08)', border: '1px solid rgba(93,168,255,.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--blue)' }}>
                    ⚔️ 내 매치 — 지금 배틀을 만들 수 있습니다!
                  </div>
                  {myActiveMatches.map((match) => {
                    const opponent = match.player1Id === user?.id ? match.player2Id : match.player1Id;
                    return (
                      <div key={match.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13 }}>
                          Round {match.round} · vs <strong>{userById.get(opponent) || `User ${opponent}`}</strong>
                        </span>
                        <button className="btn btn-primary btn-sm" onClick={() => createMatchBattle(match)} disabled={busy}>
                          매치 만들기
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {myOngoingMatches.length > 0 && (
                <div style={{ background: 'rgba(227,179,65,.07)', border: '1px solid rgba(227,179,65,.25)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--yellow)' }}>
                    🟡 진행 중인 내 배틀
                  </div>
                  {myOngoingMatches.map((match) => (
                    <div key={match.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>Round {match.round}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/battle/watch/${match.battleId}`)}>
                        배틀 입장
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="tournament-participants">
                {(selected.participants || []).map((entry) => (
                  <span key={entry.userId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {entry.userId === user?.id && <span style={{ color: 'var(--blue)' }}>★</span>}
                    #{entry.seed} {entry.user?.username || entry.userId}
                  </span>
                ))}
              </div>

              <div className="tournament-bracket">
                {rounds.length === 0 && (
                  <div className="tournament-empty" style={{ width: '100%' }}>
                    {selected.status === 'open'
                      ? (isCreator || isAdmin)
                        ? '참가자가 2명 이상 모이면 브라켓 시작 버튼으로 대진표를 생성할 수 있습니다.'
                        : '생성자가 브라켓을 시작하면 여기에 대진표가 표시됩니다.'
                      : '대진표 정보가 없습니다.'}
                  </div>
                )}
                {rounds.map(({ round, matches }) => (
                  <div key={round} className="tournament-round">
                    <h3>
                      {round === Math.max(...rounds.map((r) => r.round)) && selected.status === 'complete'
                        ? '🏆 결승'
                        : `Round ${round}`}
                    </h3>
                    {matches.map((match) => {
                      const isMyMatch = user && (match.player1Id === user.id || match.player2Id === user.id);
                      const canCreate = !match.winnerId && !match.battleId && match.player1Id && match.player2Id && isMyMatch;
                      return (
                        <div
                          key={match.id}
                          className="tournament-match"
                          style={{ outline: isMyMatch && !match.winnerId ? '2px solid rgba(93,168,255,.35)' : 'none' }}
                        >
                          <div className={match.winnerId === match.player1Id ? 'winner' : ''}>
                            {match.player1Id ? userById.get(match.player1Id) || `User ${match.player1Id}` : <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>BYE</span>}
                          </div>
                          <div className={match.winnerId === match.player2Id ? 'winner' : ''}>
                            {match.player2Id ? userById.get(match.player2Id) || `User ${match.player2Id}` : <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>BYE</span>}
                          </div>
                          {match.battleId && !match.winnerId && (
                            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/battle/watch/${match.battleId}`)}>
                              배틀 입장 / 관전
                            </button>
                          )}
                          {match.winnerId && (
                            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>
                              ✓ {userById.get(match.winnerId) || `User ${match.winnerId}`} 승
                            </span>
                          )}
                          {canCreate && (
                            <button className="btn btn-primary btn-sm" onClick={() => createMatchBattle(match)} disabled={busy}>
                              매치 만들기
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {selected.status === 'complete' && (
                <div style={{ textAlign: 'center', padding: '20px 0', borderTop: '1px solid var(--border)', marginTop: 14 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    우승: {(() => {
                      const finalRound = Math.max(...(selected.matches || []).map((m) => m.round), 0);
                      const finalMatch = (selected.matches || []).find((m) => m.round === finalRound);
                      return finalMatch?.winnerId ? (userById.get(finalMatch.winnerId) || `User ${finalMatch.winnerId}`) : '—';
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
