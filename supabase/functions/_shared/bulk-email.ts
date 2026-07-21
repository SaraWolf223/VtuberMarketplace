const BATCH_SIZE = 50;

export type BulkEmailResult = {
  recipient_count: number;
  sent_count: number;
  failed_count: number;
};

export async function sendBulkEmails(
  recipients: string[],
  subject: string,
  bodyText: string
): Promise<BulkEmailResult> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from =
    Deno.env.get('BULK_EMAIL_FROM') ??
    Deno.env.get('COLLEGE_EMAIL_FROM') ??
    'Local Marketplace <noreply@yourdomain.com>';

  if (!resendKey) {
    const isProd =
      Deno.env.get('DENO_ENV') === 'production' || Deno.env.get('ENVIRONMENT') === 'production';
    if (isProd) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    console.log('[bulk-email] Dev mode — would send to', recipients.length, 'recipients');
    return {
      recipient_count: recipients.length,
      sent_count: recipients.length,
      failed_count: 0,
    };
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        chunk.map((to) => ({
          from,
          to: [to],
          subject,
          text: bodyText,
        }))
      ),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Batch send failed: ${errBody.slice(0, 200)}`);
    }

    const json = (await res.json()) as { data?: { id?: string }[] };
    const batchSent = json.data?.length ?? chunk.length;
    sent += batchSent;
    failed += chunk.length - batchSent;

    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return {
    recipient_count: recipients.length,
    sent_count: sent,
    failed_count: failed,
  };
}

export function normalizeRecipientList(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const email = item.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}
