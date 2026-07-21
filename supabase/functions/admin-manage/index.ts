import { withCors, corsHeaders, bindCorsRequest } from '../_shared/cors.ts';
import { errorResponse, okResponse } from '../_shared/errors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  fetchPlatformSettings,
  upsertPlatformSettings,
  type PlatformSettingsMap,
} from '../_shared/platform-settings.ts';

type ManageAction = 'get_settings' | 'update_settings' | 'create_promo' | 'deactivate_promo';

const DEFAULT_SETTINGS: PlatformSettingsMap = {
  boost_duration_hours: 24,
  boost_base_cents: 100,
  reports_per_hour: 5,
  pause_reports_24h: 10,
  pause_reports_lifetime: 50,
};

function normalizeSettings(raw: PlatformSettingsMap): PlatformSettingsMap {
  return {
    boost_duration_hours: raw.boost_duration_hours ?? DEFAULT_SETTINGS.boost_duration_hours,
    boost_base_cents: raw.boost_base_cents ?? DEFAULT_SETTINGS.boost_base_cents,
    reports_per_hour: raw.reports_per_hour ?? DEFAULT_SETTINGS.reports_per_hour,
    pause_reports_24h: raw.pause_reports_24h ?? DEFAULT_SETTINGS.pause_reports_24h,
    pause_reports_lifetime: raw.pause_reports_lifetime ?? DEFAULT_SETTINGS.pause_reports_lifetime,
  };
}

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
    action?: ManageAction;
    settings?: Record<string, number>;
    code?: string;
    type?: 'free_boosts' | 'free_premium_month' | 'founding_seller';
    value?: number;
    max_redemptions?: number | null;
    expires_at?: string | null;
    promo_id?: string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withCors(errorResponse('Invalid JSON body', 400, 'BAD_REQUEST'));
  }

  const action = body.action;
  if (!action) {
    return withCors(errorResponse('action is required', 400, 'BAD_REQUEST'));
  }

  const admin = createSupabaseAdmin();

  if (action === 'get_settings') {
    const raw = await fetchPlatformSettings(admin);
    return withCors(okResponse({ settings: normalizeSettings(raw) }));
  }

  if (action === 'update_settings') {
    if (!body.settings || typeof body.settings !== 'object') {
      return withCors(errorResponse('settings object is required', 400, 'BAD_REQUEST'));
    }
    await upsertPlatformSettings(admin, body.settings);
    const raw = await fetchPlatformSettings(admin);
    return withCors(okResponse({ settings: normalizeSettings(raw) }));
  }

  if (action === 'create_promo') {
    const code = body.code?.trim().toUpperCase();
    const type = body.type;
    const value = body.value ?? 1;

    if (!code || !/^[A-Z0-9_-]{4,32}$/.test(code)) {
      return withCors(
        errorResponse('Code must be 4–32 chars: A-Z, 0-9, underscore, hyphen', 400, 'BAD_REQUEST')
      );
    }
    if (type !== 'free_boosts' && type !== 'free_premium_month' && type !== 'founding_seller') {
      return withCors(errorResponse('Invalid promo type', 400, 'BAD_REQUEST'));
    }
    if (!Number.isFinite(value) || value < 1) {
      return withCors(errorResponse('value must be at least 1', 400, 'BAD_REQUEST'));
    }
    if ((type === 'free_premium_month' || type === 'founding_seller') && value !== 1) {
      return withCors(
        errorResponse(`${type} value must be 1`, 400, 'BAD_REQUEST')
      );
    }

    const { data: promo, error } = await admin
      .from('promo_codes')
      .insert({
        code,
        type,
        value,
        max_redemptions: body.max_redemptions ?? null,
        expires_at: body.expires_at ?? null,
        created_by: auth.user.id,
      })
      .select('id,code,type,value,max_redemptions,redemption_count,expires_at,active,created_at')
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        return withCors(errorResponse('Promo code already exists', 409, 'DUPLICATE'));
      }
      return withCors(errorResponse(error.message, 500, 'INSERT_FAILED'));
    }

    return withCors(okResponse({ promo }));
  }

  if (action === 'deactivate_promo') {
    if (!body.promo_id) {
      return withCors(errorResponse('promo_id is required', 400, 'BAD_REQUEST'));
    }

    const { data: promo, error } = await admin
      .from('promo_codes')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', body.promo_id)
      .select('id')
      .maybeSingle();

    if (error || !promo) {
      return withCors(errorResponse('Promo code not found', 404, 'NOT_FOUND'));
    }

    return withCors(okResponse({ promo_id: promo.id, active: false }));
  }

  return withCors(errorResponse('Unknown action', 400, 'BAD_REQUEST'));
});
