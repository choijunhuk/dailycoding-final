import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSubscriptionStatus } from '../hooks/useSubscriptionStatus';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useLang } from '../context/LangContext.jsx';
import { PLAN_META } from '../data/pricingPlans.js';

export default function TeamDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier } = useSubscriptionStatus(user?.id);
  const toast = useToast();
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [teamName, setTeamName] = useState('');

  const isTeam = tier === 'team';

  useEffect(() => {
    if (isTeam) {
      api.get('/teams/my').then(res => {
        setTeam(res.data);
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isTeam]);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;
    try {
      const { data } = await api.post('/teams/create', { name: teamName });
      setTeam({ id: data.id, name: teamName, members: [{ ...user, role: 'admin', joined_at: new Date() }] });
      toast.show(t('teamCreated'), 'success');
    } catch (err) {
      toast.show(err.response?.data?.message || t('teamCreateFailed'), 'error');
    }
  };

  const generateInviteLink = async () => {
    try {
      const { data } = await api.post('/teams/invite');
      const link = `${window.location.origin}/join/team/${data.token}`;
      navigator.clipboard.writeText(link);
      toast.show(t('teamInviteCopied'), 'success');
    } catch (err) {
      toast.show(err.response?.data?.message || t('teamInviteFailed'), 'error');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm(t('teamRemoveConfirm'))) return;
    try {
      await api.delete(`/teams/members/${memberId}`);
      setTeam(prev => ({ ...prev, members: prev.members.filter(m => m.id !== memberId) }));
      toast.show(t('teamMemberRemoved'), 'success');
    } catch (err) {
      toast.show(err.response?.data?.message || t('teamMemberRemoveFailed'), 'error');
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>{t('loading')}</div>;

  if (!isTeam) {
    return (
      <div style={{ padding: '64px 28px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1.1fr) minmax(280px, .9fr)', gap:20, alignItems:'stretch' }}>
          <div style={{ padding:28, borderRadius:24, background:'linear-gradient(145deg, rgba(242,204,96,.14), rgba(13,17,23,.95))', border:'1px solid rgba(242,204,96,.2)' }}>
            <div style={{ fontSize:12, color:'#f2cc60', fontWeight:900, letterSpacing:'.08em', textTransform:'uppercase', marginBottom:10 }}>Team Plan</div>
            <h2 style={{ marginBottom: 12, fontSize: 32, lineHeight: 1.1 }}>{t('teamPlanOnlyTitle')}</h2>
            <p style={{ color: 'var(--text2)', marginBottom: 18, lineHeight: 1.7 }}>{t('teamPlanOnlyDesc')}</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {['팀 대시보드', '초대 링크', '커스텀 대회', '팀 운영 가시성'].map((item) => (
                <span key={item} style={{ padding:'6px 10px', borderRadius:999, background:'rgba(255,255,255,.06)', border:'1px solid rgba(242,204,96,.18)', fontSize:12, color:'var(--text2)' }}>{item}</span>
              ))}
            </div>
          </div>
          <div style={{ padding:24, borderRadius:24, background:'var(--bg2)', border:'1px solid var(--border)', display:'grid', gap:12, alignContent:'start' }}>
            <div style={{ fontSize:14, color:'var(--text3)', fontWeight:700 }}>현재 팀 플랜 가격</div>
            <div style={{ fontSize:34, fontWeight:900, color:'#f2cc60' }}>${PLAN_META.team.monthlyPrice}<span style={{ fontSize:14, color:'var(--text3)', marginLeft:6 }}>/월</span></div>
            <div style={{ fontSize:15, color:'var(--text2)' }}>${PLAN_META.team.annualPrice}/년으로 운영 단가를 더 낮출 수 있습니다.</div>
            <button
              onClick={() => navigate('/pricing')}
              style={{ padding: '12px 18px', background: '#f2cc60', color: '#0d1117', borderRadius: 12, fontWeight: 900, border: 'none', cursor: 'pointer' }}
            >
              {t('viewPricing')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!team) {
    return (
      <div style={{ padding: '80px 28px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 24 }}>👥</div>
        <h2 style={{ marginBottom: 12 }}>{t('teamCreateTitle')}</h2>
        <p style={{ color: 'var(--text3)', marginBottom: 32 }}>{t('teamCreateDesc')}</p>
        <input 
          placeholder={t('teamNamePlaceholder')}
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16, color: 'var(--text)' }}
        />
        <button 
          onClick={handleCreateTeam}
          style={{ width: '100%', padding: '14px', background: 'var(--blue)', color: '#0d1117', border: 'none', borderRadius: 10, fontWeight: 800, cursor: 'pointer' }}
        >{t('teamCreateBtn')}</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 28px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{team.name}</h1>
          <p style={{ color: 'var(--text2)' }}>{t('teamManageDesc')}</p>
        </div>
        <button 
          onClick={generateInviteLink}
          style={{ padding: '10px 20px', background: 'var(--bg3)', border: '1px solid var(--blue)40', color: 'var(--blue)', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
        >{t('teamInviteBtn')}</button>
      </div>

        <div style={{ background: 'var(--bg2)', padding: 24, borderRadius: 16, border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: 16 }}>{t('teamStatsBeta')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>{t('teamActiveMembers')}</span>
              <span style={{ fontWeight: 700 }}>1 / 10</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>{t('teamWeeklySolved')}</span>
              <span style={{ fontWeight: 700 }}>{t('teamWeeklySolvedCount').replace('{n}', '0')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text2)' }}>{t('teamAvgRating')}</span>
              <span style={{ fontWeight: 700 }}>{t('teamRatingPoints').replace('{n}', String(user.rating || 0))}</span>
            </div>
          </div>
        </div>

      <div style={{ marginTop: 40, background: 'var(--bg2)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{t('teamMemberList')}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: 'var(--bg3)', color: 'var(--text3)', textAlign: 'left' }}>
            <tr>
              <th style={{ padding: '12px 24px' }}>{t('teamUserCol')}</th>
              <th style={{ padding: '12px 24px' }}>{t('teamRoleCol')}</th>
              <th style={{ padding: '12px 24px' }}>{t('teamJoinedAtCol')}</th>
              <th style={{ padding: '12px 24px' }}>{t('teamStatusCol')}</th>
              <th style={{ padding: '12px 24px', textAlign: 'right' }}>{t('teamActionCol')}</th>
            </tr>
          </thead>
          <tbody>
            {(team.members || []).map(m => (
              <tr key={m.id}>
                <td style={{ padding: '16px 24px', fontWeight: 600 }}>{m.username} {m.id === user.id && `(${t('teamYou')})`}</td>
                <td style={{ padding: '16px 24px', textTransform: 'capitalize' }}>{m.role}</td>
                <td style={{ padding: '16px 24px', color: 'var(--text3)' }}>{new Date(m.joined_at).toLocaleDateString()}</td>
                <td style={{ padding: '16px 24px' }}><span style={{ color: 'var(--green)' }}>{t('teamActiveStatus')}</span></td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  {m.role !== 'admin' && team.owner_id === user.id && (
                    <button 
                      onClick={() => handleRemoveMember(m.id)}
                      style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >{t('teamRemoveBtn')}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
