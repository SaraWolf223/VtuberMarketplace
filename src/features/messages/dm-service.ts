import { getSupabaseEnv, supabaseRestGet, supabaseRpc } from '@/lib/supabase-rest';
import type {
  ConversationDetail,
  ConversationInboxRow,
  MessageRow,
} from '@/types/messages';

export async function getOrCreateListingConversation(
  accessToken: string,
  listingId: string
): Promise<string> {
  const id = await supabaseRpc<string>(
    'get_or_create_listing_conversation',
    { p_listing_id: listingId },
    accessToken
  );
  if (!id) {
    throw new Error('Could not open conversation');
  }
  return id;
}

export async function sendConversationMessage(
  accessToken: string,
  conversationId: string,
  body: string
): Promise<string> {
  const id = await supabaseRpc<string>(
    'send_conversation_message',
    { p_conversation_id: conversationId, p_body: body },
    accessToken
  );
  if (!id) {
    throw new Error('Could not send message');
  }
  return id;
}

export async function listMyConversations(
  accessToken: string,
  limit = 50
): Promise<ConversationInboxRow[]> {
  return supabaseRpc<ConversationInboxRow[]>(
    'list_my_conversations',
    { p_limit: limit },
    accessToken
  );
}

export async function getConversationDetail(
  accessToken: string,
  conversationId: string
): Promise<ConversationDetail> {
  const rows = await supabaseRpc<ConversationDetail[]>(
    'get_conversation_detail',
    { p_conversation_id: conversationId },
    accessToken
  );
  if (!rows[0]) {
    throw new Error('Conversation not found');
  }
  return rows[0];
}

export async function fetchConversationMessages(
  accessToken: string,
  conversationId: string,
  limit = 100
): Promise<MessageRow[]> {
  return supabaseRestGet<MessageRow>(
    `messages?conversation_id=eq.${conversationId}&select=id,conversation_id,sender_id,body,created_at&order=created_at.asc&limit=${limit}`,
    accessToken
  );
}

/** Dev-only helper for the seller phone-verification gate — not used for DM sending. */
export async function markPhoneVerifiedStub(
  accessToken: string,
  phone?: string
): Promise<void> {
  const { url, key } = getSupabaseEnv();
  const res = await fetch(`${url}/functions/v1/dev-mark-phone-verified`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ phone: phone?.trim() || null }),
  });

  const raw = await res.text();
  let json: { ok?: boolean; error?: { message?: string } };
  try {
    json = JSON.parse(raw) as typeof json;
  } catch {
    throw new Error(
      res.status === 404
        ? 'Function "dev-mark-phone-verified" is not deployed. Run: npx supabase functions deploy dev-mark-phone-verified'
        : `Request failed (${res.status})`
    );
  }

  if (!json.ok) {
    throw new Error(json.error?.message ?? `Request failed (${res.status})`);
  }
}

export function isEmailVerificationError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('email verification') || lower.includes('email_confirmed');
}

export function isBannedKeywordError(message: string): boolean {
  return message.toUpperCase().includes('BANNED_KEYWORD');
}

type OkResult = { ok: true; listing_id?: string } | { error: string };

function parseOkResult(result: OkResult, errors: Record<string, string>): void {
  if ('error' in result && result.error) {
    throw new Error(errors[result.error] ?? 'Request failed');
  }
}

export async function deleteConversation(
  accessToken: string,
  conversationId: string
): Promise<void> {
  const result = await supabaseRpc<OkResult>(
    'delete_conversation',
    { p_conversation_id: conversationId },
    accessToken
  );
  parseOkResult(result, {
    NOT_FOUND: 'Conversation not found',
  });
}

export async function markListingSoldAndEndChat(
  accessToken: string,
  conversationId: string
): Promise<string> {
  const result = await supabaseRpc<OkResult>(
    'mark_listing_sold_and_end_chat',
    { p_conversation_id: conversationId },
    accessToken
  );
  parseOkResult(result, {
    NOT_FOUND: 'Conversation not found',
    LISTING_NOT_ACTIVE: 'This listing is no longer active.',
  });
  if ('listing_id' in result && result.listing_id) {
    return result.listing_id;
  }
  throw new Error('Could not mark listing sold');
}
