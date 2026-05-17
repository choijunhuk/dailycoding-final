import { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import './TournamentPage.css';

const SIZE_OPTIONS = [8, 16, 32];

export default function TournamentPage() {
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', size: 8 });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/tournaments');
      setItems(Array.isArray(data) ? data : []);
      if (selected?.id) {
        const detail = await api.get(`/tournaments/${selected.id}`);
        setSelected(detail.data);
      }
    } catch {
      setItems([]);
    }
  };

  useEffect(() => { load(); }, []);

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
    setBusy(true);
    try {
      const { data } = await api.post('/tournaments', { name: form.name.trim(), size: Number(form.size) });
      setItems((prev) => [data, ...prev]);
      setSelected(data);
      setForm({ name: '', size: 8 });
      toast?.show('토너먼트를 만들었습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '토너먼트를 만들지 못했습니다.', 'error');
    }
    setBusy(false);
  };

  const join = async (id) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/tournaments/${id}/join`);
      setSelected(data);
      await load();
      toast?.show('토너먼트에 참가했습니다.', 'success');
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
      toast?.show('브라켓을 생성했습니다.', 'success');
    } catch (err) {
      toast?.show(err.response?.data?.message || '시작하지 못했습니다.', 'error');
    }
    setBusy(false);
  };

  const createMatchBattle = async (match) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/tournaments/${selected.id}/matches/${match.id}/battle`);
      setSelected(data.tournament);
      toast?.show('토너먼트 배틀 초대를 만들었습니다.', 'success');
      if (data.roomId) window.location.href = `/battle/watch/${data.roomId}`;
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

  const isJoined = selected?.participants?.some((entry) => entry.userId === user?.id);

  return (
    <div className="tournament-page page-enter">
      <div className="tournament-hero">
        <div>
          <h1>🏟 토너먼트</h1>
          <p>8/16/32강 싱글 엘리미네이션 브라켓으로 배틀 매치를 운영합니다.</p>
        </div>
        {isAdmin && (
          <div className="tournament-create card">
            <input placeholder="토너먼트 이름" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
            <select value={form.size} onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))}>
              {SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}강</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={create} disabled={busy || !form.name.trim()}>생성</button>
          </div>
        )}
      </div>

      <div className="tournament-layout">
        <div className="tournament-list card">
          <h2>목록</h2>
          {items.length === 0 && <div className="tournament-empty">아직 토너먼트가 없습니다.</div>}
          {items.map((item) => (
            <button key={item.id} className={`tournament-list-item ${selected?.id === item.id ? 'active' : ''}`} onClick={() => openDetail(item.id)}>
              <strong>{item.name}</strong>
              <span>{item.status} · {item.participantCount || 0}/{item.size}</span>
            </button>
          ))}
        </div>

        <div className="tournament-detail card">
          {!selected ? (
            <div className="tournament-empty">토너먼트를 선택하세요.</div>
          ) : (
            <>
              <div className="tournament-detail-head">
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.status} · {selected.participants?.length || 0}/{selected.size}명</p>
                </div>
                <div className="tournament-actions">
                  {selected.status === 'open' && !isJoined && <button className="btn btn-primary btn-sm" onClick={() => join(selected.id)} disabled={busy}>참가</button>}
                  {isAdmin && selected.status === 'open' && <button className="btn btn-danger btn-sm" onClick={() => start(selected.id)} disabled={busy}>브라켓 시작</button>}
                </div>
              </div>

              <div className="tournament-participants">
                {(selected.participants || []).map((entry) => (
                  <span key={entry.userId}>#{entry.seed} {entry.user?.username || entry.userId}</span>
                ))}
              </div>

              <div className="tournament-bracket">
                {rounds.length === 0 && <div className="tournament-empty">시작하면 브라켓이 생성됩니다.</div>}
                {rounds.map(({ round, matches }) => (
                  <div key={round} className="tournament-round">
                    <h3>Round {round}</h3>
                    {matches.map((match) => {
                      const canCreateBattle = !match.winnerId
                        && !match.battleId
                        && match.player1Id
                        && match.player2Id
                        && (match.player1Id === user?.id || match.player2Id === user?.id);
                      return (
                      <div key={match.id} className="tournament-match">
                        <div className={match.winnerId === match.player1Id ? 'winner' : ''}>{match.player1Id ? userById.get(match.player1Id) || `User ${match.player1Id}` : 'BYE'}</div>
                        <div className={match.winnerId === match.player2Id ? 'winner' : ''}>{match.player2Id ? userById.get(match.player2Id) || `User ${match.player2Id}` : 'BYE'}</div>
                        {match.battleId && <a href={`/battle/watch/${match.battleId}`}>매치 입장</a>}
                        {canCreateBattle && <button className="btn btn-primary btn-sm" onClick={() => createMatchBattle(match)} disabled={busy}>매치 만들기</button>}
                      </div>
                    );})}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
