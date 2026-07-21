# Local Marketplace — canonical legal entity

Single source of truth for placeholders across `docs/legal/*.md`. Update here first, then sync other files.

| Field | Value |
|-------|-------|
| **App display name** | Local Marketplace |
| **Production domain** | yourdomain.com |
| **Legal operator** | [YOUR COMPANY LLC] |
| **Effective date** | [EFFECTIVE DATE — set when you publish] |
| **Last updated** | [LAST UPDATED DATE — set when you publish] |
| **Support email** | support@yourdomain.com |
| **Privacy email** | support@yourdomain.com |
| **Mailing address** | *TBA — add after attorney review* |
| **Governing law** | [YOUR STATE], United States |
| **Dispute venue** | State or federal courts in [YOUR COUNTY], [YOUR STATE] |

> **Note:** This is a template, not legal advice. Before you launch, have a lawyer licensed in your state review these documents. Fill in every bracketed placeholder above — legal operator name, dates, contact email, mailing address, and governing law/venue — then run `npm run generate:legal` to regenerate the in-app legal content and static legal pages from this file.
