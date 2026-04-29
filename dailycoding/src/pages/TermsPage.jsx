import { useNavigate } from 'react-router-dom';

const LAST_UPDATED = '2026년 4월 10일';

const sections = [
  {
    title: '1. 서비스 개요',
    content: `DailyCoding(이하 "서비스")은 매일 코딩 문제 풀이, 1v1 배틀, 콘테스트, AI 코드 리뷰 등을 제공하는 코딩 학습 플랫폼입니다. 본 약관은 서비스 이용에 관한 권리·의무 및 책임 사항을 규정합니다. 서비스에 가입하거나 이용함으로써 본 약관에 동의한 것으로 간주됩니다.`,
  },
  {
    title: '2. 이용 자격',
    content: `서비스는 만 14세 이상이라면 누구나 이용할 수 있습니다. 만 14세 미만의 이용자는 법정 대리인의 동의 없이 서비스에 가입할 수 없으며, 해당 사실이 확인될 경우 계정이 즉시 삭제될 수 있습니다.`,
  },
  {
    title: '3. 계정',
    content: `이용자는 1인 1계정 원칙을 준수해야 합니다. 가입 시 정확한 정보를 제공해야 하며, 허위 정보로 인해 발생하는 불이익은 이용자 본인이 부담합니다. 계정 정보(이메일, 비밀번호 등)의 관리 책임은 이용자에게 있으며, 제3자에게 계정을 양도하거나 공유할 수 없습니다.`,
  },
  {
    title: '4. 금지 행위',
    content: `다음 행위는 엄격히 금지됩니다.\n• 치팅: 외부 도구, 코드 복붙, 자동화 스크립트 등을 이용한 부정 풀이\n• 타인 계정 사용: 다른 이용자의 계정으로 로그인하거나 대리 풀이 행위\n• 서버 공격: DDoS, SQL 인젝션, 크롤링 등 서비스 인프라를 위협하는 행위\n• 불법·유해 콘텐츠 게시 및 타인에 대한 비방·혐오 발언\n\n위반 시 사전 경고 없이 계정이 정지 또는 삭제될 수 있습니다.`,
  },
  {
    title: '5. 유료 서비스',
    content: `DailyCoding은 Pro 플랜 및 Team 플랜을 유료로 제공합니다. 결제는 Stripe를 통해 처리되며, 구독 요금은 선불로 청구됩니다.\n\n환불 정책: 결제일로부터 7일 이내에 서비스를 실질적으로 이용하지 않은 경우 전액 환불을 요청할 수 있습니다. 7일 경과 후에는 환불이 제한될 수 있습니다. 환불 요청은 support@dailycoding.kr로 문의하세요.`,
  },
  {
    title: '6. 지적재산권',
    content: `서비스 내 모든 문제 콘텐츠, 해설, 테스트케이스, 디자인, 소프트웨어 코드 등의 지적재산권은 DailyCoding에 귀속됩니다. 이용자는 서비스 이용 목적 외의 복제, 배포, 상업적 이용을 할 수 없습니다. 이용자가 작성한 풀이 코드의 저작권은 해당 이용자에게 있으나, 서비스 운영에 필요한 범위 내에서 DailyCoding이 이를 활용할 수 있습니다.`,
  },
  {
    title: '7. 면책 조항',
    content: `DailyCoding은 서비스의 무중단을 보장하지 않으며, 점검·장애·천재지변 등으로 인한 서비스 중단에 대해 책임지지 않습니다. 또한 이용자 간 분쟁, 이용자의 귀책 사유로 인한 손해에 대해서도 책임을 지지 않습니다. 서비스에서 제공하는 콘텐츠는 학습 목적으로 제공되며, 특정 결과를 보장하지 않습니다.`,
  },
  {
    title: '8. 문의',
    content: `본 약관에 대한 문의 사항은 아래 이메일로 연락해 주세요.\n\n이메일: support@dailycoding.kr\n운영 시간: 평일 09:00 – 18:00 (KST)`,
  },
];

export default function TermsPage() {
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
          이용약관
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
        본 약관은 {LAST_UPDATED}부터 적용됩니다.<br />
        문의: <a href="mailto:support@dailycoding.kr" style={{ color: 'var(--blue)', textDecoration: 'none' }}>support@dailycoding.kr</a>
      </div>
    </div>
  );
}
