import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { renderEmailTemplate } from './email-templates.ts';

const EDU_DOMAIN_RE = /\.edu$/i;
const DISPOSABLE_LOCAL_RE = /\+.*@/;

export function normalizeCollegeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!email.includes('@') || email.length > 254) return null;
  if (DISPOSABLE_LOCAL_RE.test(email)) return null;

  const [, domain] = email.split('@');
  if (!domain || !EDU_DOMAIN_RE.test(domain)) return null;

  return email;
}

export async function hashCollegeOtp(code: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(code));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateCollegeOtp(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const code = 100000 + (bytes[0] % 900000);
  return String(code);
}

export function getCollegeOtpSecret(): string {
  const secret = Deno.env.get('COLLEGE_OTP_SECRET');
  if (!secret) {
    throw new Error('COLLEGE_OTP_SECRET is not configured');
  }
  return secret;
}

export async function sendCollegeOtpEmail(
  admin: SupabaseClient,
  to: string,
  code: string
): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('COLLEGE_EMAIL_FROM') ?? 'Local Marketplace <noreply@yourdomain.com>';

  const { subject, body } = await renderEmailTemplate(
    admin,
    'college_otp_code',
    { code },
    {
      subject: 'Your {{app_name}} college verification code',
      body: 'Your verification code is {{code}}. It expires in 15 minutes.',
    }
  );

  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Email send failed: ${body.slice(0, 120)}`);
    }
    return;
  }

  const isProd =
    Deno.env.get('DENO_ENV') === 'production' || Deno.env.get('ENVIRONMENT') === 'production';
  if (isProd) {
    throw new Error('Email delivery is not configured. Contact support.');
  }
  console.log('[college-otp] Email not configured — OTP not sent (dev only)');
}
