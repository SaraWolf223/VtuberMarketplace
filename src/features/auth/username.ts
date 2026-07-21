import { supabase } from '@/lib/supabase';

export function normalizeUsernameBase(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);

  if (base.length >= 3) return base;
  return `user_${base}`.slice(0, 24) || 'user';
}

export async function generateUniqueUsername(
  displayName: string,
  userId: string
): Promise<string> {
  let base = normalizeUsernameBase(displayName);
  if (base.length < 3) {
    base = `user_${userId.replace(/-/g, '').slice(0, 8)}`;
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base.slice(0, 20)}_${attempt + 1}`;
    // `profiles` RLS only allows selecting your own row, so this must check
    // `profiles_public` (readable by everyone) — otherwise every candidate
    // looks free even when it's already taken by another user.
    const { data } = await supabase
      .from('profiles_public')
      .select('id')
      .ilike('username', candidate)
      .maybeSingle();

    if (!data) return candidate;
  }

  return `user_${userId.replace(/-/g, '').slice(0, 12)}`;
}
