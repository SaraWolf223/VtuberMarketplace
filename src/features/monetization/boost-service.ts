import { getSupabaseEnv } from '@/lib/supabase-rest';
import { isBoostActive } from '@/utils/boost-countdown';

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
};

export type BoostCheckoutPaid = {
  use_credit: false;
  payment_intent_id: string;
  payment_intent_client_secret: string;
  customer_id: string;
  ephemeral_key: string;
  /** Listing boost price ($1.00) */
  base_amount_cents: number;
  /** Stripe processing — paid by seller, not absorbed by platform */
  processing_fee_cents: number;
  /** Total charged on card */
  amount_cents: number;
};

export type BoostCheckoutCredit = {
  use_credit: true;
  credits_remaining: number;
  credits_total: number;
};

export type BoostCheckoutPromo = {
  use_promo: true;
  promo_boosts_remaining: number;
};

export type BoostCheckoutFounding = {
  use_founding: true;
  founding_credits_remaining: number;
  founding_credits_total: number;
};

export type BoostCheckoutResult =
  | BoostCheckoutPaid
  | BoostCheckoutCredit
  | BoostCheckoutFounding
  | BoostCheckoutPromo;

export function isBoostCheckoutCredit(
  result: BoostCheckoutResult
): result is BoostCheckoutCredit {
  return 'use_credit' in result && result.use_credit === true;
}

export function isBoostCheckoutPromo(result: BoostCheckoutResult): result is BoostCheckoutPromo {
  return 'use_promo' in result && result.use_promo === true;
}

export function isBoostCheckoutFounding(
  result: BoostCheckoutResult
): result is BoostCheckoutFounding {
  return 'use_founding' in result && result.use_founding === true;
}

export type ApplyBoostResult = {
  listing_id?: string;
  boosted_until: string;
};

async function callEdge<T>(fn: string, accessToken: string, body: unknown): Promise<T> {
  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

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

export async function createBoostCheckout(
  accessToken: string,
  listingId: string,
  options?: { forcePaid?: boolean }
): Promise<BoostCheckoutResult> {
  return callEdge<BoostCheckoutResult>('create-boost-checkout', accessToken, {
    listing_id: listingId,
    ...(options?.forcePaid ? { force_paid: true } : {}),
  });
}

export async function applyBoost(
  accessToken: string,
  listingId: string,
  paymentIntentId: string
): Promise<ApplyBoostResult> {
  return callEdge<ApplyBoostResult>('apply-boost', accessToken, {
    listing_id: listingId,
    payment_intent_id: paymentIntentId,
    source: 'paid',
  });
}

export async function applyBoostWithCredit(
  accessToken: string,
  listingId: string
): Promise<ApplyBoostResult> {
  return callEdge<ApplyBoostResult>('apply-boost', accessToken, {
    listing_id: listingId,
    source: 'premium_credit',
  });
}

export async function applyBoostWithPromo(
  accessToken: string,
  listingId: string
): Promise<ApplyBoostResult> {
  return callEdge<ApplyBoostResult>('apply-boost', accessToken, {
    listing_id: listingId,
    source: 'promo',
  });
}

export async function applyBoostWithFoundingCredit(
  accessToken: string,
  listingId: string
): Promise<ApplyBoostResult> {
  return callEdge<ApplyBoostResult>('apply-boost', accessToken, {
    listing_id: listingId,
    source: 'founding_credit',
  });
}

export function isListingBoosted(boostedUntil: string | null | undefined): boolean {
  return isBoostActive(boostedUntil);
}
