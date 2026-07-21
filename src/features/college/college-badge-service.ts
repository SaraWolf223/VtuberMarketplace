import { getSupabaseEnv } from '@/lib/supabase-rest';

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { message?: string } | null;
};

async function callEdge<T>(fn: string, accessToken: string, body: unknown): Promise<T> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let json: EdgeEnvelope<T>;
  try {
    json = JSON.parse(raw) as EdgeEnvelope<T>;
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }

  if (json.ok && json.data) {
    return json.data;
  }
  throw new Error(json.error?.message ?? `Request failed (${res.status})`);
}

export async function sendCollegeEmailCode(
  accessToken: string,
  email: string
): Promise<{ expires_at: string }> {
  return callEdge<{ sent: boolean; expires_at: string }>(
    'send-college-email-code',
    accessToken,
    { email }
  );
}

export async function verifyCollegeEmailCode(
  accessToken: string,
  email: string,
  code: string
): Promise<{ college_badge_expires_at: string; college_edu_email: string }> {
  return callEdge('verify-college-email-code', accessToken, { email, code });
}

export function isCollegeBadgeActive(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

/** Badge expired but user still has 10 days to re-verify before data is purged. */
export function isInCollegeReverifyGrace(
  expiresAt: string | null | undefined,
  reverifyDeadlineAt: string | null | undefined
): boolean {
  if (!expiresAt || !reverifyDeadlineAt) return false;
  const now = Date.now();
  return (
    new Date(expiresAt).getTime() <= now && new Date(reverifyDeadlineAt).getTime() > now
  );
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}
