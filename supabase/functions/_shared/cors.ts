let boundRequest: Request | undefined;

/** Call at the start of each edge handler so CORS reflects the request Origin. */
export function bindCorsRequest(req: Request): void {
  boundRequest = req;
}

function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get('CORS_ALLOWED_ORIGINS');
  const defaults = [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:3456',
    'http://127.0.0.1:3456',
  ];
  if (!raw?.trim()) return defaults;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getCorsHeaders(req?: Request): Record<string, string> {
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  const origin = (req ?? boundRequest)?.headers.get('Origin');
  const allowed = parseAllowedOrigins();

  if (!origin) {
    return { ...base, 'Access-Control-Allow-Origin': '*' };
  }

  if (allowed.includes(origin)) {
    return { ...base, 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' };
  }

  return base;
}

/**
 * Origin-aware CORS headers for OPTIONS handlers.
 *
 * Handlers call `bindCorsRequest(req)` immediately before reading this, so the
 * values are resolved against the actual request Origin (allowlist) at the
 * moment the Response is constructed — NOT a static wildcard captured at module
 * load. Implemented as a Proxy so existing `new Response('ok', { headers: corsHeaders })`
 * call sites stay unchanged while still honoring the allowlist.
 */
export const corsHeaders: Record<string, string> = new Proxy(
  {},
  {
    get(_t, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      return getCorsHeaders()[prop];
    },
    has(_t, prop: string | symbol) {
      return typeof prop === 'string' && prop in getCorsHeaders();
    },
    ownKeys() {
      return Reflect.ownKeys(getCorsHeaders());
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  }
) as Record<string, string>;

export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get('Origin');
  if (!origin) return true;
  return parseAllowedOrigins().includes(origin);
}

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  Object.entries(getCorsHeaders()).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function corsPreflightResponse(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  if (!isOriginAllowed(req)) {
    return new Response(null, { status: 403 });
  }
  bindCorsRequest(req);
  return new Response('ok', { headers: getCorsHeaders(req) });
}
