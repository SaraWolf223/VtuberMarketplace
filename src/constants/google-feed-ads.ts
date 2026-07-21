/**
 * Google in-feed video/native ads (OfferUp-style programmatic slots).
 *
 * OfferUp places full-width native display/video units between listing rows
 * (~every 6 cells), labeled Sponsored, often autoplaying muted video.
 */

/** Listing cells before each ad break. */
export const LISTINGS_PER_AD_SLOT = 6;

/** Do not insert Google ad rows until the feed has at least this many listings. */
export const GOOGLE_FEED_ADS_MIN_LISTINGS = 6;

/** Native media area aspect ratio (width : height) for in-feed video cards. */
export const GOOGLE_FEED_VIDEO_ASPECT_RATIO = 16 / 9;

/** Max height of the video/media area in the feed card. */
export const GOOGLE_FEED_VIDEO_MEDIA_MAX_HEIGHT = 200;

/** Max width of a full-width in-feed ad card (keeps it readable on wide desktop layouts). */
export const GOOGLE_FEED_AD_MAX_WIDTH = 1200;
