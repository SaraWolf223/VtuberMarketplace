import { supabase } from '@/lib/supabase';

// Migrations 137+ are not yet in generated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type SocialLinks = {
  twitter?: string;
  youtube?: string;
  twitch?: string;
  discord?: string;
  booth?: string;
  other?: string;
};

export type PortfolioItem = {
  id: string;
  seller_id: string;
  image_storage_path: string;
  caption: string | null;
  sort_order: number;
  active: boolean;
};

export async function updateSellerProfileLinks(input: {
  website_url?: string | null;
  portfolio_url?: string | null;
  social_links?: SocialLinks;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await db
    .from('profiles')
    .update({
      website_url: input.website_url || null,
      portfolio_url: input.portfolio_url || null,
      social_links: input.social_links ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) throw error;
}

export async function fetchSellerPortfolioItems(sellerId: string): Promise<PortfolioItem[]> {
  const { data, error } = await db
    .from('seller_portfolio_items')
    .select('*')
    .eq('seller_id', sellerId)
    .eq('active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PortfolioItem[];
}

export function portfolioPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from('seller-portfolio').getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function uploadPortfolioImage(
  fileUri: string,
  sortOrder: number,
  caption?: string
): Promise<PortfolioItem> {
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: 'portfolio.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('sort_order', String(sortOrder));
  if (caption) form.append('caption', caption);

  const { data, error } = await supabase.functions.invoke('upload-portfolio-image', {
    body: form,
  });
  if (error) throw error;
  const payload = data as { ok?: boolean; data?: { item: PortfolioItem }; error?: { message?: string } };
  if (!payload?.ok || !payload.data?.item) {
    throw new Error(payload?.error?.message ?? 'Upload failed');
  }
  return payload.data.item;
}
