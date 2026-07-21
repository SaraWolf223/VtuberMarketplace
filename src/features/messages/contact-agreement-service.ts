import { supabaseRpc } from '@/lib/supabase-rest';
import type {
  ContactAgreementState,
  ContactAgreementType,
  ConversationPhones,
} from '@/types/contact-agreement';

type AgreementResult = ContactAgreementState | { error: string };
type PhonesResult = ConversationPhones | { error: string };

function parseAgreement(result: AgreementResult): ContactAgreementState {
  if ('error' in result && result.error) {
    const messages: Record<string, string> = {
      NOT_FOUND: 'Conversation not found',
      BLOCKED: 'Cannot agree with a blocked user',
      NO_AGREEMENT: 'No meet or deal proposal yet',
    };
    throw new Error(messages[result.error] ?? 'Request failed');
  }
  return result as ContactAgreementState;
}

export async function fetchContactAgreement(
  accessToken: string,
  conversationId: string
): Promise<ContactAgreementState> {
  const result = await supabaseRpc<AgreementResult>(
    'get_conversation_contact_agreement',
    { p_conversation_id: conversationId },
    accessToken
  );
  return parseAgreement(result);
}

export async function proposeContactAgreement(
  accessToken: string,
  conversationId: string,
  agreementType: ContactAgreementType
): Promise<ContactAgreementState> {
  const result = await supabaseRpc<AgreementResult>(
    'propose_contact_agreement',
    { p_conversation_id: conversationId, p_agreement_type: agreementType },
    accessToken
  );
  return parseAgreement(result);
}

export async function acceptContactAgreement(
  accessToken: string,
  conversationId: string
): Promise<ContactAgreementState> {
  const result = await supabaseRpc<AgreementResult>(
    'accept_contact_agreement',
    { p_conversation_id: conversationId },
    accessToken
  );
  return parseAgreement(result);
}

export async function revealConversationPhones(
  accessToken: string,
  conversationId: string
): Promise<ConversationPhones> {
  const result = await supabaseRpc<PhonesResult>(
    'reveal_conversation_phones',
    { p_conversation_id: conversationId },
    accessToken
  );

  if ('error' in result && result.error) {
    const messages: Record<string, string> = {
      NOT_FOUND: 'Conversation not found',
      CONTACT_NOT_UNLOCKED:
        'Both of you must accept the contact agreement before phone numbers are shared.',
    };
    throw new Error(messages[result.error] ?? 'Could not load phone numbers');
  }

  return result as ConversationPhones;
}

export function agreementTypeLabel(type: ContactAgreementType): string {
  return type === 'meet' ? 'coordinate offline' : 'confirm a purchase';
}
