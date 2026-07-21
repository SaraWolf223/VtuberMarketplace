import { supabase } from '@/lib/supabase';

export type AalLevel = 'aal1' | 'aal2';

export type TotpFactor = {
  id: string;
  friendlyName: string | null;
  status: 'verified' | 'unverified';
  createdAt: string;
};

export type MfaStatus = {
  factors: TotpFactor[];
  verifiedFactor: TotpFactor | null;
  unverifiedFactors: TotpFactor[];
  currentLevel: AalLevel | null;
  nextLevel: AalLevel | null;
  /** True when the session has a verified factor but hasn't completed the step-up challenge yet. */
  needsStepUp: boolean;
};

function toAalLevel(value: string | null | undefined): AalLevel | null {
  return value === 'aal1' || value === 'aal2' ? value : null;
}

export async function fetchMfaStatus(): Promise<MfaStatus> {
  const [factorsRes, aalRes] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (factorsRes.error) throw factorsRes.error;
  if (aalRes.error) throw aalRes.error;

  const factors: TotpFactor[] = (factorsRes.data?.totp ?? []).map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    status: f.status,
    createdAt: f.created_at,
  }));

  const verifiedFactor = factors.find((f) => f.status === 'verified') ?? null;
  const unverifiedFactors = factors.filter((f) => f.status === 'unverified');
  const currentLevel = toAalLevel(aalRes.data?.currentLevel);
  const nextLevel = toAalLevel(aalRes.data?.nextLevel);

  return {
    factors,
    verifiedFactor,
    unverifiedFactors,
    currentLevel,
    nextLevel,
    needsStepUp: currentLevel === 'aal1' && (!!verifiedFactor || nextLevel === 'aal2'),
  };
}

export type TotpEnrollment = {
  factorId: string;
  secret: string;
  uri: string;
};

export async function enrollTotpFactor(friendlyName?: string): Promise<TotpEnrollment> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: friendlyName?.trim() || undefined,
  });
  if (error) throw error;
  return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri };
}

export const TOTP_CODE_RE = /^[0-9]{6}$/;

export async function verifyTotpFactor(factorId: string, code: string): Promise<void> {
  const trimmed = code.trim();
  if (!TOTP_CODE_RE.test(trimmed)) {
    throw new Error('Enter the 6-digit code from your authenticator app');
  }
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) throw challengeError;
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: trimmed,
  });
  if (verifyError) throw verifyError;
}

/** Removes an enrolled factor. Removing a *verified* factor requires an aal2 session. */
export async function unenrollTotpFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
