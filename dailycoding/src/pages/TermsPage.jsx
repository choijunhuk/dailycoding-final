import { useNavigate } from 'react-router-dom';

const LAST_UPDATED = 'April 10, 2026';

const sections = [
  {
    title: '1. Service Overview',
    content: `DailyCoding (the "Service") is a coding learning platform that provides daily problem solving, 1v1 battles, contests, AI code reviews, and more. These Terms govern your rights, obligations, and responsibilities when using the Service. By registering for or using the Service, you are deemed to have agreed to these Terms.`,
  },
  {
    title: '2. Eligibility',
    content: `The Service is available to anyone aged 14 or older. Users under the age of 14 may not register without the consent of a legal guardian. If such use is discovered, the account may be immediately deleted.`,
  },
  {
    title: '3. Accounts',
    content: `Users must adhere to the one-account-per-person policy. You must provide accurate information when registering; any disadvantage arising from false information is your own responsibility. You are responsible for managing your account credentials (email, password, etc.) and may not transfer or share your account with any third party.`,
  },
  {
    title: '4. Prohibited Conduct',
    content: `The following actions are strictly prohibited.\n• Cheating: using external tools, copying code, automated scripts, or any other means of obtaining answers dishonestly\n• Using another person's account: logging in as another user or submitting solutions on their behalf\n• Attacking the server: DDoS, SQL injection, scraping, or any other action that threatens the service infrastructure\n• Posting illegal or harmful content, or making defamatory or hateful statements about others\n\nViolations may result in account suspension or deletion without prior warning.`,
  },
  {
    title: '5. Paid Services',
    content: `DailyCoding offers a Pro plan and a Team plan as paid subscriptions. Payments are processed through Stripe, and subscription fees are charged in advance.\n\nRefund Policy: If you have not materially used the Service within 7 days of payment, you may request a full refund. Refunds may be limited after 7 days. To request a refund, contact choijunhuk2007@gmail.com.`,
  },
  {
    title: '6. Intellectual Property',
    content: `All intellectual property rights in the Service, including problem content, explanations, test cases, designs, and software code, belong to DailyCoding. Users may not reproduce, distribute, or commercially exploit any such content beyond the scope of using the Service. The copyright of solution code written by users belongs to those users; however, DailyCoding may use such code to the extent necessary for operating the Service.`,
  },
  {
    title: '7. Disclaimer',
    content: `DailyCoding does not guarantee uninterrupted service and is not liable for service interruptions caused by maintenance, failures, natural disasters, or other events beyond our control. We are also not liable for disputes between users or for damages caused by a user's own actions. Content provided through the Service is for educational purposes and does not guarantee any specific outcome.`,
  },
  {
    title: '8. Contact',
    content: `For inquiries regarding these Terms, please contact us at the email below.\n\nEmail: choijunhuk2007@gmail.com\nBusiness hours: Weekdays 09:00 – 18:00 (KST)`,
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
          ← Back
        </button>
        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          margin: 0,
          color: 'var(--text)',
        }}>
          Terms of Service
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
        Last updated: {LAST_UPDATED}
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
        These Terms are effective as of {LAST_UPDATED}.<br />
        Contact: <a href="mailto:choijunhuk2007@gmail.com" style={{ color: 'var(--blue)', textDecoration: 'none' }}>choijunhuk2007@gmail.com</a>
      </div>
    </div>
  );
}
