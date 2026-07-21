/** Days added to expires_at when boosting a listing that is about to expire. */
export const BOOST_EXPIRY_EXTENSION_DAYS = 14;

/** If expires_at is within this many days, a boost also extends listing life. */
export const ABOUT_TO_EXPIRE_DAYS = 7;

/** Standard listing lifetime — keep in sync with DB migration 089. */
export const STANDARD_LISTING_ACTIVE_DAYS = 21;
export const STANDARD_LISTING_PURGE_DAYS = 28;

export const PREMIUM_LISTING_ACTIVE_MONTHS = 2;
export const PREMIUM_PURGE_GRACE_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isProfilePremiumActive(
  isPremium: boolean | null | undefined,
  premiumUntil: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!isPremium) return false;
  if (!premiumUntil) return true;
  return new Date(premiumUntil).getTime() > now.getTime();
}

export function listingExpiresAt(from: Date = new Date(), premiumActive = false): string {
  if (premiumActive) {
    const d = new Date(from);
    d.setUTCMonth(d.getUTCMonth() + PREMIUM_LISTING_ACTIVE_MONTHS);
    return d.toISOString();
  }
  return new Date(from.getTime() + STANDARD_LISTING_ACTIVE_DAYS * MS_PER_DAY).toISOString();
}

export function listingPurgeAt(from: Date = new Date(), premiumActive = false): string {
  if (premiumActive) {
    const d = new Date(from);
    d.setUTCMonth(d.getUTCMonth() + PREMIUM_LISTING_ACTIVE_MONTHS);
    d.setUTCDate(d.getUTCDate() + PREMIUM_PURGE_GRACE_DAYS);
    return d.toISOString();
  }
  return new Date(from.getTime() + STANDARD_LISTING_PURGE_DAYS * MS_PER_DAY).toISOString();
}

export function computeExpiresAtAfterBoost(
  expiresAtIso: string | null | undefined,
  now: Date = new Date()
): string | null {
  if (!expiresAtIso) return null;

  const expiresAt = new Date(expiresAtIso);
  const msUntilExpiry = expiresAt.getTime() - now.getTime();
  const aboutToExpireMs = ABOUT_TO_EXPIRE_DAYS * MS_PER_DAY;

  if (msUntilExpiry > aboutToExpireMs) {
    return null;
  }

  const base = expiresAt.getTime() > now.getTime() ? expiresAt : now;
  return new Date(base.getTime() + BOOST_EXPIRY_EXTENSION_DAYS * MS_PER_DAY).toISOString();
}
