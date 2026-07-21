// Admin-editable email templates (Phase 4 of the white-label plan, see
// migration 112_email_templates_table.sql). Every send site renders a
// template by event_key with `{{placeholder}}` substitution, falling back to
// the hardcoded default subject/body if no row exists or a field is blank —
// so email delivery never breaks due to a misconfigured/missing template.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type EmailTemplateVars = Record<string, string | number | null | undefined>;

// Matches {{key}} tokens only — no arbitrary code execution, just literal
// text substitution, so a malicious/malformed template body can't do
// anything beyond rendering plain text.
const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function substitute(template: string, vars: EmailTemplateVars): string {
  return template.replace(TOKEN_RE, (_match, key: string) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

let cachedAppName: string | null = null;

async function getAppName(admin: SupabaseClient): Promise<string> {
  if (cachedAppName) return cachedAppName;
  try {
    const { data } = await admin
      .from('public_app_config')
      .select('value')
      .eq('key', 'app_display_name')
      .maybeSingle();
    const raw = data?.value;
    cachedAppName = typeof raw === 'string' ? raw : 'Local Marketplace';
  } catch {
    cachedAppName = 'Local Marketplace';
  }
  return cachedAppName;
}

export type EmailTemplateFallback = { subject: string; body: string };

/**
 * Fetch and render the admin-editable template for `eventKey`. On any
 * failure (missing row, blank fields, query error) falls back to the
 * hardcoded default so email delivery is never blocked by a config issue.
 */
export async function renderEmailTemplate(
  admin: SupabaseClient,
  eventKey: string,
  vars: EmailTemplateVars,
  fallback: EmailTemplateFallback
): Promise<{ subject: string; body: string }> {
  const appName = await getAppName(admin);
  const allVars: EmailTemplateVars = { app_name: appName, ...vars };

  try {
    const { data } = await admin
      .from('email_templates')
      .select('subject, body_text')
      .eq('event_key', eventKey)
      .maybeSingle();

    if (data?.subject?.trim() && data?.body_text?.trim()) {
      return {
        subject: substitute(data.subject, allVars),
        body: substitute(data.body_text, allVars),
      };
    }
  } catch (e) {
    console.error(`[email-templates] failed to load "${eventKey}", using fallback:`, e);
  }

  return {
    subject: substitute(fallback.subject, allVars),
    body: substitute(fallback.body, allVars),
  };
}
