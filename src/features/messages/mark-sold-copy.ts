export const MARK_LISTING_SOLD_ALERT = {
  title: 'Mark listing sold?',
  message:
    'If you mark this listing sold, all messages in every chat about this listing will be permanently deleted for you and for every buyer who messaged you. This cannot be undone.',
  confirm: 'Mark sold',
} as const;

export const MARK_LISTING_SOLD_BANNER_WARNING =
  'Marking sold deletes every chat and all messages about this listing for you and all buyers.';
