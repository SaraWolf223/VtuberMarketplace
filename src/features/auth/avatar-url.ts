import { getSupabaseEnv } from '@/lib/supabase-rest';

const SUPABASE_HOST_SUFFIX = '.supabase.co';

/** Allow Google avatars and this project's Supabase storage URLs only. */
export function isAllowedAvatarUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:') return false;
    if (u.hostname.endsWith('googleusercontent.com')) return true;
    const { url: supabaseUrl } = getSupabaseEnv();
    if (supabaseUrl.includes(SUPABASE_HOST_SUFFIX)) {
      const projectHost = new URL(supabaseUrl).hostname;
      if (u.hostname === projectHost && u.pathname.includes('/storage/v1/object/public/')) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function enhanceGoogleAvatarUrl(url: string | null | undefined): string | null {
  if (!isAllowedAvatarUrl(url)) return null;
  if (url!.includes('googleusercontent.com') && !url!.includes('=')) {
    return `${url}=s400`;
  }
  return url!;
}
