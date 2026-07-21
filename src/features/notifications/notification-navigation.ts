import type { NotificationKind, NotificationRow } from '@/types/notifications';

export type NotificationRouter = {
  push: (href: string) => void;
};

export function navigateToNotification(router: NotificationRouter, item: NotificationRow): void {
  if (item.conversation_id) {
    router.push(`/messages/${item.conversation_id}`);
    return;
  }

  if (!item.listing_id) return;

  switch (item.kind) {
    case 'listing_expiring':
      router.push('/my-listings?tab=active');
      break;
    case 'listing_expired':
      router.push('/my-listings?tab=expired');
      break;
    case 'listing_paused':
    case 'review_received':
      router.push('/my-listings');
      break;
    default:
      router.push(`/listing/${item.listing_id}`);
  }
}

export function notificationKindLabel(kind: NotificationKind): string {
  switch (kind) {
    case 'dm_message':
      return 'Message';
    case 'dm_started':
      return 'New chat';
    case 'deal_proposed':
    case 'deal_accepted':
      return 'Deal';
    case 'deal_unlocked':
      return 'Deal agreed';
    case 'review_received':
    case 'review_eligible':
      return 'Review';
    case 'listing_sold':
      return 'Sold';
    case 'listing_expiring':
      return 'Expiring';
    case 'listing_expired':
      return 'Expired';
    case 'listing_paused':
    case 'listing_removed':
    case 'account_warned':
    case 'account_banned':
      return 'Moderation';
    default:
      return 'Update';
  }
}
