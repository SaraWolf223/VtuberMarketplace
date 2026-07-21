import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { validateAvatarImageBytes } from '../_shared/avatar-image.ts';

const BUCKET = 'seller-portfolio';

Deno.serve(async (req) => {
  bindCorsRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return withCors(errorResponse('Method not allowed', 405, 'METHOD_NOT_ALLOWED'));
  }

  const auth = await requireUser(req);
  if ('response' in auth) return withCors(auth.response);

  try {
    const form = await req.formData();
    const file = form.get('file');
    const captionRaw = form.get('caption');
    const sortRaw = form.get('sort_order');
    const caption =
      typeof captionRaw === 'string' ? captionRaw.trim().slice(0, 200) : null;
    const sortOrder = Math.min(
      5,
      Math.max(0, Number.parseInt(typeof sortRaw === 'string' ? sortRaw : '0', 10) || 0)
    );

    if (!(file instanceof File)) {
      return withCors(errorResponse('file is required', 400, 'BAD_REQUEST'));
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { contentType } = validateAvatarImageBytes(bytes);

    const admin = createSupabaseAdmin();

    const { count } = await admin
      .from('seller_portfolio_items')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', auth.user.id)
      .eq('active', true);

    if ((count ?? 0) >= 6) {
      return withCors(errorResponse('Maximum 6 showcase images', 400, 'PORTFOLIO_MAX_ITEMS'));
    }

    const path = `${auth.user.id}/${sortOrder}-${Date.now()}.jpg`;
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    });

    if (uploadError) {
      return withCors(errorResponse(uploadError.message, 500, 'UPLOAD_FAILED'));
    }

    const { data: row, error: insertErr } = await admin
      .from('seller_portfolio_items')
      .upsert(
        {
          seller_id: auth.user.id,
          image_storage_path: path,
          caption,
          sort_order: sortOrder,
          active: true,
        },
        { onConflict: 'seller_id,sort_order' }
      )
      .select('*')
      .single();

    if (insertErr || !row) {
      return withCors(errorResponse(insertErr?.message ?? 'Insert failed', 500, 'DB'));
    }

    const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
    return withCors(
      okResponse({
        item: row,
        public_url: publicData.publicUrl,
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    return withCors(errorResponse(message, 400, 'UPLOAD_FAILED'));
  }
});
