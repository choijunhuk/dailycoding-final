import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import './TournamentPage.css';

const SIZE_OPTIONS = [8, 16, 32];

const TIER_OPTIONS = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'];
const TIER_LABEL = {
  iron: 'Iron', bronze: 'Bronze', silver: 'Silver', gold: 'Gold',
  platinum: 'Platinum', emerald: 'Emerald', diamond: 'Diamond',
  master: 'Master', grandmaster: 'Grandmaster', challenger: 'Challenger',
};
const TAG_GROUPS = [
  { label: '기초', tags: ['입출력', '구현', '수학', '문자열', '정렬'] },
  { label: '자료구조', tags: ['자료 구조', '해시', '스택', '큐', '우선순위 큐'] },
  { label: '알고리즘', tags: ['그리디', '이분 탐색', '투 포인터', '누적 합', '다이나믹 프로그래밍'] },
  { label: '그래프', tags: ['그래프 이론', 'BFS', 'DFS', '최단 경로', '트리'] },
  { label: '심화', tags: ['비트마스크', '백트래킹', 'SCC', 'LCA', 'FFT'] },
];

const STATUS_LABEL = { open: '모집 중', in_progress: '진행 중', complete: '완료', expired: '만료' };
const STATUS_COLOR = { open: 'var(--green)', in_progress: 'var(--blue)', complete: 'var(--text3)', expired: 'var(--text3)' };

export default function TournamentPage() {
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', size: 8, isPrivate: false, joinPassword: '', minTier: '', maxTier: '', bannedTags: [], showAdvanced: false });
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [joinPasswordInput, setJoinPasswordInput] = useState('');
  const [showJoinPassword, setShowJoinPassword] = useState(false);
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
    setShowJoinPassword(false);
    setJoinPasswordInput('');
    try {
      const { data } = await api.get(`/tournaments/${id}`);
      setSelected(data);
    } catch {
      toast?.show('Failed to load tournament.', 'error');
    }
  };

  const create = async () => {
    if (!form.name.trim()) return;
    if (!user) { toast?.show('Login required.', 'error'); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/tournaments', {
        name: form.name.trim(),
        size: Number(form.size),
        isPrivate: form.isPrivate,
        joinPassword: form.isPrivate ? form.joinPassword : null,
        minTier: form.minTier || null,
        maxTier: form.maxTier || null,
        bannedTags: form.bannedTags,
      });
      setItems((prev) => [data, ...prev]);
      setSelected(data);
      setForm({ name: '', size: 8, isPrivate: false, joinPassword: '', minTier: '', maxTier: '', bannedTags: [], showAdvanced: false });
      toast?.show('Tournament created! Gather participants and start the bracket.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to create tournament.', 'error');
    }
    setBusy(false);
  };

  const join = async (id, password = null) => {
    if (!user) { toast?.show('Login to join.', 'error'); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/tournaments/${id}/join`, { password });
      setSelected(data);
      setShowJoinPassword(false);
      setJoinPasswordInput('');
      await load();
      toast?.show('Joined! Watch for notifications when the bracket starts.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to join.', 'error');
    }
    setBusy(false);
  };

  const handleJoinClick = () => {
    if (selected.isPrivate) {
      if (showJoinPassword) {
        join(selected.id, joinPasswordInput);
      } else {
        setShowJoinPassword(true);
      }
    } else {
      join(selected.id, null);
    }
  };

  const start = async (id) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/tournaments/${id}/start`);
      setSelected(data);
      await load();
      toast?.show('Bracket created! Participants can now create battles for each match.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to start.', 'error');
    }
    setBusy(false);
  };

  const deleteTournament = async (id) => {
    if (!window.confirm('Delete this tournament?')) return;
    setBusy(true);
    try {
      await api.delete(`/tournaments/${id}`);
      setSelected(null);
      await load();
      toast?.show('Tournament deleted.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to delete.', 'error');
    }
    setBusy(false);
  };

  const createMatchBattle = async (match) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/tournaments/${selected.id}/matches/${match.id}/battle`);
      setSelected(data.tournament);
      toast?.show('Battle room created! Starts when the opponent joins.', 'success');
      if (data.roomId) navigate(`/battle/watch/${data.roomId}`);
    } catch (err) {
      toast?.show(err.response?.data?.message || 'Failed to create match battle.', 'error');
    }
    setBusy(false);
  };

  const toggleBannedTag = (tag) => {
    setForm((p) => ({
      ...p,
      bannedTags: p.bannedTags.includes(tag) ? p.bannedTags.filter((t) => t !== tag) : [...p.bannedTags, tag],
    }));
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

  const tierConditionLabel = (t) => {
    const parts = [];
    if (t.minTier) parts.push(`${TIER_LABEL[t.minTier] || t.minTier} or above`);
    if (t.maxTier) parts.push(`${TIER_LABEL[t.maxTier] || t.maxTier} or below`);
    return parts.length ? parts.join(', ') : null;
  };

  return (
    <div className="tournament-page page-enter">
      <div className="tournament-hero">
        <div>
          <h1>🏟 토너먼트</h1>
          <p>8/16/32인 단판 코딩 배틀 토너먼트를 진행합니다.</p>
        </div>
        <div className="tournament-side">
          <div className="tournament-toolbar">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowGuide((p) => !p)}>
              {showGuide ? '📖 가이드 닫기' : '📖 사용 방법'}
            </button>
          </div>
          {user && (
            <div className="tournament-create card">
              <div className="tournament-create-row">
                <input
                  placeholder="토너먼트 이름"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && !form.showAdvanced && create()}
                />
                <select value={form.size} onChange={(e) => setForm((p) => ({ ...p, size: e.target.value }))}>
                  {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm" onClick={() => setForm((p) => ({ ...p, showAdvanced: !p.showAdvanced }))} title="Advanced settings">
                  ⚙️ {form.showAdvanced ? '▲' : '▼'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={create} disabled={busy || !form.name.trim()}>만들기</button>
              </div>

              {form.showAdvanced && (
                <div className="tournament-advanced">
                  <label className="tournament-private-row">
                    <input type="checkbox" checked={form.isPrivate} onChange={(e) => setForm((p) => ({ ...p, isPrivate: e.target.checked }))} />
                    🔒 비공개
                    {form.isPrivate && (
                      <input
                        type="password"
                        placeholder="참가 비밀번호"
                        value={form.joinPassword}
                        onChange={(e) => setForm((p) => ({ ...p, joinPassword: e.target.value }))}
                      />
                    )}
                  </label>

                  <div className="tournament-tier-row">
                    <span>티어 제한:</span>
                    <select value={form.minTier} onChange={(e) => setForm((p) => ({ ...p, minTier: e.target.value }))} style={{ fontSize: 12 }}>
                      <option value="">최소 없음</option>
                      {TIER_OPTIONS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]} 이상</option>)}
                    </select>
                    <span>~</span>
                    <select value={form.maxTier} onChange={(e) => setForm((p) => ({ ...p, maxTier: e.target.value }))} style={{ fontSize: 12 }}>
                      <option value="">최대 없음</option>
                      {TIER_OPTIONS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]} 이하</option>)}
                    </select>
                  </div>

                  <div className="tournament-ban-section">
                    <div>🚫 Ban tags (excluded from battle problems):</div>
                    {TAG_GROUPS.map(({ label, tags }) => (
                      <div key={label} className="tournament-tag-row">
                        <span>{label}</span>
                        {tags.map((tag) => (
                          <label key={tag}>
                            <input
                              type="checkbox"
                              checked={form.bannedTags.includes(tag)}
                              onChange={() => toggleBannedTag(tag)}
                            />
                            {tag}
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
              <div><strong>토너먼트 만들기</strong><br /><span>이름과 인원(8/16/32명)을 선택하세요. 고급 설정에서 비밀번호, 티어 제한, 금지 태그를 설정할 수 있습니다.</span></div>
            </div>
            <div className="tournament-guide-step">
              <span className="step-num">2</span>
              <div><strong>참가</strong><br /><span>목록에서 토너먼트를 클릭하고 <strong>참가</strong>를 누르세요. 비공개 토너먼트는 비밀번호가 필요합니다.</span></div>
            </div>
            <div className="tournament-guide-step">
              <span className="step-num">3</span>
              <div><strong>대진표 시작</strong><br /><span>충분한 플레이어가 참가하면 방장이 <strong>대진표 시작</strong>을 눌러 대진을 확정합니다. 참가자에게 알림이 전송됩니다.</span></div>
            </div>
            <div className="tournament-guide-step">
              <span className="step-num">4</span>
              <div><strong>매치 배틀</strong><br /><span>대진표에서 내 매치를 찾아 <strong>매치 생성</strong>을 클릭해 배틀 방을 여세요. 태그/티어 필터가 문제 선택에 적용됩니다.</span></div>
            </div>
            <div className="tournament-guide-step">
              <span className="step-num">5</span>
              <div><strong>자동 진출</strong><br /><span>승자는 자동으로 다음 라운드로 진출합니다. 다음 매치가 배정되면 알림이 전송됩니다.</span></div>
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
                    : <div style={{ fontSize: 11, marginTop: 4 }}>토너먼트를 만들려면 로그인하세요.</div>}
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
                <strong>
                  {item.isPrivate && <span style={{ marginRight: 4 }}>🔒</span>}
                  {item.name}
                </strong>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: STATUS_COLOR[item.status], fontWeight: 600, fontSize: 11 }}>
                    ● {STATUS_LABEL[item.status]}
                  </span>
                  · {item.participantCount || 0}/{item.size}
                  {item.status === 'open' && minsLeft !== null && (
                    <> · ⏳ {minsLeft < 60 ? `${minsLeft}m` : `${Math.floor(minsLeft / 60)}h`}</>
                  )}
                  {(item.minTier || item.maxTier) && (
                    <span style={{ fontSize: 10, color: 'var(--blue)' }}>🛡 Tier limit</span>
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
                목록에서 토너먼트를 클릭해 참가하거나 관전하세요.
              </div>
            </div>
          ) : (
            <>
              <div className="tournament-detail-head">
                <div>
                  <h2 style={{ marginBottom: 4 }}>
                    {selected.isPrivate && <span style={{ marginRight: 6, fontSize: 16 }}>🔒</span>}
                    {selected.name}
                  </h2>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: STATUS_COLOR[selected.status], fontWeight: 700 }}>
                      ● {STATUS_LABEL[selected.status]}
                    </span>
                    <span>· {selected.participants?.length || 0}/{selected.size} participants</span>
                    {tierConditionLabel(selected) && (
                      <span style={{ fontSize: 11, background: 'rgba(93,168,255,.15)', color: 'var(--blue)', borderRadius: 4, padding: '2px 6px' }}>
                        🛡 {tierConditionLabel(selected)}
                      </span>
                    )}
                    {selected.bannedTags?.length > 0 && (
                      <span style={{ fontSize: 11, background: 'rgba(255,100,100,.1)', color: 'var(--red)', borderRadius: 4, padding: '2px 6px' }}>
                        🚫 {selected.bannedTags.join(', ')}
                      </span>
                    )}
                  </p>
                </div>
                <div className="tournament-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => refreshSelected(selected.id)}
                    disabled={busy}
                    title="Refresh"
                  >🔄</button>
                  {selected.status === 'open' && !isJoined && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {showJoinPassword && selected.isPrivate && (
                        <input
                          type="password"
                          placeholder="비밀번호"
                          value={joinPasswordInput}
                          onChange={(e) => setJoinPasswordInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && join(selected.id, joinPasswordInput)}
                          style={{ width: 120, fontSize: 13 }}
                          autoFocus
                        />
                      )}
                      <button className="btn btn-primary btn-sm" onClick={handleJoinClick} disabled={busy}>
                        {selected.isPrivate && !showJoinPassword ? '🔒 참가' : '참가'}
                      </button>
                      {showJoinPassword && (
                        <button className="btn btn-ghost btn-sm" onClick={() => { setShowJoinPassword(false); setJoinPasswordInput(''); }}>취소</button>
                      )}
                    </div>
                  )}
                  {selected.status === 'open' && isJoined && !isCreator && (
                    <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>✓ 참가 완료</span>
                  )}
                  {(isAdmin || isCreator) && selected.status === 'open' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => start(selected.id)}
                      disabled={busy || (selected.participants?.length || 0) < 2}
                      title={(selected.participants?.length || 0) < 2 ? '최소 2명 이상 필요합니다' : ''}
                    >
                      대진표 시작
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
                    ? `충분한 플레이어가 모였나요? 대진표 시작을 눌러 매치업을 확정하세요. (현재 ${selected.participants?.length || 0}/${selected.size}명)`
                    : isJoined
                      ? '✓ 참가 완료! 대진표 시작을 기다리는 중입니다.'
                      : selected.isPrivate
                        ? '🔒 비공개 토너먼트입니다. 참가를 누르고 비밀번호를 입력하세요.'
                        : '참가를 눌러 참여하세요. 로그인이 필요합니다.'}
                </div>
              )}

              {myActiveMatches.length > 0 && (
                <div className="tournament-my-action" style={{ background: 'rgba(93,168,255,.08)', border: '1px solid rgba(93,168,255,.3)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--blue)' }}>
                    ⚔️ My Match — Create a battle now!
                  </div>
                  {myActiveMatches.map((match) => {
                    const opponent = match.player1Id === user?.id ? match.player2Id : match.player1Id;
                    return (
                      <div key={match.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13 }}>
                          Round {match.round} · vs <strong>{userById.get(opponent) || `User ${opponent}`}</strong>
                        </span>
                        <button className="btn btn-primary btn-sm" onClick={() => createMatchBattle(match)} disabled={busy}>
                          Create Match
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {myOngoingMatches.length > 0 && (
                <div style={{ background: 'rgba(227,179,65,.07)', border: '1px solid rgba(227,179,65,.25)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--yellow)' }}>
                    🟡 My Active Battle
                  </div>
                  {myOngoingMatches.map((match) => (
                    <div key={match.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>Round {match.round}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/battle/watch/${match.battleId}`)}>
                        Enter Battle
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
                        ? '2명 이상 참가하면 대진표 시작 버튼으로 매치업을 생성하세요.'
                        : '주최자가 대진표를 시작하면 여기에 표시됩니다.'
                      : '대진표 데이터가 없습니다.'}
                  </div>
                )}
                {rounds.map(({ round, matches }) => (
                  <div key={round} className="tournament-round">
                    <h3>
                      {round === Math.max(...rounds.map((r) => r.round)) && selected.status === 'complete'
                        ? '🏆 결승'
                        : `${round}라운드`}
                    </h3>
                    {matches.map((match) => {
                      const isMyMatch = user && (match.player1Id === user.id || match.player2Id === user.id);
                      const canCreate = !match.winnerId && !match.battleId && match.player1Id && match.player2Id && isMyMatch;
                      const isBye = match.winnerId && (!match.player1Id || !match.player2Id);
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
                          {isBye && (
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Bye</span>
                          )}
                          {match.battleId && !match.winnerId && (
                            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/battle/watch/${match.battleId}`)}>
                              입장 / 관전
                            </button>
                          )}
                          {match.winnerId && !isBye && (
                            <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>
                              ✓ {userById.get(match.winnerId) || `User ${match.winnerId}`} 승리
                            </span>
                          )}
                          {canCreate && (
                            <button className="btn btn-primary btn-sm" onClick={() => createMatchBattle(match)} disabled={busy}>
                              매치 시작
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
                    우승자: {(() => {
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
