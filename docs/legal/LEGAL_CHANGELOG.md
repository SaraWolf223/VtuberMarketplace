# Legal documents changelog

> **Attorney review required before production.** These drafts are not legal advice.

This is a template repo, so the seller's original edit history has been removed. Once you publish these documents, start your own changelog here — one row per change, e.g.:

| Date | Change |
|------|--------|
| [YYYY-MM-DD] | Filled in entity details in [ENTITY.md](./ENTITY.md) (legal operator, contact email, governing law/venue) and regenerated legal content via `npm run generate:legal`. |

**Before launch:**
- Fill in every placeholder in [ENTITY.md](./ENTITY.md), including a mailing address, after attorney review.
- Have a lawyer licensed in your state review every file in this folder.
- Bump `CURRENT_TERMS_VERSION` (see [docs/13-Legal_and_Compliance.md](../13-Legal_and_Compliance.md)) whenever you materially change Terms or Privacy, so returning users are prompted to re-accept.
- Publish `website/` to your real domain and re-run `npm run generate:legal` after any edit to files in this folder.
