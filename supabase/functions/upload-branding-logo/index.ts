import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { validateBrandingLogoBytes } from '../_shared/branding-image.ts';

const BUCKET = 'branding';
const CONFIG_KEY = 'branding_logo_url';

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const auth = await requireAdmin(req);
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
    const { contentType, width, height } = validateBrandingLogoBytes(bytes);

    const admin = createSupabaseAdmin();
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const path = `logo.${ext}`;

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    });

    if (uploadError) {
      return withCors(errorResponse(uploadError.message, 500, 'UPLOAD_FAILED'));
    }

    const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = `${publicData.publicUrl}?t=${Date.now()}`;

    const { error: configError } = await admin.from('public_app_config').upsert({
      key: CONFIG_KEY,
      value: publicUrl,
      updated_at: new Date().toISOString(),
    });

    if (configError) {
      return withCors(errorResponse(configError.message, 500, 'CONFIG_UPDATE_FAILED'));
    }

    return withCors(
      okResponse({
        branding_logo_url: publicUrl,
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
