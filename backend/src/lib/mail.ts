const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

let transporter: { sendMail: (params: Record<string, unknown>) => Promise<unknown> } | null = null;

function clamp(value: unknown): string {
  return String(value ?? '').trim();
}

function requireEnv(name: string): string {
  const value = clamp(process.env[name]);

  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }

  return value;
}

function getRuntimeMailProvider(): 'smtp' | 'brevo' {
  return clamp(process.env.NODE_ENV).toLowerCase() === 'production' ? 'brevo' : 'smtp';
}

function parseFrom(raw: string) {
  const input = clamp(raw);
  const match = input.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);

  if (match) {
    return {
      name: match[1] || '',
      email: match[2] || '',
    };
  }

  return {
    name: '',
    email: input,
  };
}

function getSender() {
  const name = clamp(process.env.MAIL_FROM_NAME || 'MyAniTrack');
  const email = clamp(process.env.MAIL_FROM_EMAIL);

  if (email) {
    return { name, email };
  }

  const fallback = clamp(process.env.MAIL_FROM);

  if (fallback) {
    const parsed = parseFrom(fallback);

    if (parsed.email) {
      return {
        name: parsed.name || name,
        email: parsed.email,
      };
    }
  }

  return {
    name,
    email: '',
  };
}

function getSmtpFrom() {
  const smtpUser = requireEnv('SMTP_USER');
  const sender = getSender();
  return `${sender.name || 'MyAniTrack'} <${smtpUser}>`;
}

function getAppOrigin() {
  return clamp(process.env.APP_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');
}

function buildVerifyUrl(token: string) {
  return `${getAppOrigin()}/verify-email/confirm?token=${encodeURIComponent(token)}`;
}

function buildResetUrl(token: string, email: string) {
  return `${getAppOrigin()}/password-reset/confirm?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
}

function getTransporter(): { sendMail: (params: Record<string, unknown>) => Promise<unknown> } {
  if (transporter) {
    return transporter!;
  }

  let nodemailer: any;

  try {
    nodemailer = require('nodemailer');
  } catch {
    throw new Error('Missing package: nodemailer. Run npm install nodemailer');
  }

  const host = requireEnv('SMTP_HOST');
  const port = Number(process.env.SMTP_PORT || '587');
  const secure = port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: requireEnv('SMTP_USER'),
      pass: requireEnv('SMTP_PASS'),
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  return transporter!;
}

async function sendViaSmtp(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const client = getTransporter();

  return client.sendMail({
    from: getSmtpFrom(),
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}

async function brevoSend(payload: unknown) {
  const apiKey = requireEnv('BREVO_API_KEY');

  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message?: unknown }).message || `Brevo error (${response.status})`)
        : text || `Brevo error (${response.status})`;

    throw new Error(message);
  }

  return data;
}

async function sendViaBrevo(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const sender = getSender();

  if (!sender.email) {
    throw new Error('Missing sender email. Set MAIL_FROM_EMAIL or MAIL_FROM.');
  }

  return brevoSend({
    sender,
    to: [{ email: params.to }],
    subject: params.subject,
    htmlContent: params.html,
    textContent: params.text,
  });
}

function verifyEmailHtml(verifyUrl: string) {
  return `
<div style="background-color:#ffffff; padding:40px 0; font-family:Arial, sans-serif;">
  <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto; border-collapse:collapse;">
    <tr>
      <td style="border:1px solid #f1f1f1; border-radius:12px; padding:32px; background-color:#ffffff;">
        <h2 style="margin:0 0 16px 0; font-size:20px; font-weight:700; color:#111827; text-align:center;">
          이메일 인증이 필요합니다
        </h2>
        <p style="margin:0 0 24px 0; font-size:14px; line-height:1.6; color:#374151; text-align:center;">
          MyAniTrack 계정을 활성화하려면<br />
          아래 버튼을 클릭해 이메일 인증을 완료해주세요.
        </p>
        <div style="text-align:center; margin-bottom:24px;">
          <a href="${verifyUrl}" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:#ffffff; background-color:#fb7185; border-radius:9999px; text-decoration:none;">
            이메일 인증하기
          </a>
        </div>
        <p style="margin:0 0 8px 0; font-size:12px; color:#6b7280; text-align:center;">
          버튼이 작동하지 않는다면 아래 링크를 복사해 사용하세요.
        </p>
        <p style="margin:0; font-size:12px; color:#fb7185; text-align:center; word-break:break-all;">
          <a href="${verifyUrl}" style="color:#fb7185; text-decoration:none;">${verifyUrl}</a>
        </p>
      </td>
    </tr>
  </table>
</div>
  `.trim();
}

function resetEmailHtml(resetUrl: string) {
  return `
<div style="background-color:#ffffff; padding:40px 0; font-family:Arial, sans-serif;">
  <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto; border-collapse:collapse;">
    <tr>
      <td style="border:1px solid #f1f1f1; border-radius:12px; padding:32px; background-color:#ffffff;">
        <h2 style="margin:0 0 16px 0; font-size:20px; font-weight:700; color:#111827; text-align:center;">
          비밀번호 재설정
        </h2>
        <p style="margin:0 0 24px 0; font-size:14px; line-height:1.6; color:#374151; text-align:center;">
          아래 버튼을 클릭해 새 비밀번호를 설정하세요.<br />
          이 링크는 일정 시간 후 만료됩니다.
        </p>
        <div style="text-align:center; margin-bottom:24px;">
          <a href="${resetUrl}" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:600; color:#ffffff; background-color:#fb7185; border-radius:9999px; text-decoration:none;">
            비밀번호 재설정하기
          </a>
        </div>
        <p style="margin:0 0 8px 0; font-size:12px; color:#6b7280; text-align:center;">
          버튼이 작동하지 않으면 아래 링크를 복사해 사용하세요.
        </p>
        <p style="margin:0; font-size:12px; color:#fb7185; text-align:center; word-break:break-all;">
          <a href="${resetUrl}" style="color:#fb7185; text-decoration:none;">${resetUrl}</a>
        </p>
      </td>
    </tr>
  </table>
</div>
  `.trim();
}

async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (getRuntimeMailProvider() === 'brevo') {
    return sendViaBrevo(params);
  }

  return sendViaSmtp(params);
}

export async function sendVerifyEmail(params: { to: string; token: string }) {
  const verifyUrl = buildVerifyUrl(params.token);

  return sendMail({
    to: params.to,
    subject: '[MyAniTrack] 이메일 인증을 완료해주세요',
    html: verifyEmailHtml(verifyUrl),
    text: `MyAniTrack 이메일 인증 링크: ${verifyUrl}`,
  });
}

export async function sendPasswordResetEmail(params: { to: string; token: string; email: string }) {
  const resetUrl = buildResetUrl(params.token, params.email);

  return sendMail({
    to: params.to,
    subject: '[MyAniTrack] 비밀번호 재설정 안내',
    html: resetEmailHtml(resetUrl),
    text: `MyAniTrack 비밀번호 재설정 링크: ${resetUrl}\n(요청하지 않았다면 무시하세요.)`,
  });
}



