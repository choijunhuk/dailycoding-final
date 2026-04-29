import nodemailer from 'nodemailer';

const SMTP_CONFIGURED =
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS;

let transporter = null;

if (SMTP_CONFIGURED) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM || 'DailyCoding <noreply@dailycoding.kr>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.log(`\n[DEV EMAIL] To: ${to}\nSubject: ${subject}\n${html}\n`);
    return;
  }
  await transporter.sendMail({ from: FROM, to, subject, html });
}

export async function sendVerificationEmail(email, token, username) {
  const link = `${FRONTEND_URL}/verify-email?token=${token}`;
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">DailyCoding</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">매일 성장하는 개발자</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h2 style="margin:0 0 12px;color:#1e1e2e;font-size:20px;font-weight:600;">이메일 인증</h2>
            <p style="margin:0 0 8px;color:#4a4a6a;font-size:15px;line-height:1.6;">안녕하세요, <strong>${username}</strong>님!</p>
            <p style="margin:0 0 28px;color:#4a4a6a;font-size:15px;line-height:1.6;">
              DailyCoding에 가입해 주셔서 감사합니다.<br>
              아래 버튼을 클릭하여 이메일 인증을 완료해 주세요.
            </p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center">
                <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:8px;letter-spacing:0.2px;">이메일 인증하기</a>
              </td></tr>
            </table>
            <p style="margin:28px 0 0;color:#9090a8;font-size:13px;line-height:1.6;">
              버튼이 작동하지 않으면 아래 링크를 브라우저에 붙여넣으세요:<br>
              <a href="${link}" style="color:#6366f1;word-break:break-all;">${link}</a>
            </p>
            <p style="margin:16px 0 0;color:#9090a8;font-size:13px;">이 링크는 <strong>24시간</strong> 후 만료됩니다.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fc;padding:20px 40px;border-top:1px solid #eaeaf0;text-align:center;">
            <p style="margin:0;color:#b0b0c8;font-size:12px;">본 메일은 발신 전용입니다. © 2025 DailyCoding. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  await sendMail({ to: email, subject: '[DailyCoding] 이메일 인증을 완료해 주세요', html });
}

export async function sendPasswordResetEmail(email, token, username) {
  const link = `${FRONTEND_URL}/reset-password?token=${token}`;
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">DailyCoding</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">매일 성장하는 개발자</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h2 style="margin:0 0 12px;color:#1e1e2e;font-size:20px;font-weight:600;">비밀번호 재설정</h2>
            <p style="margin:0 0 8px;color:#4a4a6a;font-size:15px;line-height:1.6;">안녕하세요, <strong>${username}</strong>님!</p>
            <p style="margin:0 0 28px;color:#4a4a6a;font-size:15px;line-height:1.6;">
              비밀번호 재설정을 요청하셨습니다.<br>
              아래 버튼을 클릭하여 새 비밀번호를 설정해 주세요.
            </p>
            <table cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center">
                <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 40px;border-radius:8px;letter-spacing:0.2px;">비밀번호 재설정하기</a>
              </td></tr>
            </table>
            <p style="margin:28px 0 0;color:#9090a8;font-size:13px;line-height:1.6;">
              버튼이 작동하지 않으면 아래 링크를 브라우저에 붙여넣으세요:<br>
              <a href="${link}" style="color:#6366f1;word-break:break-all;">${link}</a>
            </p>
            <p style="margin:16px 0 0;color:#9090a8;font-size:13px;">이 링크는 <strong>1시간</strong> 후 만료됩니다.</p>
            <p style="margin:16px 0 0;color:#9090a8;font-size:13px;">본인이 요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f9fc;padding:20px 40px;border-top:1px solid #eaeaf0;text-align:center;">
            <p style="margin:0;color:#b0b0c8;font-size:12px;">본 메일은 발신 전용입니다. © 2025 DailyCoding. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  await sendMail({ to: email, subject: '[DailyCoding] 비밀번호 재설정 안내', html });
}
