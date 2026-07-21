import { getSupabaseEnv } from '@/lib/supabase-rest';
import { compressAvatarImage, pickAvatarImageFromLibrary } from '@/lib/avatar-image';
import { appendUploadFile } from '@/lib/form-file';
import { AVATAR_MAX_HEIGHT, AVATAR_MAX_KB, AVATAR_MAX_WIDTH } from '@/constants/avatar';

const BUCKET = 'avatars';

type EdgeEnvelope<T> = {
  ok: boolean;
  data: T | null;
  error: { message?: string } | null;
};

type UploadAvatarResult = {
  avatar_url: string;
  width: number | null;
  height: number | null;
  byte_size: number;
};

export function avatarPublicUrl(storagePath: string): string {
  const { url } = getSupabaseEnv();
  return `${url}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function uploadAvatarViaEdge(
  accessToken: string,
  fileUri: string,
  mimeType: string
): Promise<string> {
  const { url, key } = getSupabaseEnv();
  const form = new FormData();
  await appendUploadFile(form, 'file', fileUri, 'avatar.jpg', mimeType);

  const res = await fetch(`${url}/functions/v1/upload-profile-avatar`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  const json = (await res.json()) as EdgeEnvelope<UploadAvatarResult>;
  if (!json.ok || !json.data?.avatar_url) {
    throw new Error(json.error?.message ?? 'Avatar upload failed');
  }

  return json.data.avatar_url;
}

export async function pickCropAndUploadAvatar(accessToken: string): Promise<string> {
  const pickedUri = await pickAvatarImageFromLibrary();
  if (!pickedUri) {
    throw new Error('CANCELLED');
  }

  const compressed = await compressAvatarImage(pickedUri);

  if (compressed.width > AVATAR_MAX_WIDTH || compressed.height > AVATAR_MAX_HEIGHT) {
    throw new Error(`Avatar must be at most ${AVATAR_MAX_WIDTH}×${AVATAR_MAX_HEIGHT}px.`);
  }

  return uploadAvatarViaEdge(accessToken, compressed.uri, 'image/jpeg');
}

export const AVATAR_LIMITS_LABEL = `Max ${AVATAR_MAX_WIDTH}×${AVATAR_MAX_HEIGHT}px, ${AVATAR_MAX_KB}KB`;
