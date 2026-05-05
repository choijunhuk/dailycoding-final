import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, CalendarDays, Clipboard, MessageSquare, Share2, Swords, Target, Users, Trophy, Lightbulb } from 'lucide-react';
import api from '../api.js';
import { TIERS } from '../data/problems.js';
import { useToast } from '../context/ToastContext.jsx';

const fallback = {
  weeklyPlan: { days: [] },
  battleAnalysis: { total: 0, wins: 0, losses: 0, draws: 0, avgSolved: 0, insight: '' },
  roleSets: [],
  aiInterview: { flow: [], rubric: [] },
  shareCard: { shareText: '' },
  teamStudy: { steps: [] },
  discussionGuide: { rules: [] },
  hintLadder: [],
  examImprovement: { checks: [] },
  excludedRewardMission: { explanation: '' },
};

function Panel({ icon, title, children, action }) {
  return (
    <section style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, fontSize:16, fontWeight:900 }}>
          {icon}
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function GrowthHubPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/growth-hub')
      .then(({ data }) => {
        if (!cancelled) setData({ ...fallback, ...data });
      })
      .catch(() => {
        toast?.show('성장 허브를 불러오지 못했습니다.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [toast]);

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(data.shareCard?.shareText || '');
      toast?.show('성장 카드 문구를 복사했습니다.', 'success');
    } catch {
      toast?.show('복사에 실패했습니다.', 'error');
    }
  };

  if (loading) {
    return <div style={{ padding:40, color:'var(--text3)' }}>성장 허브를 불러오는 중...</div>;
  }

  return (
    <div style={{ padding:'28px 32px', maxWidth:1180, margin:'0 auto', display:'grid', gap:18 }}>
      <header style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:16, flexWrap:'wrap' }}>
        <div>
          <div style={{ color:'var(--blue)', fontSize:12, fontWeight:900, letterSpacing:'.16em', textTransform:'uppercase', marginBottom:8 }}>Growth Hub</div>
          <h1 style={{ fontSize:26, fontWeight:900, marginBottom:8 }}>DailyCoding 성장 허브</h1>
          <p style={{ color:'var(--text2)', lineHeight:1.7, maxWidth:720 }}>
            주간 학습 플랜, 배틀 분석, 직무형 세트, AI 면접, 성장 공유, 팀 과제, 해설 루틴, 단계형 힌트, 시험 개선을 한 흐름으로 묶었습니다.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/problems?recommended=true')}>
          추천 문제 풀기
        </button>
      </header>

      <div style={{ display:'grid', gridTemplateColumns:'minmax(0, 1.25fr) minmax(320px, .75fr)', gap:18 }} className="dashboard-main-grid">
        <Panel icon={<CalendarDays size={18} color="var(--blue)" />} title={data.weeklyPlan?.title || '이번 주 맞춤 학습 플랜'}>
          <p style={{ color:'var(--text2)', fontSize:13, lineHeight:1.7, marginBottom:14 }}>{data.weeklyPlan?.summary}</p>
          <div style={{ display:'grid', gap:10 }}>
            {(data.weeklyPlan?.days || []).map((item) => (
              <button
                key={`${item.day}-${item.id}`}
                onClick={() => navigate(`/problems/${item.id}`)}
                style={{
                  display:'grid', gridTemplateColumns:'52px minmax(0,1fr) auto', gap:12, alignItems:'center',
                  padding:'12px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)',
                  color:'var(--text)', textAlign:'left', cursor:'pointer', fontFamily:'inherit',
                }}
              >
                <div style={{ fontSize:11, color:'var(--text3)', fontWeight:900 }}>DAY {item.day}<br/><span style={{ color:item.label === '복구' ? 'var(--red)' : 'var(--blue)' }}>{item.label}</span></div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title}</div>
                  <div style={{ fontSize:12, color:'var(--text2)', marginTop:4, lineHeight:1.5 }}>{item.reason}</div>
                </div>
                <span style={{ color:TIERS[item.tier]?.color || 'var(--text3)', fontSize:11, fontWeight:900 }}>{TIERS[item.tier]?.label || item.tier}</span>
              </button>
            ))}
            {(data.weeklyPlan?.days || []).length === 0 && <div style={{ color:'var(--text3)', fontSize:13 }}>추천할 문제가 없습니다.</div>}
          </div>
        </Panel>

        <Panel icon={<Swords size={18} color="var(--yellow)" />} title="배틀 분석">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:14 }}>
            {[
              ['승', data.battleAnalysis?.wins || 0, 'var(--green)'],
              ['패', data.battleAnalysis?.losses || 0, 'var(--red)'],
              ['무', data.battleAnalysis?.draws || 0, 'var(--yellow)'],
            ].map(([label, value, color]) => (
              <div key={label} style={{ padding:'10px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, textAlign:'center' }}>
                <div style={{ color, fontSize:20, fontWeight:900 }}>{value}</div>
                <div style={{ color:'var(--text3)', fontSize:11 }}>{label}</div>
              </div>
            ))}
          </div>
          <p style={{ color:'var(--text2)', fontSize:13, lineHeight:1.7 }}>{data.battleAnalysis?.insight}</p>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/battles/history')} style={{ marginTop:12 }}>배틀 기록 보기</button>
        </Panel>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:18 }}>
        <Panel icon={<Target size={18} color="var(--green)" />} title="회사/직무별 코테 세트">
          <div style={{ display:'grid', gap:10 }}>
            {(data.roleSets || []).map((set) => (
              <div key={set.id} style={{ padding:'12px 14px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8 }}>
                <div style={{ fontSize:14, fontWeight:900 }}>{set.title}</div>
                <div style={{ color:'var(--text2)', fontSize:12, lineHeight:1.6, marginTop:6 }}>{set.description}</div>
                <div style={{ color:'var(--blue)', fontSize:11, fontWeight:800, marginTop:8 }}>{set.focus.join(' · ')}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel icon={<Bot size={18} color="var(--purple)" />} title={data.aiInterview?.title || 'AI 모의 면접'}>
          <ol style={{ margin:'0 0 14px 18px', padding:0, color:'var(--text2)', fontSize:13, lineHeight:1.8 }}>
            {(data.aiInterview?.flow || []).map((step) => <li key={step}>{step}</li>)}
          </ol>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/ai')}>AI 페이지로 이동</button>
        </Panel>

        <Panel icon={<Share2 size={18} color="var(--blue)" />} title="성장 리포트 공유 카드">
          <div style={{ padding:'14px', borderRadius:8, background:'var(--bg3)', border:'1px solid var(--border)', color:'var(--text2)', fontSize:13, lineHeight:1.7 }}>
            {data.shareCard?.shareText}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={copyShare} style={{ marginTop:12 }}><Clipboard size={14} />복사</button>
        </Panel>

        <Panel icon={<Users size={18} color="var(--yellow)" />} title={data.teamStudy?.title || '팀/스터디 과제'}>
          <ul style={{ margin:'0 0 14px 18px', padding:0, color:'var(--text2)', fontSize:13, lineHeight:1.8 }}>
            {(data.teamStudy?.steps || []).map((step) => <li key={step}>{step}</li>)}
          </ul>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(data.teamStudy?.cta || '/team')}>팀 대시보드</button>
        </Panel>

        <Panel icon={<MessageSquare size={18} color="var(--green)" />} title={data.discussionGuide?.title || '토론/해설 강화'}>
          <ul style={{ margin:'0 0 14px 18px', padding:0, color:'var(--text2)', fontSize:13, lineHeight:1.8 }}>
            {(data.discussionGuide?.rules || []).map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(data.discussionGuide?.cta || '/community')}>커뮤니티</button>
        </Panel>

        <Panel icon={<Lightbulb size={18} color="var(--orange)" />} title="AI 힌트 단계 제한">
          <div style={{ display:'grid', gap:8 }}>
            {(data.hintLadder || []).map((item) => (
              <div key={item.step} style={{ padding:'10px 12px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8 }}>
                <div style={{ fontWeight:900, fontSize:13 }}>{item.step}. {item.title}</div>
                <div style={{ color:'var(--text2)', fontSize:12, lineHeight:1.6, marginTop:4 }}>{item.description}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel icon={<Trophy size={18} color="var(--yellow)" />} title={data.examImprovement?.title || '실전 시험 모드 개선'}>
          <div style={{ color:'var(--text2)', fontSize:13, lineHeight:1.7, marginBottom:12 }}>{data.examImprovement?.recommendation}</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {(data.examImprovement?.checks || []).map((check) => (
              <span key={check} style={{ padding:'4px 8px', borderRadius:999, background:'var(--bg3)', color:'var(--text3)', fontSize:11, fontWeight:800 }}>{check}</span>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate(data.examImprovement?.cta || '/exams')} style={{ marginTop:12 }}>모의 코테 보기</button>
        </Panel>
      </div>

      <Panel icon={<Target size={18} color="var(--red)" />} title="3번 오답 복구 미션 설명">
        <p style={{ color:'var(--text2)', fontSize:13, lineHeight:1.8, margin:0 }}>
          {data.excludedRewardMission?.explanation}
        </p>
      </Panel>
    </div>
  );
}
