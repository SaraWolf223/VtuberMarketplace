import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

function isHttpsUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

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

  let body: { order_id?: string; deliverable_url?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return withCors(errorResponse('Invalid JSON', 400, 'INVALID_JSON'));
  }

  if (!body.order_id || !body.deliverable_url?.trim()) {
    return withCors(errorResponse('order_id and deliverable_url required', 400, 'VALIDATION'));
  }

  const deliverableUrl = body.deliverable_url.trim();
  if (!isHttpsUrl(deliverableUrl)) {
    return withCors(errorResponse('Deliverable URL must be http(s)://', 400, 'INVALID_URL'));
  }

  try {
    const admin = createSupabaseAdmin();

    const { data: order } = await admin
      .from('orders')
      .select('id, seller_id, buyer_id, listing_id, status')
      .eq('id', body.order_id)
      .maybeSingle();

    if (!order) {
      return withCors(errorResponse('Order not found', 404, 'NOT_FOUND'));
    }

    if (order.seller_id !== auth.user.id) {
      return withCors(errorResponse('Not your order', 403, 'NOT_OWNER'));
    }

    if (order.status !== 'awaiting_fulfillment') {
      return withCors(
        errorResponse('Order is not awaiting fulfillment', 400, 'ORDER_NOT_FULFILLABLE')
      );
    }

    const note = body.note?.trim() || null;
    const now = new Date().toISOString();

    await admin.from('order_deliverables').upsert(
      {
        order_id: order.id,
        deliverable_url: deliverableUrl,
        note,
        delivered_by: auth.user.id,
        delivered_at: now,
      },
      { onConflict: 'order_id' }
    );

    await admin
      .from('orders')
      .update({ status: 'fulfilled', fulfilled_at: now, updated_at: now })
      .eq('id', order.id);

    await admin.from('notifications').insert({
      user_id: order.buyer_id,
      kind: 'order_fulfilled',
      title: 'Your order is ready',
      body: 'The seller submitted your customized deliverable. Open your Library to download.',
      listing_id: order.listing_id,
    });

    return withCors(okResponse({ order_id: order.id }));
  } catch (e) {
    console.error('submit-order-deliverable', e);
    return withCors(errorResponse('Server error', 500, 'SERVER'));
  }
});
