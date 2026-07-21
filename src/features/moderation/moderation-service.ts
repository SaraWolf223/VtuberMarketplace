import { getSupabaseEnv, supabaseRestGet } from '@/lib/supabase-rest';

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
};

export type ReportReason =
  | 'scam'
  | 'spam'
  | 'prohibited_item'
  | 'harassment'
  | 'counterfeit'
  | 'stolen'
  | 'misleading'
  | 'other';

export const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'scam', label: 'Scam' },
  { id: 'spam', label: 'Spam' },
  { id: 'prohibited_item', label: 'Prohibited item' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'counterfeit', label: 'Counterfeit' },
  { id: 'stolen', label: 'Stolen goods' },
  { id: 'misleading', label: 'Misleading' },
  { id: 'other', label: 'Other' },
];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.id, r.label])
) as Record<ReportReason, string>;

export function reportReasonLabel(reason: string): string {
  return REPORT_REASON_LABELS[reason as ReportReason] ?? reason.replace(/_/g, ' ');
}

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

  const json = (await res.json()) as EdgeEnvelope<T>;
  if (json.ok && json.data) {
    return json.data;
  }
  const message = json.error?.message ?? `Request failed (${res.status})`;
  throw new Error(message);
}

export async function submitReport(
  accessToken: string,
  input:
    | { target_type: 'listing'; listing_id: string; reason: ReportReason; details?: string }
    | {
        target_type: 'user';
        reported_user_id: string;
        reason: ReportReason;
        details?: string;
      }
): Promise<{ report_id: string; listing_paused?: boolean }> {
  return callEdge('submit-report', accessToken, input);
}

export async function blockUser(
  accessToken: string,
  blockerId: string,
  blockedId: string
): Promise<void> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url}/rest/v1/blocks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      blocker_id: blockerId,
      blocked_id: blockedId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (text.includes('duplicate') || text.includes('23505')) {
      return;
    }
    let message = 'Could not block user';
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed?.message) message = parsed.message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
}

export type BlockedUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  blocked_at: string;
};

export async function listBlockedUsers(
  accessToken: string,
  blockerId: string
): Promise<BlockedUser[]> {
  const blocks = await supabaseRestGet<{ blocked_id: string; created_at: string }>(
    `blocks?blocker_id=eq.${blockerId}&select=blocked_id,created_at&order=created_at.desc`,
    accessToken
  );
  if (!blocks.length) return [];

  const ids = blocks.map((b) => b.blocked_id);
  const profiles = await supabaseRestGet<{
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  }>(
    `profiles_public?id=in.(${ids.join(',')})&select=id,username,display_name,avatar_url`,
    accessToken
  );
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return blocks.map((b) => {
    const p = byId.get(b.blocked_id);
    return {
      id: b.blocked_id,
      username: p?.username ?? null,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      blocked_at: b.created_at,
    };
  });
}

export async function unblockUser(
  accessToken: string,
  blockerId: string,
  blockedId: string
): Promise<void> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url}/rest/v1/blocks?blocker_id=eq.${blockerId}&blocked_id=eq.${blockedId}`, {
    method: 'DELETE',
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Could not unblock user');
  }
}
