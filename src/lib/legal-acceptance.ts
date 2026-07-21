import type { ProfileRow } from '@/features/profile/profile-service';
import { CURRENT_TERMS_VERSION } from '@/constants/legal';

export function hasAcceptedCurrentTerms(
  profile: Pick<ProfileRow, 'terms_accepted_at' | 'terms_version'> | null | undefined
): boolean {
  if (!profile?.terms_accepted_at) return false;
  return profile.terms_version === CURRENT_TERMS_VERSION;
}

export function needsTermsAcceptance(
  profile: Pick<ProfileRow, 'terms_accepted_at' | 'terms_version'> | null | undefined
): boolean {
  return !hasAcceptedCurrentTerms(profile);
}
