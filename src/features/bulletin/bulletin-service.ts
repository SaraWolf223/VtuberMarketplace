import { supabase } from '@/lib/supabase';

// Migrations 138+ are not yet in generated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type BulletinPost = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type BulletinComment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_username?: string;
  author_display_name?: string;
  author_avatar_url?: string | null;
};

export async function getCurrentBulletin(userId: string): Promise<{
  post: BulletinPost | null;
  comment_count: number;
}> {
  const { data, error } = await db.rpc('get_current_bulletin', { p_user_id: userId });
  if (error) throw error;
  const row = data as { post: BulletinPost | null; comment_count: number };
  return { post: row?.post ?? null, comment_count: row?.comment_count ?? 0 };
}

export async function setBulletinPost(body: string): Promise<{ post_id?: string; error?: string }> {
  const { data, error } = await db.rpc('set_bulletin_post', { p_body: body });
  if (error) throw error;
  return data as { post_id?: string; error?: string; ok?: boolean };
}

export async function listBulletinComments(postId: string): Promise<BulletinComment[]> {
  const { data, error } = await db.rpc('list_bulletin_comments', {
    p_post_id: postId,
    p_limit: 50,
    p_offset: 0,
  });
  if (error) throw error;
  const row = data as { items?: BulletinComment[]; error?: string };
  if (row?.error) throw new Error(row.error);
  return row?.items ?? [];
}

export async function addBulletinComment(
  postId: string,
  body: string
): Promise<{ comment_id?: string; error?: string }> {
  const { data, error } = await db.rpc('add_bulletin_comment', {
    p_post_id: postId,
    p_body: body,
  });
  if (error) throw error;
  return data as { comment_id?: string; error?: string; ok?: boolean };
}

export async function staffHideBulletinPost(postId: string): Promise<void> {
  const { data, error } = await db.rpc('staff_hide_bulletin_post', {
    p_post_id: postId,
  });
  if (error) throw error;
  const row = data as { ok?: boolean; error?: string };
  if (!row?.ok) throw new Error(row?.error ?? 'Hide failed');
}

export async function staffHideBulletinComment(commentId: string): Promise<void> {
  const { data, error } = await db.rpc('staff_hide_bulletin_comment', {
    p_comment_id: commentId,
  });
  if (error) throw error;
  const row = data as { ok?: boolean; error?: string };
  if (!row?.ok) throw new Error(row?.error ?? 'Hide failed');
}

export async function listRecentBulletinPostsForStaff(limit = 50): Promise<
  Array<BulletinPost & { author_username?: string; author_display_name?: string; hidden_at?: string | null }>
> {
  const { data, error } = await db
    .from('profile_bulletin_posts')
    .select(
      'id, author_id, body, created_at, is_current, hidden_at, profiles!profile_bulletin_posts_author_id_fkey(username, display_name)'
    )
    .eq('is_current', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const p = row.profiles as { username?: string; display_name?: string } | null;
    return {
      id: row.id as string,
      author_id: row.author_id as string,
      body: row.body as string,
      created_at: row.created_at as string,
      author_username: p?.username,
      author_display_name: p?.display_name,
      hidden_at: (row.hidden_at as string | null) ?? null,
    };
  });
}
