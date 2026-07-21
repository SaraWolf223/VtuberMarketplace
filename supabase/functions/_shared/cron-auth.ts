import { withCors } from './cors.ts';
import { errorResponse } from './errors.ts';
import { constantTimeEqual } from './ct-compare.ts';

/** Fail closed when CRON_SECRET is unset; require Bearer token when set. */
export function requireCronAuth(req: Request): Response | null {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    return withCors(errorResponse('Cron not configured', 503, 'CRON_NOT_CONFIGURED'));
  }

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  if (!constantTimeEqual(token, cronSecret)) {
    return withCors(errorResponse('Unauthorized', 401, 'UNAUTHORIZED'));
  }

  return null;
}
