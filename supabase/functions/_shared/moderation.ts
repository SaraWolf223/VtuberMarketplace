import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export async function containsBannedKeyword(
  admin: SupabaseClient,
  text: string
): Promise<string | null> {
  const normalized = text.toLowerCase();
  const { data: keywords, error } = await admin
    .from('banned_keywords')
    .select('keyword')
    .eq('active', true);

  if (error || !keywords?.length) return null;

  for (const row of keywords) {
    const kw = row.keyword?.toLowerCase().trim();
    if (kw && normalized.includes(kw)) {
      return row.keyword;
    }
  }

  return null;
}
