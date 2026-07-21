/** Normalize US phone input to E.164 (+1XXXXXXXXXX). */
export function normalizeToE164(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (input.trim().startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }
  throw new Error('Enter a valid 10-digit US phone number');
}

export function formatPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return '';
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return e164;
}
