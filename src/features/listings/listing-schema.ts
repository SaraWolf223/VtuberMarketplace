import { z } from 'zod';

// Categories are admin-configurable at runtime (see `listing_categories`
// table / `useListingCategories()`), so this can no longer be a static
// z.enum — the server (insert_draft_listing/update_listing RPCs) is the
// authoritative validator (raises INVALID_CATEGORY for unknown slugs).
export const listingSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(80),
  description: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  price: z
    .number({ invalid_type_error: 'Enter a price' })
    .positive('Price must be greater than $0'),
  category: z.string({ required_error: 'Pick a category' }).min(1, 'Pick a category'),
  zip_code: z.string().regex(/^\d{5}$/, 'Enter a valid 5-digit ZIP'),
});

export type ListingFormValues = z.infer<typeof listingSchema>;
