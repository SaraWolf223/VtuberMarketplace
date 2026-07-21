import { Platform } from 'react-native';
import type { FeedListingItem } from '@/types/feed';
import { LISTINGS_PER_AD_SLOT } from '@/constants/feed-ads';
import { NATIVE_FEED_GRID_COLUMNS } from '@/constants/feed-layout';
import type { WebFeedLayout } from '@/hooks/useWebViewport';

export type FeedGridCell =
  | { type: 'listing'; listing: FeedListingItem }
  | { type: 'ad'; key: string };

/** Mobile: a row of listing cards only. */
export type FeedListingRow = {
  type: 'listing-row';
  key: string;
  items: FeedListingItem[];
};

/** Mobile: full-width ad break between listing rows. */
export type FeedAdRow = {
  type: 'ad-row';
  key: string;
};

/** Web (OfferUp-style): one grid row mixing listings + sponsored cells. */
export type FeedMixedRow = {
  type: 'mixed-row';
  key: string;
  cells: FeedGridCell[];
};

export type FeedGridRow = FeedListingRow | FeedAdRow | FeedMixedRow;

/** @deprecated Use FeedListingRow */
export type FeedListingPairRow = FeedListingRow;

/** Mobile — full-width ad rows between listing rows (unchanged). */
function buildMobileFeedGridRows(
  listings: FeedListingItem[],
  columns: number
): FeedGridRow[] {
  const cols = Math.max(1, Math.floor(columns));
  const rows: FeedGridRow[] = [];
  let pending: FeedListingItem[] = [];
  let sinceLastAd = 0;
  let adBreakIndex = 0;

  const flushRow = () => {
    if (pending.length === 0) return;
    const items = pending.splice(0, cols);
    rows.push({
      type: 'listing-row',
      key: `row-${items.map((item) => item.id).join('-')}`,
      items,
    });
  };

  const pushListing = (listing: FeedListingItem) => {
    pending.push(listing);
    sinceLastAd += 1;
    if (pending.length >= cols) flushRow();
    if (sinceLastAd >= LISTINGS_PER_AD_SLOT) {
      if (pending.length > 0) flushRow();
      rows.push({
        type: 'ad-row',
        key: `ad-${listing.id}-${adBreakIndex}`,
      });
      adBreakIndex += 1;
      sinceLastAd = 0;
    }
  };

  for (const listing of listings) {
    pushListing(listing);
  }

  if (pending.length > 0) flushRow();

  return rows;
}

/**
 * Web — OfferUp-style: sponsored/platform cards occupy a single grid cell
 * (same footprint as a listing), not full-width banner strips.
 */
function buildWebFeedGridRows(
  listings: FeedListingItem[],
  columns: number
): FeedGridRow[] {
  const cols = Math.max(1, Math.floor(columns));
  const rows: FeedGridRow[] = [];
  let cells: FeedGridCell[] = [];
  let sinceLastAd = 0;
  let adBreakIndex = 0;

  const flushRow = () => {
    if (cells.length === 0) return;
    rows.push({
      type: 'mixed-row',
      key: `mixed-${cells.map((c) => (c.type === 'listing' ? c.listing.id : c.key)).join('-')}`,
      cells: cells.splice(0, cells.length),
    });
  };

  const pushCell = (cell: FeedGridCell) => {
    cells.push(cell);
    if (cells.length >= cols) flushRow();
  };

  const pushAdCell = (afterListing: FeedListingItem) => {
    pushCell({
      type: 'ad',
      key: `ad-${afterListing.id}-${adBreakIndex}`,
    });
    adBreakIndex += 1;
    sinceLastAd = 0;
  };

  for (const listing of listings) {
    pushCell({ type: 'listing', listing });
    sinceLastAd += 1;
    if (sinceLastAd >= LISTINGS_PER_AD_SLOT) {
      pushAdCell(listing);
    }
  }

  if (cells.length > 0) flushRow();

  return rows;
}

/** Listing-only grid rows (no ad breaks) — e.g. Saved / favorites. */
export function buildListingGridRows(
  listings: FeedListingItem[],
  columns: number = NATIVE_FEED_GRID_COLUMNS
): FeedListingRow[] {
  const cols = Math.max(1, Math.floor(columns));
  const rows: FeedListingRow[] = [];

  for (let i = 0; i < listings.length; i += cols) {
    const items = listings.slice(i, i + cols);
    rows.push({
      type: 'listing-row',
      key: `row-${items.map((item) => item.id).join('-')}`,
      items,
    });
  }

  return rows;
}

export function buildFeedGridRows(
  listings: FeedListingItem[],
  columns: number = NATIVE_FEED_GRID_COLUMNS,
  webLayout: WebFeedLayout | null = Platform.OS === 'web' ? 'desktop' : null
): FeedGridRow[] {
  if (Platform.OS === 'web' && webLayout === 'desktop') {
    return buildWebFeedGridRows(listings, columns);
  }
  return buildMobileFeedGridRows(listings, columns);
}

export function feedAdSlotKeys(rows: FeedGridRow[]): string[] {
  const keys: string[] = [];
  for (const row of rows) {
    if (row.type === 'ad-row') keys.push(row.key);
    if (row.type === 'mixed-row') {
      for (const cell of row.cells) {
        if (cell.type === 'ad') keys.push(cell.key);
      }
    }
  }
  return keys;
}
