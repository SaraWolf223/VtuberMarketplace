import { getSupabaseEnv } from '@/lib/supabase-rest';

export type SetupCheckStatus = 'ok' | 'warning' | 'missing';

export type SetupCheckItem = {
  key: string;
  label: string;
  status: SetupCheckStatus;
  note: string;
  docHint: string;
};

export type SetupCheckSection = {
  title: string;
  items: SetupCheckItem[];
};

const GOOGLE_TEST_AD_ID_MARKER = '3940256099942544';

function clientVarStatus(
  value: string | undefined,
  placeholderMarkers: string[]
): { status: SetupCheckStatus; note: string } {
  const v = value?.trim() ?? '';
  if (!v) return { status: 'missing', note: 'Not set in .env' };
  if (placeholderMarkers.some((marker) => v.includes(marker))) {
    return { status: 'warning', note: 'Still a placeholder value' };
  }
  return { status: 'ok', note: 'Configured' };
}

function clientChecks(): SetupCheckItem[] {
  const supabaseUrl = clientVarStatus(process.env.EXPO_PUBLIC_SUPABASE_URL, ['your-project']);
  const supabaseAnon = clientVarStatus(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, ['your-anon-key']);
  const mapbox = clientVarStatus(process.env.EXPO_PUBLIC_MAPBOX_TOKEN, ['your-mapbox']);
  const stripePub = clientVarStatus(process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY, []);
  const googleClient = clientVarStatus(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, ['your-google-web-client-id']);
  const admobIos = clientVarStatus(process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID, [GOOGLE_TEST_AD_ID_MARKER]);
  const admobAndroid = clientVarStatus(process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID, [GOOGLE_TEST_AD_ID_MARKER]);
  const turnstileSiteKey = clientVarStatus(process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY, []);

  return [
    {
      key: 'EXPO_PUBLIC_SUPABASE_URL',
      label: 'Supabase project URL',
      ...supabaseUrl,
      docHint: 'docs/00-Developer_Setup.md — §3 Supabase project',
    },
    {
      key: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      label: 'Supabase anon key',
      ...supabaseAnon,
      docHint: 'docs/00-Developer_Setup.md — §3 Supabase project',
    },
    {
      key: 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
      label: 'Google Sign-In web client ID',
      ...googleClient,
      docHint: 'docs/00-Developer_Setup.md — §4 Google Cloud (OAuth)',
    },
    {
      key: 'EXPO_PUBLIC_MAPBOX_TOKEN',
      label: 'Mapbox public token',
      ...mapbox,
      docHint: 'docs/00-Developer_Setup.md — §5 Mapbox',
    },
    {
      key: 'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
      label: 'Stripe publishable key',
      ...stripePub,
      docHint: 'docs/00-Developer_Setup.md — §6 Stripe',
    },
    {
      key: 'EXPO_PUBLIC_ADMOB_IOS_BANNER_ID',
      label: 'AdMob iOS banner unit',
      ...admobIos,
      docHint: 'docs/00-Developer_Setup.md — §7 Google AdMob',
    },
    {
      key: 'EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID',
      label: 'AdMob Android banner unit',
      ...admobAndroid,
      docHint: 'docs/00-Developer_Setup.md — §7 Google AdMob',
    },
    {
      key: 'EXPO_PUBLIC_TURNSTILE_SITE_KEY',
      label: 'Turnstile site key (optional bot protection, web sign-up)',
      ...(turnstileSiteKey.status === 'missing'
        ? { status: 'ok' as const, note: 'Optional — not set, bot check is skipped' }
        : turnstileSiteKey),
      docHint: 'docs/00-Developer_Setup.md — §9c Bot protection (Turnstile)',
    },
  ];
}

type EdgeCheckResult = {
  key: string;
  configured: boolean;
  looksValid: boolean | null;
  note: string;
};

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
};

const SERVER_CHECK_LABELS: Record<string, string> = {
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase service role key',
  STRIPE_SECRET_KEY: 'Stripe secret key',
  STRIPE_WEBHOOK_SECRET: 'Stripe webhook signing secret',
  STRIPE_PRICE_PREMIUM: 'Stripe Premium price ID',
  MAPBOX_ACCESS_TOKEN: 'Mapbox server-side token',
  RESEND_API_KEY: 'Resend API key',
  SUPPORT_EMAIL: 'Support email',
  CRON_SECRET: 'Cron secret (scheduled purge jobs)',
  COLLEGE_OTP_SECRET: '.edu verification OTP secret',
  CORS_ALLOWED_ORIGINS: 'CORS allowed origins',
  TURNSTILE_SECRET_KEY: 'Turnstile secret key (optional bot protection)',
};

/** Keys that are genuinely optional — "not set" should never count as a missing/red item. */
const OPTIONAL_SERVER_KEYS = new Set(['TURNSTILE_SECRET_KEY']);

async function fetchServerChecks(accessToken: string): Promise<SetupCheckItem[]> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url}/functions/v1/get-setup-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });

  const raw = await res.text();
  let json: EdgeEnvelope<{ checks: EdgeCheckResult[] }>;
  try {
    json = JSON.parse(raw) as EdgeEnvelope<{ checks: EdgeCheckResult[] }>;
  } catch {
    throw new Error(
      res.status === 404
        ? 'Function "get-setup-status" is not deployed. Run: npx supabase functions deploy get-setup-status'
        : `Request failed (${res.status}).`
    );
  }
  if (!json.ok || !json.data) {
    throw new Error(json.error?.message ?? 'Could not load server-side setup status');
  }

  return json.data.checks.map((c) => {
    const optional = OPTIONAL_SERVER_KEYS.has(c.key);
    const status: SetupCheckStatus =
      !c.configured ? (optional ? 'ok' : 'missing') : c.looksValid === false ? 'warning' : 'ok';
    const note = !c.configured
      ? optional
        ? 'Optional — not set, skipped'
        : 'Not set as an edge function secret'
      : c.looksValid === false
        ? "Set, but doesn't match the expected format — double-check the value"
        : c.note;
    return {
      key: c.key,
      label: SERVER_CHECK_LABELS[c.key] ?? c.key,
      status,
      note,
      docHint: 'docs/00-Developer_Setup.md',
    };
  });
}

export async function fetchSetupStatus(accessToken: string): Promise<SetupCheckSection[]> {
  const server = await fetchServerChecks(accessToken);
  const serverByKey = new Map(server.map((c) => [c.key, c]));

  return [
    { title: 'Client (app + web bundle)', items: clientChecks() },
    {
      title: 'Server (Supabase Edge Function secrets)',
      items: [
        'SUPABASE_SERVICE_ROLE_KEY',
        'MAPBOX_ACCESS_TOKEN',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'STRIPE_PRICE_PREMIUM',
        'RESEND_API_KEY',
        'SUPPORT_EMAIL',
      ]
        .map((k) => serverByKey.get(k))
        .filter((c): c is SetupCheckItem => !!c),
    },
    {
      title: 'Production hardening',
      items: [
        'CRON_SECRET',
        'COLLEGE_OTP_SECRET',
        'CORS_ALLOWED_ORIGINS',
        'TURNSTILE_SECRET_KEY',
      ]
        .map((k) => serverByKey.get(k))
        .filter((c): c is SetupCheckItem => !!c),
    },
  ];
}
