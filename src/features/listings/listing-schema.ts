import { z } from 'zod';

export const listingSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(80),
  description: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  price: z
    .number({ invalid_type_error: 'Enter a price' })
    .positive('Price must be greater than $0'),
  category: z.string({ required_error: 'Pick a category' }).min(1, 'Pick a category'),
  asset_type: z.enum(
    [
      'live2d_2d',
      'model_3d',
      'pngtuber',
      'accessory_prop',
      'background_overlay',
      'base_model',
      'other',
    ],
    { required_error: 'Pick an asset type' }
  ),
  license_type: z.enum(['otu', 'p2u']),
  license_text: z.string().trim().min(20, 'License text must be at least 20 characters'),
  download_url: z.string().url('Enter a valid download URL').startsWith('http'),
  youtube_video_url: z.string().min(8, 'YouTube demo URL is required'),
  is_mature: z.boolean().optional(),
  support_duration: z.enum(['none', 'days_30', 'days_90', 'lifetime']).optional(),
  compatible_software: z.array(z.string()).optional(),
  file_formats: z.array(z.string()).optional(),
  includes_source_files: z.boolean().optional(),
});

export type ListingFormValues = z.infer<typeof listingSchema>;
