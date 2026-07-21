import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type RateLimitResult =
  | { ok: true }
  | { ok: false; message: string; retryAfterSeconds?: number };

/** Sliding-window rate limit backed by rate_limit_events table. */
export async function checkRateLimit(
  admin: SupabaseClient,
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - windowMs).toISOString();

  const { count, error } = await admin
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('bucket_key', key)
    .gte('created_at', since);

  if (error) {
    // Fail CLOSED: if we cannot read the rate-limit window we must not let the
    // request through unbounded. Reject and let the client retry.
    console.error('rate_limit count', error.message);
    return {
      ok: false,
      message: 'Service is busy. Please try again in a moment.',
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if ((count ?? 0) >= max) {
    return {
      ok: false,
      message: 'Too many requests. Please wait and try again.',
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  const { error: insertError } = await admin.from('rate_limit_events').insert({
    bucket_key: key,
  });

  if (insertError) {
    console.error('rate_limit insert', insertError.message);
  }

  return { ok: true };
}

export function rateLimitResponse(result: Extract<RateLimitResult, { ok: false }>) {
  return {
    status: 429,
    code: 'RATE_LIMIT' as const,
    message: result.message,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}
