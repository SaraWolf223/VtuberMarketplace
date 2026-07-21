import { getCorsHeaders } from './cors.ts';

export type ApiErrorBody = {
  error: string;
  code?: string;
  details?: unknown;
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400, code?: string): Response {
  const payload: ApiErrorBody = { error: message, code };
  return jsonResponse({ ok: false, data: null, error: { code: code ?? 'ERROR', message } }, status);
}

export function okResponse<T>(data: T, status = 200): Response {
  return jsonResponse({ ok: true, data, error: null }, status);
}
