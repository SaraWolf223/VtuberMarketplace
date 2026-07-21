// Categories are now admin-editable (see `listing_categories` table,
// migration 109) instead of a fixed list here. Real validation — does this
// slug exist and is it active — happens in the `insert_draft_listing` RPC
// (raises INVALID_CATEGORY) via a DB lookup + foreign key. This is just a
// cheap shape check so obviously bad input fails fast before touching the DB.
const CATEGORY_SLUG_RE = /^[a-z][a-z0-9_]{0,39}$/;

export type CreateListingInput = {
  title?: string;
  description?: string | null;
  price?: number;
  category?: string;
  zip_code?: string;
};

export function validateCreateListing(body: CreateListingInput): {
  ok: true;
  data: {
    title: string;
    description: string | null;
    price: number;
    category: string;
    zip_code: string;
  };
} | { ok: false; message: string; code: string } {
  const title = body.title?.trim() ?? '';
  if (title.length < 1 || title.length > 80) {
    return { ok: false, message: 'Title must be 1–80 characters', code: 'VALIDATION' };
  }

  const description =
    body.description == null || body.description === ''
      ? null
      : String(body.description).trim();
  if (description && description.length > 500) {
    return { ok: false, message: 'Description max 500 characters', code: 'VALIDATION' };
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, message: 'Price must be greater than $0', code: 'VALIDATION' };
  }

  let category = body.category ?? '';
  if (category === 'clothing') {
    category = 'miscellaneous';
  }
  if (!CATEGORY_SLUG_RE.test(category)) {
    return { ok: false, message: 'Invalid category', code: 'VALIDATION' };
  }

  const zip = body.zip_code?.replace(/\D/g, '').slice(0, 5) ?? '';
  if (!/^[0-9]{5}$/.test(zip)) {
    return { ok: false, message: 'Enter a valid 5-digit US ZIP', code: 'VALIDATION' };
  }

  return {
    ok: true,
    data: { title, description, price, category, zip_code: zip },
  };
}
