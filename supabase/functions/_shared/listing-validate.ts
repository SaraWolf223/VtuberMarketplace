const CATEGORY_SLUG_RE = /^[a-z][a-z0-9_]{0,39}$/;
const ASSET_TYPES = new Set([
  'live2d_2d',
  'model_3d',
  'pngtuber',
  'accessory_prop',
  'background_overlay',
  'base_model',
  'other',
]);
const LICENSE_TYPES = new Set(['otu', 'p2u']);
const SUPPORT_DURATIONS = new Set(['none', 'days_30', 'days_90', 'lifetime']);

export type CreateListingInput = {
  title?: string;
  description?: string | null;
  price?: number;
  category?: string;
  asset_type?: string;
  license_type?: string;
  license_text?: string;
  download_url?: string;
  youtube_video_url?: string;
  is_mature?: boolean;
  support_duration?: string;
  compatible_software?: string[];
  file_formats?: string[];
  includes_source_files?: boolean;
  credits_text?: string | null;
  asset_fields?: Record<string, unknown>;
  zip_code?: string; // ignored — legacy clients
};

export type ValidatedCreateListing = {
  title: string;
  description: string | null;
  price: number;
  category: string;
  asset_type: string;
  license_type: string;
  license_text: string;
  download_url: string;
  youtube_video_url: string;
  is_mature: boolean;
  support_duration: string;
  compatible_software: string[];
  file_formats: string[];
  includes_source_files: boolean;
  credits_text: string | null;
  asset_fields: Record<string, unknown>;
};

export function validateCreateListing(body: CreateListingInput): {
  ok: true;
  data: ValidatedCreateListing;
} | { ok: false; message: string; code: string } {
  const title = body.title?.trim() ?? '';
  if (title.length < 1 || title.length > 80) {
    return { ok: false, message: 'Title must be 1–80 characters', code: 'VALIDATION' };
  }

  const description =
    body.description == null || body.description === ''
      ? null
      : String(body.description).trim();
  if (description && description.length > 2000) {
    return { ok: false, message: 'Description max 2000 characters', code: 'VALIDATION' };
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, message: 'Price must be greater than $0', code: 'VALIDATION' };
  }

  let category = body.category ?? '';
  if (!CATEGORY_SLUG_RE.test(category)) {
    return { ok: false, message: 'Invalid category', code: 'VALIDATION' };
  }

  const asset_type = body.asset_type ?? '';
  if (!ASSET_TYPES.has(asset_type)) {
    return { ok: false, message: 'Select an asset type', code: 'VALIDATION' };
  }

  const license_type = (body.license_type ?? '').toLowerCase();
  if (!LICENSE_TYPES.has(license_type)) {
    return { ok: false, message: 'Select OTU or P2U license type', code: 'VALIDATION' };
  }

  const license_text = (body.license_text ?? '').trim();
  if (license_text.length < 20) {
    return {
      ok: false,
      message: 'License text is required (seller-authored terms, min 20 characters)',
      code: 'VALIDATION',
    };
  }

  const download_url = (body.download_url ?? '').trim();
  if (!/^https?:\/\//i.test(download_url)) {
    return {
      ok: false,
      message: 'Download URL must be an http(s) link to your hosted file',
      code: 'VALIDATION',
    };
  }

  const youtube_video_url = (body.youtube_video_url ?? '').trim();
  if (!youtube_video_url) {
    return { ok: false, message: 'YouTube demo video URL is required', code: 'VALIDATION' };
  }

  const support_duration = body.support_duration ?? 'none';
  if (!SUPPORT_DURATIONS.has(support_duration)) {
    return { ok: false, message: 'Invalid support duration', code: 'VALIDATION' };
  }

  return {
    ok: true,
    data: {
      title,
      description,
      price,
      category,
      asset_type,
      license_type,
      license_text,
      download_url,
      youtube_video_url,
      is_mature: !!body.is_mature,
      support_duration,
      compatible_software: Array.isArray(body.compatible_software)
        ? body.compatible_software.map(String)
        : [],
      file_formats: Array.isArray(body.file_formats) ? body.file_formats.map(String) : [],
      includes_source_files: !!body.includes_source_files,
      credits_text: body.credits_text ? String(body.credits_text).trim() : null,
      asset_fields: body.asset_fields && typeof body.asset_fields === 'object' ? body.asset_fields : {},
    },
  };
}
