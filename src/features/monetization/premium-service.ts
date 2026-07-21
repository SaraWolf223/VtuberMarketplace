import { getSupabaseEnv, supabaseRestGet } from '@/lib/supabase-rest';

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
};

export type PremiumCheckoutResult = {
  checkout_url: string;
  session_id: string;
};

export type PremiumBoostCredits = {
  period_start: string;
  credits_total: number;
  credits_used: number;
};

async function callEdge<T>(fn: string, accessToken: string, body: unknown = {}): Promise<T> {
  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timeoutMs = fn === 'create-premium-checkout' ? 30_000 : 45_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${url}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const json = (await res.json()) as EdgeEnvelope<T>;

    if (json.ok && json.data) {
      return json.data;
    }

    if (res.status === 404) {
      throw new Error(
        'Premium checkout is not deployed yet. Run: npx supabase functions deploy create-premium-checkout'
      );
    }
    const message = json.error?.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function createPremiumCheckout(
  accessToken: string
): Promise<PremiumCheckoutResult> {
  return callEdge<PremiumCheckoutResult>('create-premium-checkout', accessToken);
}

function currentCreditPeriodStart(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export async function fetchPremiumBoostCredits(
  accessToken: string,
  userId: string
): Promise<PremiumBoostCredits | null> {
  const period = currentCreditPeriodStart();
  const rows = await supabaseRestGet<PremiumBoostCredits>(
    `premium_boost_credits?user_id=eq.${userId}&period_start=eq.${period}&select=period_start,credits_total,credits_used`,
    accessToken,
    12000
  );
  return rows[0] ?? null;
}

export function premiumCreditsRemaining(credits: PremiumBoostCredits | null | undefined): number {
  if (!credits) return 0;
  return Math.max(0, credits.credits_total - credits.credits_used);
}

export function isPremiumActive(
  isPremium: boolean,
  premiumUntil: string | null | undefined
): boolean {
  if (!isPremium) return false;
  if (!premiumUntil) return true;
  return new Date(premiumUntil).getTime() > Date.now();
}
