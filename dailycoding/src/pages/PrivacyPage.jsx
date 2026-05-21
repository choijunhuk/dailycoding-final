import { useNavigate } from 'react-router-dom';

const LAST_UPDATED = 'April 10, 2026';

const sections = [
  {
    title: '1. Personal Information We Collect',
    content: `DailyCoding collects the following personal information to provide the Service.\n\n• Required information: email address, nickname (username), password (stored encrypted)\n• Service usage information: problem-solving history, submitted code, correctness results, battle participation records, contest scores\n• Automatically collected information: access IP, browser information, service usage time, etc.`,
  },
  {
    title: '2. Purpose of Collection',
    content: `Collected personal information is used only for the following purposes.\n\n• Service provision and operation: login authentication, saving solve history, calculating rankings\n• Service improvement: usage pattern analysis and statistical processing (in a form that cannot identify individuals)\n• Delivering notices and important announcements\n• Preventing misuse and maintaining security`,
  },
  {
    title: '3. Retention Period',
    content: `Personal information is retained until account deletion, and will be deleted immediately upon request. However, information that must be retained for a certain period under applicable law (e.g., payment records) will be kept for the period prescribed by that law.\n\n• Records related to e-commerce: 5 years (Electronic Commerce Act)\n• Login records: 3 months (Protection of Communications Secrets Act)`,
  },
  {
    title: '4. Disclosure to Third Parties',
    content: `DailyCoding does not, in principle, provide users' personal information to outside parties. However, the following partners receive the minimum necessary information for service operations.\n\n• Stripe (payment processing): email, payment information — for payment processing purposes\n• Google OAuth (social login): Google account identifier, email — for login authentication purposes\n• GitHub OAuth (social login): GitHub account identifier, email — for login authentication purposes\n\nPlease refer to each partner's privacy policy on their respective websites.`,
  },
  {
    title: '5. User Rights',
    content: `Users may exercise the following rights at any time.\n\n• Right of access: view the personal information we hold\n• Right of rectification: request correction of inaccurate personal information\n• Right of erasure: request deletion of account and personal information (account withdrawal)\n• Right to restriction of processing: request suspension of certain data collection or processing\n\nRights may be exercised through the settings menu within the Service or by contacting choijunhuk2007@gmail.com.`,
  },
  {
    title: '6. Cookies and Local Storage',
    content: `The Service stores a JWT token in the browser's local storage to maintain your logged-in state. This is used for automatic login on return visits.\n\nThe Service may also use cookies for your convenience. You can disable cookies in your browser settings, but some features may be restricted as a result.`,
  },
  {
    title: '7. Contact',
    content: `For inquiries about personal information processing, or to request access, correction, or deletion, please contact us at:\n\nEmail: choijunhuk2007@gmail.com\nBusiness hours: Weekdays 09:00 – 18:00 (KST)\n\nYou may also report personal information violations to the Personal Information Protection Commission (privacy.go.kr) or the Korea Internet & Security Agency (118.go.kr).`,
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
          ← Back
        </button>
        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          margin: 0,
          color: 'var(--text)',
        }}>
          Privacy Policy
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
        This policy is effective as of {LAST_UPDATED}.<br />
        Contact: <a href="mailto:choijunhuk2007@gmail.com" style={{ color: 'var(--blue)', textDecoration: 'none' }}>choijunhuk2007@gmail.com</a>
      </div>
    </div>
  );
}
