import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { validateAvatarImageBytes } from '../_shared/avatar-image.ts';

const BUCKET = 'avatars';

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const auth = await requireUser(req);
  if ('response' in auth) {
    return withCors(auth.response);
  }

  try {
    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return withCors(errorResponse('file is required', 400, 'BAD_REQUEST'));
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { contentType, width, height } = validateAvatarImageBytes(bytes);

    const admin = createSupabaseAdmin();
    const path = `${auth.user.id}/avatar.jpg`;

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    });

    if (uploadError) {
      return withCors(errorResponse(uploadError.message, 500, 'UPLOAD_FAILED'));
    }

    const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = `${publicData.publicUrl}?t=${Date.now()}`;

    const { error: profileError } = await admin
      .from('profiles')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.user.id);

    if (profileError) {
      return withCors(errorResponse(profileError.message, 500, 'PROFILE_UPDATE_FAILED'));
    }

    return withCors(
      okResponse({
        avatar_url: publicUrl,
        width: width ?? null,
        height: height ?? null,
        byte_size: bytes.byteLength,
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    return withCors(errorResponse(message, 400, 'UPLOAD_FAILED'));
  }
});
