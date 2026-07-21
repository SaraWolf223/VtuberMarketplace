export type NotificationKind =
  | 'dm_message'
  | 'dm_started'
  | 'deal_proposed'
  | 'deal_accepted'
  | 'deal_unlocked'
  | 'review_received'
  | 'review_eligible'
  | 'listing_sold'
  | 'listing_expiring'
  | 'listing_expired'
  | 'listing_paused'
  | 'listing_removed'
  | 'account_warned'
  | 'account_banned';

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  listing_id: string | null;
  conversation_id: string | null;
  actor_user_id: string | null;
  actor_display_name: string | null;
  actor_avatar_url: string | null;
  read_at: string | null;
  created_at: string;
};
