import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripe } from '../_shared/stripe.ts';
import { hardDeleteListing } from '../_shared/hard-delete-listing.ts';
import { notifyStaff } from '../_shared/staff-notify.ts';
import { renderEmailTemplate } from '../_shared/email-templates.ts';

/** Permanently delete the signed-in account and associated data. */
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

  const userId = auth.user.id;

  try {
    const admin = createSupabaseAdmin();

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, display_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.stripe_customer_id) {
      try {
        const stripe = getStripe();
        const subs = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: 'all',
          limit: 20,
        });
        for (const sub of subs.data) {
          if (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due') {
            await stripe.subscriptions.cancel(sub.id);
          }
        }
      } catch (e) {
        console.warn('stripe cancel on delete', e);
      }
    }

    const { data: listings } = await admin
      .from('listings')
      .select('id')
      .eq('seller_id', userId);

    for (const row of listings ?? []) {
      try {
        await hardDeleteListing(admin, row.id);
      } catch (e) {
        console.warn('listing purge on account delete', row.id, e);
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return withCors(errorResponse(deleteError.message, 500, 'DELETE_FAILED'));
    }

    const rendered = await renderEmailTemplate(
      admin,
      'account_deleted_admin',
      {
        user_id: userId,
        name: profile?.display_name ?? '—',
        email: profile?.email ?? '—',
        listings_removed: listings?.length ?? 0,
        at: new Date().toISOString(),
      },
      {
        subject: 'Account deleted',
        body:
          `A user permanently deleted their account.\n\n` +
          `User ID: {{user_id}}\n` +
          `Name: {{name}}\n` +
          `Email: {{email}}\n` +
          `Listings removed: {{listings_removed}}\n` +
          `At: {{at}}`,
      }
    );

    await notifyStaff({
      event: 'account_deleted',
      subject: rendered.subject,
      adminBody: rendered.body,
    });

    return withCors(okResponse({ deleted: true, user_id: userId }));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Account deletion failed';
    return withCors(errorResponse(message, 500, 'DELETE_FAILED'));
  }
});
