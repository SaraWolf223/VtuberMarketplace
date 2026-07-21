import { supabase } from '@/lib/supabase';
import { syncProfileFromAuthUser } from '@/features/auth/syncProfileFromAuthUser';

export async function ensureProfileForUser(userId: string): Promise<void> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (profile) return;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user || user.id !== userId) {
    throw new Error('Your profile was not created. Please sign out and sign in again.');
  }

  await syncProfileFromAuthUser(user);
}
