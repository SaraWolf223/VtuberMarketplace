import { supabase } from '@/lib/supabase';
import { openTrustedHttpsUrl } from '@/lib/open-external-url';

export async function startOrderCheckout(input: {
  listing_id: string;
  license_acknowledged: boolean;
  addon_ids?: string[];
  promo_code?: string | null;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke('create-order-checkout', {
    body: {
      listing_id: input.listing_id,
      license_acknowledged: input.license_acknowledged,
      addon_ids: input.addon_ids ?? [],
      promo_code: input.promo_code ?? null,
    },
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
  await openTrustedHttpsUrl(payload.data.checkout_url, 'order checkout');
}

export async function startConnectOnboarding(): Promise<void> {
  await supabase.functions.invoke('create-connect-account', { body: {} });
  const { data, error } = await supabase.functions.invoke('connect-onboarding-link', {
    body: {},
  });
  if (error) throw error;
  const payload = data as {
    ok?: boolean;
    data?: { url?: string };
    error?: { message?: string };
  };
  if (!payload?.ok || !payload.data?.url) {
    throw new Error(payload?.error?.message ?? 'Could not open Stripe Connect onboarding');
  }
  await openTrustedHttpsUrl(payload.data.url, 'Stripe Connect');
}
