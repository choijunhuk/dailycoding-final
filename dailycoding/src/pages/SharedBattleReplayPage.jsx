import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api.js';

function ShareButtons({ url, title }) {
  const [copied, setCopied] = useState(false);

  const onNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* no clipboard access */ }
    }
  }, [url, title]);

  const onCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no clipboard access */ }
  }, [url]);

  const onTwitter = useCallback(() => {
    const text = encodeURIComponent(`${title} - DailyCoding 알고리즘 배틀 리플레이`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
  }, [url, title]);

  const btnStyle = {
    padding: '8px 14px',
    background: 'var(--bg2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 13,
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button onClick={onNativeShare} style={btnStyle}>📤 공유</button>
      <button onClick={onCopyLink} style={btnStyle}>{copied ? '✓ 복사됨' : '🔗 링크 복사'}</button>
      <button onClick={onTwitter} style={btnStyle}>𝕏 트위터</button>
    </div>
  );
}

const EVENT_LABELS = {
  'player.joined': '플레이어 입장',
  'player.ready': '준비 완료',
  'player.attack': '공격',
  'problem.effect': '효과 발동',
  'battle.started': '배틀 시작',
  'battle.ended': '배틀 종료',
  'item.used': '아이템 사용',
  'submission.correct': '정답',
  'submission.wrong': '오답',
};

function fmtTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('ko-KR'); } catch { return ''; }
}

export default function SharedBattleReplayPage() {
  const { slug } = useParams();
  const [replay, setReplay] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get(`/share/battle/${slug}`)
      .then(({ data }) => {
        if (cancelled) return;
        setReplay(data);
        document.title = `${data.room?.title || 'Battle Replay'} · DailyCoding`;
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message || '리플레이를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  const sortedParticipants = useMemo(() => {
    if (!replay?.participants) return [];
    return [...replay.participants].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [replay]);

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'var(--bg)', color:'var(--text2)' }}>
        리플레이 불러오는 중…
      </div>
    );
  }

  if (error || !replay) {
    return (
      <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'var(--bg)', color:'var(--text)' }}>
        <div style={{ padding:24, border:'1px solid var(--border)', borderRadius:16, background:'var(--bg2)', maxWidth:480, textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🔍</div>
          <h2 style={{ margin:'0 0 8px', fontSize:20 }}>리플레이를 찾을 수 없습니다</h2>
          <p style={{ color:'var(--text2)', margin:0 }}>{error || '잘못된 링크이거나 만료된 리플레이입니다.'}</p>
          <Link to="/" style={{ display:'inline-block', marginTop:16, color:'var(--blue)' }}>홈으로</Link>
        </div>
      </div>
    );
  }

  const { room, events } = replay;

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', padding:'40px 20px' }}>
      <div style={{ maxWidth:960, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <Link to="/" style={{ color:'var(--text2)', fontSize:14, textDecoration:'none' }}>← DailyCoding</Link>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <ShareButtons
              url={typeof window !== 'undefined' ? window.location.href : ''}
              title={room.title || `Battle #${room.id}`}
            />
            <span style={{
              padding:'4px 10px',
              background:'var(--bg2)',
              border:'1px solid var(--border)',
              borderRadius:999,
              fontSize:12,
              color:'var(--text2)',
            }}>공개 리플레이</span>
          </div>
        </div>

        <div style={{
          padding:24,
          background:'var(--bg2)',
          border:'1px solid var(--border)',
          borderRadius:16,
          marginBottom:24,
        }}>
          <div style={{ fontSize:13, color:'var(--text3)', marginBottom:4 }}>알고리즘 배틀</div>
          <h1 style={{ margin:'0 0 12px', fontSize:28, fontWeight:800 }}>
            {room.title || `Room #${room.id}`}
          </h1>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:13, color:'var(--text2)' }}>
            <span>모드: <strong style={{ color:'var(--text)' }}>{room.mode || 'standard'}</strong></span>
            <span>상태: <strong style={{ color:'var(--text)' }}>{room.status}</strong></span>
            {room.startedAt && <span>시작: {fmtTime(room.startedAt)}</span>}
            {room.endedAt && <span>종료: {fmtTime(room.endedAt)}</span>}
          </div>
        </div>

        <div style={{ marginBottom:24 }}>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:12 }}>참가자</h2>
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',
            gap:12,
          }}>
            {sortedParticipants.map((p, idx) => (
              <div key={p.userId} style={{
                padding:16,
                background:'var(--bg2)',
                border:'1px solid var(--border)',
                borderRadius:12,
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{
                    width:24, height:24, borderRadius:'50%',
                    background:idx === 0 ? 'var(--yellow)' : 'var(--bg3)',
                    color:idx === 0 ? '#000' : 'var(--text2)',
                    display:'grid', placeItems:'center',
                    fontSize:12, fontWeight:700,
                  }}>{idx + 1}</span>
                  <strong style={{ fontSize:14 }}>{p.username}</strong>
                </div>
                <div style={{ fontSize:13, color:'var(--text2)', display:'flex', gap:12 }}>
                  <span>점수 <strong style={{ color:'var(--text)' }}>{p.score ?? 0}</strong></span>
                  <span>HP <strong style={{ color:'var(--text)' }}>{p.characterHp ?? 0}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:12 }}>이벤트 타임라인 ({events.length})</h2>
          <div style={{
            background:'var(--bg2)',
            border:'1px solid var(--border)',
            borderRadius:12,
            padding:12,
            maxHeight:520,
            overflowY:'auto',
          }}>
            {events.length === 0 ? (
              <div style={{ padding:16, color:'var(--text3)', textAlign:'center' }}>이벤트가 없습니다.</div>
            ) : events.map((ev, i) => (
              <div key={i} style={{
                display:'flex', gap:10, padding:'8px 4px',
                borderBottom: i < events.length - 1 ? '1px solid var(--border-soft, var(--border))' : 'none',
                fontSize:13,
              }}>
                <span style={{ color:'var(--text3)', fontFamily:'Space Mono, monospace', minWidth:78 }}>
                  {fmtTime(ev.createdAt)}
                </span>
                <span style={{ color:'var(--accent, var(--blue))', minWidth:110 }}>
                  {EVENT_LABELS[ev.type] || ev.type}
                </span>
                <span style={{ color:'var(--text2)', flex:1, wordBreak:'break-word' }}>
                  {ev.payload?.effectLabel || ev.payload?.description || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
