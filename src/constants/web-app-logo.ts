/** Full wordmark PNG aspect (1296×193 trimmed lockup). Update if you swap assets/web-logo-lockup.png. */
export const WEB_LOGO_LOCKUP_ASPECT = 1296 / 193;

/** Desktop top bar logo height — prominent enough for white-label wordmarks. */
export const WEB_TOP_BAR_LOGO_HEIGHT = 42;
export const WEB_TOP_BAR_LOGO_WIDTH = Math.round(
  WEB_TOP_BAR_LOGO_HEIGHT * WEB_LOGO_LOCKUP_ASPECT
);

/** Sign-in / auth header logo height. */
export const WEB_AUTH_LOGO_HEIGHT = 30;
export const WEB_AUTH_LOGO_WIDTH = Math.round(WEB_AUTH_LOGO_HEIGHT * WEB_LOGO_LOCKUP_ASPECT);

/**
 * Uploaded buyer logos are often square marks with padding, not full wordmarks.
 * Show those as a larger mark plus app name so white-label branding stays legible.
 */
export const WEB_CUSTOM_LOGO_WIDE_ASPECT_MIN = 2.2;
export const WEB_CUSTOM_TOP_BAR_MARK_SIZE = 48;
export const WEB_CUSTOM_AUTH_MARK_SIZE = 40;
export const WEB_CUSTOM_MARK_ZOOM = 2.25;
export const WEB_CUSTOM_TOP_BAR_TEXT_SIZE = 20;
export const WEB_CUSTOM_AUTH_TEXT_SIZE = 18;
export const WEB_CUSTOM_TOP_BAR_TEXT_MAX_WIDTH = 220;
export const WEB_CUSTOM_AUTH_TEXT_MAX_WIDTH = 180;

/** @deprecated Use WEB_TOP_BAR_LOGO_HEIGHT */
export const WEB_TOP_BAR_MARK_SIZE = WEB_TOP_BAR_LOGO_HEIGHT;
