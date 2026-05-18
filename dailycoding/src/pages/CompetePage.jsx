import { Link } from 'react-router-dom';
import { Swords, Trophy, Users, Zap } from 'lucide-react';

const COMPETE_MODES = [
  {
    title: '1v1 배틀',
    href: '/battles/history',
    icon: Users,
    accent: 'var(--green)',
    desc: '친구와 초대 코드로 빠르게 붙는 클래식 코딩 대결입니다.',
  },
  {
    title: '알고리즘 배틀',
    href: '/battle',
    icon: Swords,
    accent: 'var(--red)',
    desc: 'HP, 아이템, 효과, 점령전까지 포함한 DailyCoding 대표 실시간 배틀입니다.',
  },
  {
    title: '토너먼트',
    href: '/tournaments',
    icon: Trophy,
    accent: 'var(--yellow)',
    desc: '8강·16강 브라켓으로 실력을 겨루고 자동 매치로 다음 라운드에 진출합니다.',
  },
  {
    title: '대회',
    href: '/contest',
    icon: Zap,
    accent: 'var(--blue)',
    desc: '정해진 시간 안에 여러 문제를 풀며 실전 코딩 테스트 감각을 키웁니다.',
  },
];

export default function CompetePage() {
  return (
    <main style={{
      minHeight: '100%',
      background: 'var(--bg)',
      padding: '34px 28px 48px',
    }}>
      <section style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 11px',
            borderRadius: 999,
            background: 'var(--glass-bg)',
            border: '1px solid var(--border)',
            color: 'var(--blue)',
            fontSize: 12,
            fontWeight: 800,
          }}>
            ⚔️ COMPETE
          </span>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: '14px 0 8px' }}>대결 허브</h1>
          <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.7, maxWidth: 720, margin: 0 }}>
            실시간 배틀부터 토너먼트와 대회까지, DailyCoding의 경쟁 모드를 한 곳에서 시작하세요.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {COMPETE_MODES.map(({ title, href, icon: Icon, accent, desc }) => (
            <article key={title} className="card card-hover" style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              padding: 22,
              boxShadow: 'var(--shadow)',
              minHeight: 220,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 15,
                display: 'grid',
                placeItems: 'center',
                color: accent,
                background: `${accent}18`,
                border: `1px solid ${accent}33`,
              }}>
                <Icon size={23} />
              </div>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 900, margin: '0 0 8px' }}>{title}</h2>
                <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
              <div style={{ flex: 1 }} />
              <Link to={href} className="btn btn-primary" style={{ justifyContent: 'center', textDecoration: 'none' }}>
                시작하기
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
