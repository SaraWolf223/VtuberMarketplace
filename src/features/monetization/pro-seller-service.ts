import { getSupabaseEnv } from '@/lib/supabase-rest';
import { isPremiumActive } from '@/features/monetization/premium-service';

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
};

export type ProSellerCheckoutResult = {
  checkout_url: string;
  session_id: string;
};

export type SyncProSellerResult = {
  pro_seller_active: boolean;
  pro_seller_until: string | null;
  /** @deprecated legacy Premium sync shape */
  premium_active?: boolean;
  premium_until?: string | null;
};

async function callEdge<T>(fn: string, accessToken: string, body: unknown = {}): Promise<T> {
  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timeoutMs = fn.includes('checkout') ? 30_000 : 45_000;
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
        `Pro Seller checkout is not deployed yet. Run: npx supabase functions deploy ${fn}`
      );
    }
    throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection.');
    }
    throw e;
  }
}

export function isProSellerActive(
  isProSeller: boolean | null | undefined,
  proSellerUntil: string | null | undefined
): boolean {
  if (!isProSeller) return false;
  if (!proSellerUntil) return true;
  return new Date(proSellerUntil).getTime() > Date.now();
}

/** Accept legacy Premium flags until webhook migration completes. */
export function isProSellerOrLegacyPremium(profile: {
  is_pro_seller?: boolean | null;
  pro_seller_until?: string | null;
  is_premium?: boolean | null;
  premium_until?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  return (
    isProSellerActive(!!profile.is_pro_seller, profile.pro_seller_until) ||
    isPremiumActive(!!profile.is_premium, profile.premium_until)
  );
}

export async function createProSellerCheckout(
  accessToken: string
): Promise<ProSellerCheckoutResult> {
  return callEdge<ProSellerCheckoutResult>('create-pro-seller-checkout', accessToken);
}

export async function syncProSellerAccount(
  accessToken: string,
  sessionId?: string
): Promise<SyncProSellerResult> {
  try {
    return await callEdge<SyncProSellerResult>(
      'sync-pro-seller',
      accessToken,
      sessionId ? { session_id: sessionId } : {}
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message.includes('not deployed') || message.includes('404')) {
      const legacy = await callEdge<SyncProSellerResult>(
        'sync-premium',
        accessToken,
        sessionId ? { session_id: sessionId } : {}
      );
      return {
        pro_seller_active: !!legacy.premium_active,
        pro_seller_until: legacy.premium_until ?? null,
        premium_active: legacy.premium_active,
        premium_until: legacy.premium_until,
      };
    }
    throw e;
  }
}

export async function openProSellerBillingPortal(accessToken: string): Promise<string> {
  try {
    const data = await callEdge<{ url: string }>('create-pro-seller-portal', accessToken);
    if (!data.url) throw new Error('Could not open billing portal');
    return data.url;
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    if (message.includes('not deployed') || message.includes('404')) {
      const data = await callEdge<{ url: string }>('create-premium-portal', accessToken);
      if (!data.url) throw new Error('Could not open billing portal');
      return data.url;
    }
    throw e;
  }
}
