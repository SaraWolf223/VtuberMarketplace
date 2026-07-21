import { getSupabaseEnv } from '@/lib/supabase-rest';
import { isBoostActive } from '@/utils/boost-countdown';

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
};

export type FeaturedCheckoutPaid = {
  use_credit: false;
  payment_intent_id: string;
  payment_intent_client_secret: string;
  customer_id: string;
  ephemeral_key: string;
  base_amount_cents: number;
  processing_fee_cents: number;
  amount_cents: number;
  duration_days?: number;
};

export type FeaturedCheckoutCredit = {
  use_credit: true;
  credits_remaining: number;
  credits_total: number;
  duration_days?: number;
};

export type FeaturedCheckoutResult = FeaturedCheckoutPaid | FeaturedCheckoutCredit;

export type ApplyFeaturedResult = {
  listing_id?: string;
  featured_until: string;
  duration_days?: number;
};

export function isFeaturedCheckoutCredit(
  result: FeaturedCheckoutResult
): result is FeaturedCheckoutCredit {
  return 'use_credit' in result && result.use_credit === true;
}

async function callEdge<T>(fn: string, accessToken: string, body: unknown): Promise<T> {
  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

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
        `Featured checkout is not deployed yet. Run: npx supabase functions deploy ${fn}`
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

export async function createFeaturedCheckout(
  accessToken: string,
  listingId: string,
  options?: { forcePaid?: boolean }
): Promise<FeaturedCheckoutResult> {
  return callEdge<FeaturedCheckoutResult>('create-featured-checkout', accessToken, {
    listing_id: listingId,
    ...(options?.forcePaid ? { force_paid: true } : {}),
  });
}

export async function applyFeaturedPlacement(
  accessToken: string,
  listingId: string,
  paymentIntentId?: string
): Promise<ApplyFeaturedResult> {
  return callEdge<ApplyFeaturedResult>('apply-featured-placement', accessToken, {
    listing_id: listingId,
    ...(paymentIntentId ? { payment_intent_id: paymentIntentId } : {}),
  });
}

export async function applyFeaturedWithCredit(
  accessToken: string,
  listingId: string
): Promise<ApplyFeaturedResult> {
  return callEdge<ApplyFeaturedResult>('apply-featured-placement', accessToken, {
    listing_id: listingId,
    source: 'pro_seller_credit',
  });
}

export function isListingFeatured(featuredUntil: string | null | undefined): boolean {
  return isBoostActive(featuredUntil);
}

/** @deprecated alias for listing cards still reading boosted_until */
export function isListingBoosted(boostedUntil: string | null | undefined): boolean {
  return isListingFeatured(boostedUntil);
}
