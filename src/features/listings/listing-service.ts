import { getSupabaseEnv } from '@/lib/supabase-rest';
import { MAX_LISTING_PHOTO_BYTES } from '@/lib/listing-photo-security';
import type { ListingFormValues } from '@/features/listings/listing-schema';

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code?: string; message?: string } | null;
};

export type UploadSlot = {
  sort_order: number;
  storage_path: string;
  signed_url: string;
  token: string;
};

export type CreateListingResult = {
  listing_id: string;
  upload_urls: UploadSlot[];
};

export type FinalizeListingResult = {
  listing_id: string;
  status: string;
  image_count: number;
};

async function callEdge<T>(fn: string, accessToken: string, body: unknown): Promise<T> {
  const { url, key } = getSupabaseEnv();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(`${url}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const json = (await res.json()) as EdgeEnvelope<T>;

    if (json.ok && json.data) {
      return json.data;
    }

    const message = json.error?.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function createListingDraft(
  accessToken: string,
  values: ListingFormValues,
  imageCount: number
): Promise<CreateListingResult> {
  return callEdge<CreateListingResult>('create-listing', accessToken, {
    ...values,
    image_count: imageCount,
  });
}

export async function uploadListingImage(
  signedUrl: string,
  localUri: string,
  byteSize: number
): Promise<void> {
  if (byteSize <= 0 || byteSize > MAX_LISTING_PHOTO_BYTES) {
    throw new Error('Image must be under 2MB');
  }

  const fileRes = await fetch(localUri);
  const blob = await fileRes.blob();

  if (blob.size > MAX_LISTING_PHOTO_BYTES) {
    throw new Error('Image file exceeds 2MB limit');
  }
  if (blob.type && !blob.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded');
  }

  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(blob.size),
    },
    body: blob,
  });

  if (!res.ok) {
    throw new Error(`Image upload failed (${res.status})`);
  }
}

export type FinalizeImageInput = {
  sort_order: number;
  storage_path: string;
  byte_size: number;
  width: number;
  height: number;
};

export async function finalizeListingImages(
  accessToken: string,
  listingId: string,
  images: FinalizeImageInput[]
): Promise<FinalizeListingResult> {
  return callEdge<FinalizeListingResult>('finalize-listing-images', accessToken, {
    listing_id: listingId,
    images,
  });
}

export function listingImagePublicUrl(storagePath: string): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return `${base}/storage/v1/object/public/listing-images/${storagePath}`;
}

/** Upload dedicated feed thumbnail and attach via RPC (separate from gallery finalize). */
export async function uploadAndSetFeedThumbnail(
  accessToken: string,
  userId: string,
  listingId: string,
  localUri: string,
  byteSize: number
): Promise<string> {
  if (byteSize <= 0 || byteSize > MAX_LISTING_PHOTO_BYTES) {
    throw new Error('Feed thumbnail must be under 2MB');
  }

  const fileRes = await fetch(localUri);
  const blob = await fileRes.blob();
  if (blob.size > MAX_LISTING_PHOTO_BYTES) {
    throw new Error('Feed thumbnail exceeds 2MB limit');
  }

  const { url, key } = getSupabaseEnv();
  const storagePath = `${userId}/${listingId}/feed-thumb.jpg`;
  const uploadRes = await fetch(
    `${url}/storage/v1/object/listing-images/${storagePath}`,
    {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: blob,
    }
  );
  if (!uploadRes.ok) {
    throw new Error(`Feed thumbnail upload failed (${uploadRes.status})`);
  }

  const rpcRes = await fetch(`${url}/rest/v1/rpc/set_listing_feed_thumbnail`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_listing_id: listingId,
      p_storage_path: storagePath,
    }),
  });
  if (!rpcRes.ok) {
    throw new Error(`Could not set feed thumbnail (${rpcRes.status})`);
  }
  const json = (await rpcRes.json()) as { ok?: boolean; error?: string };
  if (json && typeof json === 'object' && 'error' in json && json.error) {
    throw new Error(String(json.error));
  }
  return storagePath;
}
