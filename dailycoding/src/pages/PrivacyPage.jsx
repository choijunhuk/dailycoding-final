import { useNavigate } from 'react-router-dom';

const LAST_UPDATED = '2026년 4월 10일';

const sections = [
  {
    title: '1. 수집하는 개인정보',
    content: `DailyCoding은 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.\n\n• 필수 정보: 이메일 주소, 닉네임(사용자명), 비밀번호(암호화 저장)\n• 서비스 이용 정보: 문제 풀이 기록, 제출 코드, 정답 여부, 배틀 참여 기록, 콘테스트 성적\n• 자동 수집 정보: 접속 IP, 브라우저 정보, 서비스 이용 시간 등`,
  },
  {
    title: '2. 수집 목적',
    content: `수집된 개인정보는 다음 목적으로만 사용됩니다.\n\n• 서비스 제공 및 운영: 로그인 인증, 풀이 기록 저장, 랭킹 산정\n• 서비스 개선: 이용 패턴 분석 및 통계 처리 (개인을 식별할 수 없는 형태)\n• 공지사항 및 중요 안내 전달\n• 부정 이용 방지 및 보안 유지`,
  },
  {
    title: '3. 보유 기간',
    content: `개인정보는 회원 탈퇴 시까지 보유하며, 탈퇴 요청 시 즉시 삭제됩니다. 단, 관계 법령에 따라 일정 기간 보존이 필요한 정보(결제 기록 등)는 해당 법령이 정한 기간 동안 보관됩니다.\n\n• 전자상거래 관련 기록: 5년 (전자상거래법)\n• 로그인 기록: 3개월 (통신비밀보호법)`,
  },
  {
    title: '4. 제3자 제공',
    content: `DailyCoding은 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 서비스 운영을 위해 아래 업체에 최소한의 정보를 제공합니다.\n\n• Stripe (결제 처리): 이메일, 결제 정보 — 결제 처리 목적\n• Google OAuth (소셜 로그인): Google 계정 식별자, 이메일 — 로그인 인증 목적\n• GitHub OAuth (소셜 로그인): GitHub 계정 식별자, 이메일 — 로그인 인증 목적\n\n각 업체의 개인정보 처리 방침은 해당 업체 사이트에서 확인하세요.`,
  },
  {
    title: '5. 이용자 권리',
    content: `이용자는 언제든지 다음 권리를 행사할 수 있습니다.\n\n• 열람권: 보유 중인 개인정보 내용 확인\n• 수정권: 부정확한 개인정보 정정 요청\n• 삭제권: 계정 및 개인정보 삭제 요청 (회원 탈퇴)\n• 처리 정지권: 일부 데이터 수집·처리 중단 요청\n\n권리 행사는 서비스 내 설정 메뉴 또는 choijunhuk2007@gmail.com 로 요청하실 수 있습니다.`,
  },
  {
    title: '6. 쿠키 및 로컬 스토리지',
    content: `서비스는 로그인 상태 유지를 위해 JWT 토큰을 브라우저의 로컬 스토리지에 저장합니다. 이는 재방문 시 자동 로그인에 사용됩니다.\n\n또한 서비스 이용 편의를 위해 쿠키를 사용할 수 있습니다. 브라우저 설정에서 쿠키를 비활성화할 수 있으나, 일부 기능이 제한될 수 있습니다.`,
  },
  {
    title: '7. 문의',
    content: `개인정보 처리에 관한 문의, 열람·수정·삭제 요청은 아래로 연락해 주세요.\n\n이메일: choijunhuk2007@gmail.com\n운영 시간: 평일 09:00 – 18:00 (KST)\n\n개인정보 침해 신고는 개인정보보호위원회(privacy.go.kr) 또는 한국인터넷진흥원(118.go.kr)에도 접수할 수 있습니다.`,
  },
];

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      padding: '40px 20px',
      maxWidth: 800,
      margin: '0 auto',
      color: 'var(--text)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost btn-sm"
          style={{ flexShrink: 0 }}
        >
          ← 뒤로
        </button>
        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          margin: 0,
          color: 'var(--text)',
        }}>
          개인정보 처리방침
        </h1>
      </div>

      {/* Last updated */}
      <div style={{
        fontSize: 13,
        color: 'var(--text3)',
        marginBottom: 32,
        padding: '10px 16px',
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        display: 'inline-block',
      }}>
        최종 업데이트: {LAST_UPDATED}
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {sections.map((section) => (
          <div
            key={section.title}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '24px 28px',
            }}
          >
            <h2 style={{
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--blue)',
              margin: '0 0 12px 0',
            }}>
              {section.title}
            </h2>
            <p style={{
              fontSize: 14,
              color: 'var(--text2)',
              lineHeight: 1.8,
              margin: 0,
              whiteSpace: 'pre-line',
            }}>
              {section.content}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 40,
        paddingTop: 24,
        borderTop: '1px solid var(--border)',
        fontSize: 13,
        color: 'var(--text3)',
        textAlign: 'center',
        lineHeight: 1.7,
      }}>
        본 방침은 {LAST_UPDATED}부터 적용됩니다.<br />
        문의: <a href="mailto:choijunhuk2007@gmail.com" style={{ color: 'var(--blue)', textDecoration: 'none' }}>choijunhuk2007@gmail.com</a>
      </div>
    </div>
  );
}
