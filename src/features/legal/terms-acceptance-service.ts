import { getSupabaseEnv, supabaseRpc } from '@/lib/supabase-rest';
import { CURRENT_TERMS_VERSION } from '@/constants/legal';

type AcceptTermsResult = {
  ok?: boolean;
  terms_accepted_at?: string;
  terms_version?: string;
  error?: string;
};

export async function acceptPlatformTerms(accessToken: string): Promise<void> {
  const result = await supabaseRpc<AcceptTermsResult>(
    'accept_platform_terms',
    { p_version: CURRENT_TERMS_VERSION },
    accessToken
  );

  if (!result.ok) {
    throw new Error(result.error ?? 'Could not save terms acceptance');
  }
}

export async function fetchTermsAcceptanceStatus(
  accessToken: string,
  userId: string
): Promise<{ terms_accepted_at: string | null; terms_version: string | null }> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(
    `${url}/rest/v1/profiles?id=eq.${userId}&select=terms_accepted_at,terms_version`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error('Could not load terms status');
  }

  const rows = (await res.json()) as {
    terms_accepted_at: string | null;
    terms_version: string | null;
  }[];

  return rows[0] ?? { terms_accepted_at: null, terms_version: null };
}
