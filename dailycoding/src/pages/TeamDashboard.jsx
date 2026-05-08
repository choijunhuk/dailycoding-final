import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Link as LinkIcon, LogOut, Pencil, RefreshCw, ShieldCheck, ShieldOff, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useLang } from '../context/LangContext.jsx';
import ProfileAvatar from '../components/ProfileAvatar';

function fmtDate(value) {
  if (!value) return '-';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '-';
  return time.toLocaleDateString();
}

function StatCard({ label, value, caption }) {
  return (
    <div style={{ padding:18, borderRadius:12, background:'var(--bg2)', border:'1px solid var(--border)' }}>
      <div style={{ fontSize:11, color:'var(--text3)', fontWeight:900, textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:900, color:'var(--text)' }}>{value}</div>
      {caption && <div style={{ fontSize:12, color:'var(--text2)', marginTop:4 }}>{caption}</div>}
    </div>
  );
}

export default function TeamDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const nameInputRef = useRef(null);

  const members = team?.members || [];
  const myMembership = members.find((member) => member.id === user?.id);
  const isTeamAdmin = myMembership?.role === 'admin';
  const isOwner = team && Number(team.ownerId || team.owner_id) === Number(user?.id);
  const adminCount = useMemo(() => members.filter((member) => member.role === 'admin').length, [members]);

  const loadTeam = async (nextTeamId = selectedTeamId) => {
    setLoading(true);
    try {
      const { data: mine } = await api.get('/teams/mine');
      const nextTeams = mine.teams || [];
      setTeams(nextTeams);
      const resolvedTeamId = nextTeams.some((item) => Number(item.id) === Number(nextTeamId))
        ? nextTeamId
        : nextTeams[0]?.id || null;

      if (!resolvedTeamId) {
        setSelectedTeamId(null);
        setTeam(null);
        return;
      }

      const { data } = await api.get('/teams/my', { params: { teamId: resolvedTeamId } });
      setSelectedTeamId(resolvedTeamId);
      setTeam(data || null);
      setInviteLink('');
      setInviteExpiresAt(null);
      setInviteCopied(false);
    } catch (err) {
      toast.show(err.response?.data?.message || '소속 정보를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, []);

  const handleCreateTeam = async () => {
    if (!teamName.trim() || busy) return;
    setBusy(true);
    try {
      const { data } = await api.post('/teams/create', { name: teamName });
      setTeamName('');
      await loadTeam(data.id);
      toast.show(data.message || t('teamCreated'), 'success');
    } catch (err) {
      toast.show(err.response?.data?.message || t('teamCreateFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const generateInviteLink = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post('/teams/invite', { teamId: team.id });
      const link = `${window.location.origin}/join/team/${data.token}`;
      setInviteLink(link);
      setInviteExpiresAt(data.expiresAt || null);
      setInviteCopied(false);
      await navigator.clipboard.writeText(link);
      setInviteCopied(true);
      toast.show(t('teamInviteCopied'), 'success');
    } catch (err) {
      toast.show(err.response?.data?.message || t('teamInviteFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopied(true);
      toast.show(t('copied'), 'success');
    } catch {
      toast.show(t('copyFailed'), 'error');
    }
  };

  const updateMemberRole = async (memberId, role) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/teams/members/${memberId}/role`, { role, teamId: team.id });
      setTeam(data.team);
      toast.show(data.message || '역할을 변경했습니다.', 'success');
    } catch (err) {
      toast.show(err.response?.data?.message || '역할 변경 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm(t('teamRemoveConfirm')) || busy) return;
    setBusy(true);
    try {
      const { data } = await api.delete(`/teams/members/${memberId}`, { data: { teamId: team.id } });
      setTeam(data.team);
      toast.show(data.message || t('teamMemberRemoved'), 'success');
    } catch (err) {
      toast.show(err.response?.data?.message || t('teamMemberRemoveFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('소속에서 탈퇴하시겠습니까?') || busy) return;
    setBusy(true);
    try {
      await api.delete('/teams/leave', { data: { teamId: team.id } });
      await loadTeam(null);
      toast.show('소속에서 탈퇴했습니다.', 'success');
    } catch (err) {
      toast.show(err.response?.data?.message || '탈퇴 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const { data } = await api.patch('/teams/name', { name: newName, teamId: team.id });
      setTeam(data.team);
      setTeams((prev) => prev.map((item) => Number(item.id) === Number(data.team.id) ? { ...item, name: data.team.name } : item));
      setEditingName(false);
      toast.show(data.message || '이름이 변경되었습니다.', 'success');
    } catch (err) {
      toast.show(err.response?.data?.message || '이름 변경 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDissolve = async () => {
    if (!window.confirm(`"${team.name}" 소속을 정말 해산하시겠습니까? 모든 멤버가 소속에서 제거됩니다.`) || busy) return;
    setBusy(true);
    try {
      await api.delete('/teams', { data: { teamId: team.id } });
      await loadTeam(null);
      toast.show('소속이 해산되었습니다.', 'success');
    } catch (err) {
      toast.show(err.response?.data?.message || '해산 실패', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>{t('loading')}</div>;

  if (!team) {
    return (
      <div style={{ padding:'64px 28px', maxWidth:760, margin:'0 auto' }}>
        <div style={{ padding:28, borderRadius:16, background:'var(--bg2)', border:'1px solid var(--border)', display:'grid', gap:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:'rgba(121,192,255,.12)', color:'var(--blue)', display:'grid', placeItems:'center' }}>
              <Users size={24} />
            </div>
            <div>
              <h1 style={{ margin:0, fontSize:26, fontWeight:900 }}>무료 소속 만들기</h1>
              <p style={{ margin:'4px 0 0', color:'var(--text2)', fontSize:13 }}>학교, 회사, 스터디 이름으로 소속을 만들고 멤버 풀이 활동을 함께 점검하세요.</p>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) auto', gap:10 }}>
            <input
              placeholder={t('teamNamePlaceholder')}
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              maxLength={100}
            />
            <button className="btn btn-primary" onClick={handleCreateTeam} disabled={busy || !teamName.trim()}>
              소속 만들기
            </button>
          </div>
          <div style={{ color:'var(--text3)', fontSize:12, lineHeight:1.7 }}>
            한 계정으로 여러 소속에 가입하거나 새 소속을 만들 수 있습니다. 생성자는 자동으로 관리자가 됩니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:'40px 28px', maxWidth:1180, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, marginBottom:24 }}>
        <div>
          <div style={{ color:'var(--blue)', fontSize:12, fontWeight:900, textTransform:'uppercase', marginBottom:6 }}>Affiliation</div>
          {editingName ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <input
                ref={nameInputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingName(false); }}
                maxLength={100}
                style={{ fontSize:22, fontWeight:900, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'4px 10px', color:'var(--text)', width:260 }}
                autoFocus
              />
              <button className="btn btn-primary btn-sm" onClick={handleRename} disabled={busy || !newName.trim()}><Check size={13} /></button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(false)}><X size={13} /></button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <h1 style={{ fontSize:28, fontWeight:900, margin:0 }}>{team.name}</h1>
              {isTeamAdmin && (
                <button className="btn btn-ghost btn-sm" style={{ padding:'4px 8px' }} onClick={() => { setNewName(team.name); setEditingName(true); }} title="이름 변경">
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )}
          <p style={{ color:'var(--text2)', margin:0 }}>{t('teamManageDesc')}</p>
          {teams.length > 1 && (
            <select
              value={selectedTeamId || team.id}
              onChange={(event) => loadTeam(Number(event.target.value))}
              style={{ marginTop:12, maxWidth:280 }}
            >
              {teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.role === 'admin' ? '관리자' : '멤버'}
                </option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={loadTeam} disabled={busy}>
            <RefreshCw size={14} /> 새로고침
          </button>
          {isTeamAdmin && (
            <button className="btn btn-primary btn-sm" onClick={generateInviteLink} disabled={busy}>
              <UserPlus size={14} /> {t('teamInviteBtn')}
            </button>
          )}
          {myMembership && !isOwner && (
            <button className="btn btn-ghost btn-sm" style={{ color:'var(--red)' }} onClick={handleLeave} disabled={busy}>
              <LogOut size={14} /> 탈퇴
            </button>
          )}
          {isOwner && (
            <button className="btn btn-ghost btn-sm" style={{ color:'var(--red)' }} onClick={handleDissolve} disabled={busy}>
              <Trash2 size={14} /> 소속 해산
            </button>
          )}
        </div>
      </div>

      <div style={{
        display:'grid',
        gridTemplateColumns:'minmax(0, 1fr) auto',
        gap:10,
        alignItems:'center',
        padding:14,
        border:'1px solid var(--border)',
        borderRadius:12,
        background:'var(--bg2)',
        marginBottom:22,
      }}>
        <input
          placeholder="새 소속 만들기"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          maxLength={100}
        />
        <button className="btn btn-ghost btn-sm" onClick={handleCreateTeam} disabled={busy || !teamName.trim()}>
          <Users size={14} /> 추가
        </button>
      </div>

      {isTeamAdmin && (
        <div style={{
          background:'linear-gradient(135deg, rgba(121,192,255,.10), rgba(63,185,80,.06))',
          border:'1px solid rgba(121,192,255,.22)',
          borderRadius:14,
          padding:18,
          display:'grid',
          gap:14,
          marginBottom:22,
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:'rgba(121,192,255,.14)', color:'var(--blue)', display:'grid', placeItems:'center' }}>
                <UserPlus size={18} />
              </div>
              <div>
                <div style={{ fontWeight:900 }}>멤버 초대하기</div>
                <div style={{ color:'var(--text2)', fontSize:12, marginTop:2 }}>초대 링크를 보내면 상대방이 로그인 후 바로 소속에 합류합니다.</div>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={generateInviteLink} disabled={busy}>
              <LinkIcon size={14} /> 새 초대 링크 만들기
            </button>
          </div>

          {inviteLink && (
            <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1fr) auto', gap:8, alignItems:'center' }}>
              <div style={{
                minWidth:0,
                border:'1px solid var(--border)',
                background:'var(--bg)',
                borderRadius:10,
                padding:'10px 12px',
                color:'var(--text2)',
                fontSize:12,
                overflow:'hidden',
                textOverflow:'ellipsis',
                whiteSpace:'nowrap',
                fontFamily:'Space Mono, monospace',
              }}>
                {inviteLink}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={copyInviteLink} disabled={busy}>
                <Copy size={13} /> {inviteCopied ? '복사됨' : '복사'}
              </button>
              <div style={{ gridColumn:'1 / -1', color:'var(--text3)', fontSize:11 }}>
                {inviteExpiresAt ? `${fmtDate(inviteExpiresAt)}까지 유효합니다.` : '초대 링크는 7일간 유효합니다.'}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12, marginBottom:22 }}>
        <StatCard label="멤버" value={team.stats?.memberCount ?? members.length} caption={`${team.stats?.activeMembers ?? 0}명 최근 활동`} />
        <StatCard label={t('teamWeeklySolved')} value={team.stats?.weeklySolved ?? 0} caption="최근 7일 정답 제출" />
        <StatCard label={t('teamAvgRating')} value={team.stats?.avgRating ?? 0} caption="소속 평균 레이팅" />
        <StatCard label="관리자" value={adminCount} caption={isTeamAdmin ? '관리 권한 있음' : '조회 권한'} />
      </div>

      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', gap:12 }}>
          <strong>{t('teamMemberList')}</strong>
          <span style={{ color:'var(--text3)', fontSize:12 }}>멤버별 풀이 활동 점검</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:820 }}>
            <thead style={{ background:'var(--bg3)', color:'var(--text3)', textAlign:'left' }}>
              <tr>
                <th style={{ padding:'12px 16px' }}>{t('teamUserCol')}</th>
                <th style={{ padding:'12px 16px' }}>{t('teamRoleCol')}</th>
                <th style={{ padding:'12px 16px' }}>제출</th>
                <th style={{ padding:'12px 16px' }}>정답</th>
                <th style={{ padding:'12px 16px' }}>7일 정답</th>
                <th style={{ padding:'12px 16px' }}>최근 제출</th>
                <th style={{ padding:'12px 16px' }}>{t('teamJoinedAtCol')}</th>
                <th style={{ padding:'12px 16px', textAlign:'right' }}>{t('teamActionCol')}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.id === user?.id;
                const isOnlyAdmin = member.role === 'admin' && adminCount <= 1;
                return (
                  <tr key={member.id} style={{ borderTop:'1px solid var(--border)' }}>
                    <td style={{ padding:'14px 16px' }}>
                      <div
                        style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
                        onClick={() => navigate(isSelf ? '/profile' : `/user/${member.id}`)}
                      >
                        <ProfileAvatar profile={member} size={34} />
                        <div>
                          <div style={{ fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
                            {member.username}
                            {isSelf && <span style={{ color:'var(--blue)', fontSize:11 }}>({t('teamYou')})</span>}
                          </div>
                          <div style={{ color:'var(--text3)', fontSize:11, fontWeight:500 }}>{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'14px 16px' }}>
                      <span style={{
                        display:'inline-flex', alignItems:'center', gap:5, padding:'4px 8px', borderRadius:999,
                        color: member.role === 'admin' ? 'var(--yellow)' : 'var(--text2)',
                        border:'1px solid var(--border)', background:'var(--bg)',
                      }}>
                        {member.role === 'admin' ? <ShieldCheck size={13} /> : <Users size={13} />}
                        {member.role}
                      </span>
                    </td>
                    <td style={{ padding:'14px 16px' }}>{member.activity?.submissions ?? 0}</td>
                    <td style={{ padding:'14px 16px', color:'var(--green)', fontWeight:800 }}>{member.activity?.correct ?? 0}</td>
                    <td style={{ padding:'14px 16px', color:'var(--blue)', fontWeight:800 }}>{member.activity?.weeklySolved ?? 0}</td>
                    <td style={{ padding:'14px 16px', color:'var(--text3)' }}>{fmtDate(member.activity?.lastSubmittedAt)}</td>
                    <td style={{ padding:'14px 16px', color:'var(--text3)' }}>{fmtDate(member.joinedAt || member.joined_at)}</td>
                    <td style={{ padding:'14px 16px', textAlign:'right' }}>
                      {isTeamAdmin && !isSelf && (
                        <div style={{ display:'flex', justifyContent:'flex-end', gap:6 }}>
                          {member.role === 'admin' ? (
                            <button className="btn btn-ghost btn-sm" onClick={() => updateMemberRole(member.id, 'member')} disabled={busy || isOnlyAdmin}>
                              <ShieldOff size={13} /> 해제
                            </button>
                          ) : (
                            <button className="btn btn-ghost btn-sm" onClick={() => updateMemberRole(member.id, 'admin')} disabled={busy}>
                              <ShieldCheck size={13} /> 관리자
                            </button>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveMember(member.id)} disabled={busy}>
                            <Trash2 size={13} /> {t('teamRemoveBtn')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
