import { supabase } from '@/lib/supabase';
import { openTrustedHttpsUrl } from '@/lib/open-external-url';

// Migrations 136+ are not yet in generated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type SupportPlan = {
  id: string;
  listing_id: string;
  active: boolean;
  price_cents_month: number;
  offerings_text: string;
};

export type SupportSubscription = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  current_period_end: string | null;
};

export type SupportSubscriptionRow = SupportSubscription & {
  listing_title?: string | null;
  price_cents_month?: number | null;
  buyer_display_name?: string | null;
};

export type SupportQuote = {
  id: string;
  subscription_id: string;
  title: string;
  description: string | null;
  amount_cents: number;
  status: string;
  expires_at: string | null;
};

export async function fetchSupportPlan(listingId: string): Promise<SupportPlan | null> {
  const { data, error } = await db
    .from('listing_support_plans')
    .select('*')
    .eq('listing_id', listingId)
    .maybeSingle();
  if (error) throw error;
  return data as SupportPlan | null;
}

export async function upsertSupportPlan(input: {
  listing_id: string;
  price_cents_month: number;
  offerings_text: string;
  active: boolean;
}): Promise<SupportPlan> {
  const { data, error } = await supabase.functions.invoke('upsert-listing-support-plan', {
    body: input,
  });
  if (error) throw error;
  const payload = data as { ok?: boolean; data?: { plan: SupportPlan }; error?: { message?: string } };
  if (!payload?.ok || !payload.data?.plan) {
    throw new Error(payload?.error?.message ?? 'Failed to save support plan');
  }
  return payload.data.plan;
}

export async function canSubscribe(listingId: string): Promise<{
  ok: boolean;
  error?: string;
  price_cents_month?: number;
  offerings_text?: string;
}> {
  const { data, error } = await db.rpc('can_subscribe_to_listing_support', {
    p_listing_id: listingId,
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    error?: string;
    price_cents_month?: number;
    offerings_text?: string;
  };
}

export async function startSupportSubscriptionCheckout(listingId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-support-subscription-checkout', {
    body: { listing_id: listingId },
  });
  if (error) throw error;
  const payload = data as {
    ok?: boolean;
    data?: { checkout_url?: string };
    error?: { message?: string };
  };
  if (!payload?.ok || !payload.data?.checkout_url) {
    throw new Error(payload?.error?.message ?? 'Checkout failed');
  }
  await openTrustedHttpsUrl(payload.data.checkout_url, 'support checkout');
}

export async function createSupportQuote(input: {
  subscription_id: string;
  title: string;
  description?: string;
  amount_cents: number;
}): Promise<string> {
  const { data, error } = await db.rpc('create_support_work_quote', {
    p_subscription_id: input.subscription_id,
    p_title: input.title,
    p_description: input.description ?? null,
    p_amount_cents: input.amount_cents,
  });
  if (error) throw error;
  const row = data as { ok?: boolean; quote_id?: string; error?: string };
  if (!row?.ok || !row.quote_id) throw new Error(row?.error ?? 'Quote failed');
  return row.quote_id;
}

export async function respondSupportQuote(quoteId: string, accept: boolean): Promise<string> {
  const { data, error } = await db.rpc('respond_support_work_quote', {
    p_quote_id: quoteId,
    p_accept: accept,
  });
  if (error) throw error;
  const row = data as { ok?: boolean; status?: string; error?: string };
  if (!row?.ok) throw new Error(row?.error ?? 'Response failed');
  return row.status ?? (accept ? 'accepted' : 'declined');
}

export async function startSupportQuoteCheckout(quoteId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-support-quote-checkout', {
    body: { quote_id: quoteId },
  });
  if (error) throw error;
  const payload = data as {
    ok?: boolean;
    data?: { checkout_url?: string };
    error?: { message?: string };
  };
  if (!payload?.ok || !payload.data?.checkout_url) {
    throw new Error(payload?.error?.message ?? 'Checkout failed');
  }
  await openTrustedHttpsUrl(payload.data.checkout_url, 'quote checkout');
}

export async function listMySupportSubscriptions(): Promise<SupportSubscriptionRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await db
    .from('listing_support_subscriptions')
    .select(
      '*, listings(title), listing_support_plans(price_cents_month)'
    )
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const listing = row.listings as { title?: string } | null;
    const plan = row.listing_support_plans as { price_cents_month?: number } | null;
    return {
      ...(row as SupportSubscription),
      listing_title: listing?.title ?? null,
      price_cents_month: plan?.price_cents_month ?? null,
    };
  });
}

export async function listSellerSupportSubscriptions(): Promise<SupportSubscriptionRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await db
    .from('listing_support_subscriptions')
    .select(
      '*, listings(title), listing_support_plans(price_cents_month), profiles!listing_support_subscriptions_buyer_id_fkey(display_name)'
    )
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const listing = row.listings as { title?: string } | null;
    const plan = row.listing_support_plans as { price_cents_month?: number } | null;
    const buyer = row.profiles as { display_name?: string } | null;
    return {
      ...(row as SupportSubscription),
      listing_title: listing?.title ?? null,
      price_cents_month: plan?.price_cents_month ?? null,
      buyer_display_name: buyer?.display_name ?? null,
    };
  });
}

export async function listQuotesForSubscription(subscriptionId: string): Promise<SupportQuote[]> {
  const { data, error } = await db
    .from('support_work_quotes')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupportQuote[];
}

export async function listMyPendingQuotes(): Promise<SupportQuote[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await db
    .from('support_work_quotes')
    .select('*')
    .eq('buyer_id', user.id)
    .in('status', ['pending_buyer', 'accepted'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupportQuote[];
}
