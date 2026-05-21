import { Link } from 'react-router-dom';
import { Swords, Trophy, Zap } from 'lucide-react';

const COMPETE_MODES = [
  {
    title: 'Coding Battle',
    href: '/battle',
    icon: Swords,
    accent: 'var(--red)',
    desc: 'Real-time 1v1 or team matches — compete in 5 modes including HP, items, effects, and conquest.',
  },
  {
    title: 'Tournament',
    href: '/tournaments',
    icon: Trophy,
    accent: 'var(--yellow)',
    desc: 'Top 8 / Top 16 single-elimination brackets — win your matches and advance to the next round automatically.',
  },
  {
    title: 'Contest',
    href: '/contest',
    icon: Zap,
    accent: 'var(--blue)',
    desc: 'Solve multiple problems within a set time limit and sharpen your coding test skills.',
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
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: '14px 0 8px' }}>Compete Hub</h1>
          <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.7, maxWidth: 720, margin: 0 }}>
            From real-time battles to tournaments and contests, start all of DailyCoding's competitive modes in one place.
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
                Get Started
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
