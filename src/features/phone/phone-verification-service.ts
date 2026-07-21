import { supabase } from '@/lib/supabase';
import { supabaseRpc } from '@/lib/supabase-rest';
import { normalizeToE164 } from '@/utils/phone-e164';

type CompleteResult = { ok: true; phone: string } | { error: string };

export async function sendPhoneVerificationOtp(phone: string): Promise<string> {
  const e164 = normalizeToE164(phone);
  const { error } = await supabase.auth.updateUser({ phone: e164 });
  if (error) {
    if (error.message.toLowerCase().includes('phone')) {
      throw new Error(
        'SMS verification is not available yet. Enable Phone auth in Supabase (Authentication → Providers).'
      );
    }
    throw new Error(error.message);
  }
  return e164;
}

export async function verifyPhoneOtpAndSyncProfile(
  phone: string,
  code: string,
  accessToken: string
): Promise<string> {
  const e164 = normalizeToE164(phone);
  const trimmed = code.replace(/\D/g, '');
  if (trimmed.length < 6) {
    throw new Error('Enter the 6-digit code from your text message');
  }

  const { error } = await supabase.auth.verifyOtp({
    phone: e164,
    token: trimmed,
    type: 'phone_change',
  });
  if (error) {
    throw new Error(error.message);
  }

  const result = await supabaseRpc<CompleteResult>('complete_phone_verification', {}, accessToken);
  if ('error' in result && result.error) {
    const messages: Record<string, string> = {
      PHONE_NOT_CONFIRMED: 'Phone not confirmed yet. Request a new code and try again.',
    };
    throw new Error(messages[result.error] ?? 'Could not save verified phone');
  }
  if ('phone' in result && result.phone) {
    return result.phone;
  }
  return e164;
}
