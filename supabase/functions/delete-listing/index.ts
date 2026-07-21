import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { hardDeleteListing } from '../_shared/hard-delete-listing.ts';

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

  let body: { listing_id?: string };
  try {
    body = (await req.json()) as { listing_id?: string };
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const listingId = body.listing_id;
  if (!listingId) {
    return withCors(errorResponse('listing_id is required', 400, 'BAD_REQUEST'));
  }

  try {
    const admin = createSupabaseAdmin();

    const { data: listing, error: fetchError } = await admin
      .from('listings')
      .select('id, seller_id')
      .eq('id', listingId)
      .single();

    if (fetchError || !listing) {
      return withCors(errorResponse('Listing not found', 404, 'NOT_FOUND'));
    }

    if (listing.seller_id !== auth.user.id) {
      return withCors(errorResponse('Not your listing', 403, 'FORBIDDEN'));
    }

    await hardDeleteListing(admin, listingId);

    return withCors(okResponse({ listing_id: listingId, deleted: true }));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Delete failed';
    return withCors(errorResponse(message, 500, 'DELETE_FAILED'));
  }
});
