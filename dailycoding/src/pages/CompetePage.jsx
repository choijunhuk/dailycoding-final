import { Link } from 'react-router-dom';
import { Swords, Trophy, Wrench } from 'lucide-react';
import { useLang } from '../context/LangContext.jsx';
import { pickLangText } from '../utils/languageMode.js';

const COMPETE_MODES = [
  {
    title: { ko: '코딩 배틀', en: 'Coding Battle' },
    href: '/battle',
    icon: Swords,
    accent: 'var(--red)',
    desc: { ko: '실시간 1v1 배틀 — 스피드, HP, 아이템, 이펙트, 영토 정복 모드로 경쟁하세요.', en: 'Real-time 1v1 battle — compete in speed, HP, items, effects, and territory modes.' },
  },
  {
    title: { ko: '토너먼트', en: 'Tournament' },
    href: '/tournaments',
    icon: Trophy,
    accent: 'var(--yellow)',
    desc: { ko: 'Top 8 / Top 16 싱글 엘리미네이션 브래킷 — 매치를 이기면 다음 라운드로 자동 진출합니다.', en: 'Top 8 / Top 16 single elimination bracket — win matches to advance automatically.' },
  },
  {
    title: { ko: '워크샵', en: 'Workshop' },
    href: '/workshop-gallery',
    icon: Wrench,
    accent: 'var(--purple)',
    desc: { ko: '커스텀 배틀 모드를 만들고 공유하세요. 이벤트·조건·액션 블록으로 나만의 룰을 정의합니다.', en: 'Create and share custom battle modes. Define your own rules with event·condition·action blocks.' },
  },
];

export default function CompetePage() {
  const { lang } = useLang();
  const txt = (ko, en) => pickLangText(lang, ko, en);
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
            ⚔️ {txt('경쟁', 'Compete')}
          </span>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: '14px 0 8px' }}>{txt('경쟁 허브', 'Competition Hub')}</h1>
          <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.7, maxWidth: 720, margin: 0 }}>
            {txt('실시간 배틀부터 토너먼트, 워크샵까지 데일리코딩의 모든 경쟁 모드를 한곳에서 시작하세요.', 'From real-time battles to tournaments and workshop — start every DailyCoding competition mode in one place.')}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {COMPETE_MODES.map(({ title, href, icon: Icon, accent, desc }) => (
            <article key={title.ko} className="card card-hover" style={{
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
                <h2 style={{ fontSize: 19, fontWeight: 900, margin: '0 0 8px' }}>{title[lang] ?? title.ko}</h2>
                <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.65, margin: 0 }}>{desc[lang] ?? desc.ko}</p>
              </div>
              <div style={{ flex: 1 }} />
              <Link to={href} className="btn btn-primary" style={{ justifyContent: 'center', textDecoration: 'none' }}>
                {txt('시작하기', 'Start')}
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
