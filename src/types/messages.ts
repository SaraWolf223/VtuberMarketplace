export type ConversationInboxRow = {
  conversation_id: string;
  listing_id: string;
  listing_title: string;
  listing_price: number;
  other_user_id: string;
  other_display_name: string;
  other_username: string;
  other_avatar_url: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  updated_at: string;
};

export type ConversationDetail = {
  conversation_id: string;
  listing_id: string;
  listing_title: string;
  listing_price: number;
  listing_status: string;
  buyer_id: string;
  seller_id: string;
  other_user_id: string;
  other_display_name: string;
  other_username: string;
  other_avatar_url: string | null;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
