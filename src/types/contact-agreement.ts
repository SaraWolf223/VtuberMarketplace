export type ContactAgreementType = 'meet' | 'deal';

export type ContactAgreementState = {
  has_agreement: boolean;
  contact_unlocked: boolean;
  agreement_type: ContactAgreementType | null;
  proposed_by: string | null;
  my_accepted: boolean;
  other_accepted: boolean;
  is_buyer: boolean;
};

export type ConversationPhones = {
  my_phone: string | null;
  other_phone: string | null;
  other_user_id: string;
};
