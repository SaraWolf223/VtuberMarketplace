import { BUILD_APP_IDENTITY } from '@/config/app-identity';

/** Public legal page URLs (publish docs/legal on your domain before store launch). */
const legalOrigin = `https://${BUILD_APP_IDENTITY.appDomain}`;
export const LEGAL_URLS = {
  terms: `${legalOrigin}/terms`,
  privacy: `${legalOrigin}/privacy`,
  community: `${legalOrigin}/community`,
  sellerAgreement: `${legalOrigin}/seller-agreement`,
  buyerPurchaseTerms: `${legalOrigin}/buyer-purchase-terms`,
  dmcaCopyrightPolicy: `${legalOrigin}/dmca`,
} as const;
