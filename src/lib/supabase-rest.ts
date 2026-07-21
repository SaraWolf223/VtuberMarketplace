export function getSupabaseEnv(): { url: string; key: string } {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key || url.includes('your-project')) {
    throw new Error('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env');
  }
  return { url, key };
}

function formatRpcError(body: string, status: number, fn?: string): string {
  const missingFunction =
    body.includes('PGRST202') ||
    body.includes('Could not find the function') ||
    body.includes('upsert_user_prefs_location');

  if (missingFunction) {
    if (fn === 'accept_platform_terms' || body.includes('accept_platform_terms')) {
      return (
        'Terms acceptance is not set up on the database yet.\n\n' +
        'Run: npx supabase db push\n\n' +
        'That applies migration 077 (accept_platform_terms). ' +
        'Or paste supabase/migrations/077_platform_terms_acceptance.sql into the Supabase SQL Editor.'
      );
    }

    return (
      'Database function missing. Run: npx supabase db push\n\n' +
      'Apply all pending migrations in supabase/migrations/. ' +
      'For a single fix, open the matching .sql file in the Supabase SQL Editor.'
    );
  }
  if (body.includes('Profile missing')) {
    return 'Profile missing. Run migration 017 (supabase db push), then try again.';
  }
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? body;
  } catch {
    return body || `Request failed (HTTP ${status})`;
  }
}

export async function supabaseRpc<T = void>(
  fn: string,
  body: Record<string, unknown>,
  accessToken: string,
  timeoutMs = 15000
): Promise<T> {
  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.ok) {
      const text = await res.text();
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    }

    const text = await res.text();
    throw new Error(formatRpcError(text, res.status, fn));
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Network timed out after ${timeoutMs / 1000}s. Check Wi‑Fi and Supabase.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function supabaseRestGet<T>(
  path: string,
  accessToken: string,
  timeoutMs = 10000
): Promise<T[]> {
  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(formatRpcError(text, res.status));
    }

    return (await res.json()) as T[];
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Network timed out after ${timeoutMs / 1000}s`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function supabaseRestPost<T>(
  table: string,
  body: Record<string, unknown> | Record<string, unknown>[],
  accessToken: string,
  timeoutMs = 15000,
  options?: { upsert?: boolean }
): Promise<T[]> {
  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const prefer = options?.upsert
    ? 'return=representation,resolution=merge-duplicates'
    : 'return=representation';

  try {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
        Prefer: prefer,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(formatRpcError(text, res.status));
    }

    const text = await res.text();
    if (!text) return [];
    return JSON.parse(text) as T[];
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Network timed out after ${timeoutMs / 1000}s`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function supabaseStorageUpload(
  bucket: string,
  path: string,
  fileUri: string,
  mimeType: string,
  accessToken: string,
  timeoutMs = 60000
): Promise<void> {
  const { url, key } = getSupabaseEnv();
  const uploadUri =
    fileUri.startsWith('file://') || fileUri.startsWith('content://') ? fileUri : `file://${fileUri}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fileRes = await fetch(uploadUri, { signal: controller.signal });
    if (!fileRes.ok) {
      throw new Error('Could not read banner image file');
    }
    const blob = await fileRes.blob();

    const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: blob,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(formatRpcError(text, res.status));
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Upload timed out after ${timeoutMs / 1000}s`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function supabaseRestPatch(
  path: string,
  body: Record<string, unknown>,
  accessToken: string,
  timeoutMs = 15000
): Promise<void> {
  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(formatRpcError(text, res.status));
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Network timed out after ${timeoutMs / 1000}s`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
