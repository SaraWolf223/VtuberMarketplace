import { createClient, type User } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { errorResponse } from './errors.ts';

export type AuthResult =
  | { user: User; authorization: string }
  | { response: Response };

export async function requireUser(req: Request): Promise<AuthResult> {
  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return { response: errorResponse('Unauthorized', 401, 'UNAUTHORIZED') };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return { response: errorResponse('Server misconfigured', 500, 'CONFIG') };
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { response: errorResponse('Unauthorized', 401, 'UNAUTHORIZED') };
  }

  return { user, authorization };
}
