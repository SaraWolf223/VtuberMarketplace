import { LEGAL_URLS } from '@/constants/legal-urls';
import { BUILD_APP_IDENTITY } from '@/config/app-identity';

/** Bump when Terms/Privacy materially change — users must re-accept. */
export const CURRENT_TERMS_VERSION = '2026-06-19';

export const SUPPORT_EMAIL = BUILD_APP_IDENTITY.supportEmail;

export type LegalDocumentId =
  | 'terms'
  | 'privacy'
  | 'community'
  | 'sellerAgreement'
  | 'buyerPurchaseTerms'
  | 'dmcaCopyrightPolicy';

export type LegalDocument = {
  id: LegalDocumentId;
  title: string;
  description: string;
  url: string;
};

/** All platform legal documents linked in-app. */
export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    id: 'terms',
    title: 'Terms of Service',
    description: `Rules for using ${BUILD_APP_IDENTITY.appDisplayName}, listings, and seller tools`,
    url: LEGAL_URLS.terms,
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your data',
    url: LEGAL_URLS.privacy,
  },
  {
    id: 'community',
    title: 'Community Guidelines',
    description: 'Expected behavior, prohibited content, and enforcement',
    url: LEGAL_URLS.community,
  },
  {
    id: 'sellerAgreement',
    title: 'Seller Agreement',
    description: 'Onboarding, licensing responsibility, and link-health strikes for sellers',
    url: LEGAL_URLS.sellerAgreement,
  },
  {
    id: 'buyerPurchaseTerms',
    title: 'Buyer Purchase Terms',
    description: 'What a purchase grants, refund eligibility, and review rules for buyers',
    url: LEGAL_URLS.buyerPurchaseTerms,
  },
  {
    id: 'dmcaCopyrightPolicy',
    title: 'DMCA / Copyright Policy',
    description: 'Copyright takedown notices, counter-notices, and repeat-infringer policy',
    url: LEGAL_URLS.dmcaCopyrightPolicy,
  },
];

export const PLATFORM_TERMS_SUMMARY =
  `By using ${BUILD_APP_IDENTITY.appDisplayName} you agree to our Terms of Service and Privacy Policy, confirm you are at least 18, and will follow our Community Guidelines for listing and selling digital VTuber assets.`;
