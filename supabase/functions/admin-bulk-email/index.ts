import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { normalizeRecipientList, sendBulkEmails } from '../_shared/bulk-email.ts';

type Audience = 'waitlist' | 'users' | 'ios_waitlist';

const MAX_RECIPIENTS = 5000;

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

  let body: {
    audience?: Audience;
    subject?: string;
    body?: string;
    confirm?: boolean;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const audience = body.audience;
  const subject = body.subject?.trim() ?? '';
  const text = body.body?.trim() ?? '';

  if (audience !== 'waitlist' && audience !== 'users' && audience !== 'ios_waitlist') {
    return withCors(
      errorResponse('audience must be waitlist, users, or ios_waitlist', 400, 'BAD_REQUEST')
    );
  }
  if (subject.length < 1 || subject.length > 200) {
    return withCors(errorResponse('subject must be 1–200 characters', 400, 'BAD_REQUEST'));
  }
  if (text.length < 1 || text.length > 50000) {
    return withCors(errorResponse('body must be 1–50000 characters', 400, 'BAD_REQUEST'));
  }
  const admin = createSupabaseAdmin();
  let emails: string[] = [];

  if (audience === 'waitlist') {
    const { data, error } = await admin.from('waitlist_signups').select('email');
    if (error) {
      return withCors(errorResponse('Could not load waitlist', 500, 'LOAD_FAILED'));
    }
    emails = normalizeRecipientList((data ?? []).map((row) => String(row.email)));
  } else if (audience === 'ios_waitlist') {
    const { data, error } = await admin.from('ios_waitlist_signups').select('email');
    if (error) {
      return withCors(errorResponse('Could not load iPhone waitlist', 500, 'LOAD_FAILED'));
    }
    emails = normalizeRecipientList((data ?? []).map((row) => String(row.email)));
  } else {
    const { data, error } = await admin
      .from('profiles')
      .select('email')
      .not('email', 'is', null)
      .is('banned_at', null);
    if (error) {
      return withCors(errorResponse('Could not load user emails', 500, 'LOAD_FAILED'));
    }
    emails = normalizeRecipientList((data ?? []).map((row) => String(row.email)));
  }

  if (emails.length === 0) {
    return withCors(errorResponse('No recipients found for this audience', 400, 'NO_RECIPIENTS'));
  }
  if (emails.length > MAX_RECIPIENTS) {
    return withCors(
      errorResponse(`Too many recipients (${emails.length}). Max ${MAX_RECIPIENTS}.`, 400, 'TOO_MANY')
    );
  }

  if (body.confirm !== true) {
    return withCors(
      okResponse({
        preview: true,
        audience,
        subject,
        recipient_count: emails.length,
      })
    );
  }

  try {
    const result = await sendBulkEmails(emails, subject, text);

    await admin.from('email_campaigns').insert({
      admin_id: auth.user.id,
      audience,
      subject,
      body_text: text,
      recipient_count: result.recipient_count,
      sent_count: result.sent_count,
      failed_count: result.failed_count,
    });

    await admin.from('moderation_actions').insert({
      admin_id: auth.user.id,
      action:
        audience === 'waitlist'
          ? 'bulk_email_waitlist'
          : audience === 'ios_waitlist'
            ? 'bulk_email_ios_waitlist'
            : 'bulk_email_users',
      notes: `${result.sent_count}/${result.recipient_count} sent · "${subject.slice(0, 80)}"`,
    });

    return withCors(
      okResponse({
        audience,
        subject,
        recipient_count: result.recipient_count,
        sent_count: result.sent_count,
        failed_count: result.failed_count,
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Bulk email failed';
    return withCors(errorResponse(message, 500, 'SEND_FAILED'));
  }
});
