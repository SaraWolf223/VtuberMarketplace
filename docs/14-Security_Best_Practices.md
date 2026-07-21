# Local Marketplace â€” Security Best Practices

**Version:** 2.2 (runtime branding audit — see §12; DM system audit — see §13; admin-panel/RLS audit — see §14)

---

## 1. Authentication

- Google, Apple (iOS), or email/password â€” buyer/admin can't disable Google or Apple; see [25-Google_Auth_and_Profile.md](./25-Google_Auth_and_Profile.md)
- Email/password: 8-char minimum enforced client-side and via `supabase/config.toml` `[auth.password] min_length`; generic "if an account existsâ€¦" copy on password reset to prevent account enumeration
- Optional TOTP 2FA for any user; **mandatory AAL2** for `admin`/`manager` â€” enforced client-side (redirect to `/admin/security`) **and** server-side (`is_app_admin()`/`is_app_staff()` SQL functions check `auth.jwt()->>'aal' = 'aal2'`; `requireStaff()` edge helper checks `getAuthenticatorAssuranceLevel()`)
- Supabase JWT validation on all RLS-protected tables
- Short-lived JWT; refresh via SDK
- Revoke sessions on `banned_at` set (Edge hook on next API call)
- **Buyer TODO (Dashboard-only, not scriptable):** in Supabase Dashboard â†’ Authentication â†’ Policies, raise "Minimum password length" to 8+ and enable "Leaked password protection" (HaveIBeenPwned check â€” Pro plan+)
- Sign-in/sign-up/password-reset go through Supabase Auth's own client SDK (not our edge functions), so they inherit Supabase's platform-level auth rate limiting rather than our custom `rate-limit.ts` (that's used for our own edge functions â€” waitlist, reports, listing create, etc.)

---

## 2. Row Level Security

- **Every** table has RLS enabled
- **Separate policies** per SELECT / INSERT / UPDATE / DELETE
- **Index** columns used in policies (`seller_id`, `user_id`, etc.)
- Never `USING (true)` on PII tables
- Service role **only** in Edge Functions, never in app
- Test via **client SDK** with two test users â€” SQL Editor bypasses RLS
- CI: RLS integration tests (see **17-Testing_and_QA.md**)
- Runtime branding config tables (audited — see §12): `public_app_config` and `listing_categories` are intentionally public-read (branding/categories aren't secret, needed pre-auth) with admin-only write via `is_app_admin()`; `email_templates` is admin-only read+write (may contain internal ops wording); `rate_limit_events` has RLS enabled with **no policies at all** (service-role-only by construction — anon/authenticated get zero access)

---

## 3. API security

| Control | Implementation |
|---------|----------------|
| Rate limit listing create | 10/hour/user via `listing_create_log` |
| Rate limit reports | 5/hour/user |
| Rate limit geocode | 30/hour/user |
| Stripe webhook | Verify `stripe-signature` |
| Admin endpoints | Check `profiles.role = admin` |
| Input validation | Zod client + SQL constraints |

---

## 4. Storage security

- Signed upload URLs expire in 15 minutes
- Path prefix must match `auth.uid()`
- Public read OK for listing images (MVP tradeoff)
- No EXIF GPS leak: strip metadata in `expo-image-manipulator`
- Avatar + branding-logo uploads go through edge functions that content-sniff magic bytes (real PNG/JPEG/WebP, not just the client-declared MIME type), cap dimensions and byte size, and reject anything else (no SVG â€” avoids SVG-borne script/XXE payloads) â€” see `_shared/avatar-image.ts` / `_shared/branding-image.ts`
- **Known limitation:** uploads are validated but not re-encoded (Supabase Edge Functions run on Deno, where native image libs like `sharp` aren't available) â€” residual risk is a crafted-but-valid-magic-bytes polyglot file; mitigated by Storage always serving with our own fixed `Content-Type` header (never sniffed) and the strict size/dimension caps. Acceptable for MVP; re-encoding would need a separate Node-based image-processing service if ever required

---

## 5. Secrets

- Store in EAS Secrets + Supabase Edge secrets
- Rotate on team member departure
- `.gitignore`: `.env`, `google-services.json` if contains keys

---

## 6. Client security

- No service role in bundle
- `EXPO_PUBLIC_*` only for anon key (expected exposure)
- Certificate pinning: defer
- Jailbreak detection: defer

---

## 7. Spam prevention

- Max 10 new listings per hour
- Username change max 1 per 7 days
- New account listing limit: 3 first day (optional)
- Honeypot field in reports (hidden) â€” bot trap
- Website waitlist forms: honeypot field + per-IP (10/hr) and per-email (3/day) rate limits + origin allowlist, **plus optional Cloudflare Turnstile** (`_shared/turnstile.ts`, `join-waitlist`/`join-ios-waitlist`) â€” no-ops until a buyer sets `TURNSTILE_SECRET_KEY` + `turnstileSiteKey`, so launch isn't blocked on a Cloudflare account
- Email/password sign-up (web only): same Turnstile widget wired through Supabase Auth's native `captchaToken` option (`TurnstileWidget.tsx` â†’ `signUpWithEmailPassword`) â€” requires also enabling "Captcha protection" (provider: Turnstile) in Supabase Dashboard â†’ Auth for server-side enforcement
- **Known limitation:** native iOS/Android sign-up has no CAPTCHA widget (Turnstile needs a real DOM; there's no first-party RN equivalent) â€” mitigated by app-store distribution being a higher bar than an open web form, plus the same account/IP-independent Supabase Auth rate limiting

---

## 8. Data privacy

- `profiles_public` view excludes email/phone
- Phone reveal logged, not shown in API lists
- Export/delete flows documented in **13-Legal**

---

## 9. Dependency hygiene

- `npm audit` monthly
- Pin Expo SDK version
- Dependabot enabled on GitHub
- **Full cadence:** [27-Platform_Maintenance_Runbook.md](./27-Platform_Maintenance_Runbook.md) section 4
- As of the 2026-07-15 audit: Expo was upgraded to SDK 57 and `npm audit fix` (non-breaking) was applied. The remaining 13 moderate advisories are transitive Expo config-plugin tooling (`uuid` via `xcode` -> `@expo/config-plugins`). Do not use `npm audit fix --force` unless Expo publishes a compatible path; the current force fix proposes a breaking/downgrade package change.
- New packages added for this effort were reviewed, with no known high/critical CVEs at time of writing: `expo-apple-authentication`, `react-native-qrcode-svg`, `react-native-svg`. Cloudflare Turnstile is loaded via `<script>`/CDN on web only, so it adds no npm dependency.

---

## 10. Incident response (solo founder)

1. Detect (user report, Stripe fraud alert, Supabase alert)
2. Contain (ban user, disable Edge function)
3. Assess (logs, moderation_actions)
4. Notify affected users if PII breach
5. Postmortem doc in `docs/incidents/`

---

## 11. Security checklist pre-launch

- [ ] RLS policies tested for bypass
- [ ] Webhook signature verified
- [ ] Storage policies tested cross-user upload
- [ ] Admin routes blocked for normal users
- [ ] No secrets in git history
- [ ] Admin/manager account has completed TOTP enrollment (mandatory â€” see Â§1)
- [ ] Supabase Dashboard: min password length 8+, leaked-password protection on (if plan supports it)
- [ ] `CRON_SECRET` and `COLLEGE_OTP_SECRET` set to unique random values (never left as defaults) â€” see `admin/setup-status`

---

## 12. Runtime branding audit findings (Phase 9, this version)

Audit performed when converting the codebase from a resellable template into a single-product VTuber marketplace. Findings and their resolution:

| Area | Finding | Resolution |
|------|---------|------------|
| RLS â€” new config tables | `public_app_config`/`listing_categories` need public SELECT (pre-auth branding/categories) | Confirmed writes are `is_app_admin()`-gated only; no secret values ever stored there (enforced by convention + code review, not a DB constraint) |
| RLS â€” email templates | Could leak internal ops wording if public | `email_templates` has **no** public SELECT policy â€” admin-only `FOR ALL` |
| RLS â€” rate limiter | Could leak abuse signal if readable | No policies at all beyond RLS-enabled = service-role-only |
| Upload validation | Plan called for `sharp` re-encoding | Not possible in Deno edge runtime; kept existing magic-byte + size/dimension validation pattern (matches pre-existing avatar upload code) â€” documented residual risk in Â§4 |
| Category icon input | Free-text `icon_name` column | Client allowlist (`ionicons-allowlist.ts`) + **render-time coercion** (`toSafeCategoryIcon()` in `useListingCategories.ts`) â€” an out-of-allowlist value can never reach `<Ionicons name>` regardless of how it got into the DB |
| Email template placeholders | `{{token}}` substitution surface | Plain-text-only substitution (literal string replace, no eval); emails sent via Resend `text` field only, never `html` â€” no injection surface exists |
| Dev/backdoor review | `__DEV__`-gated UI (admin role-grant instructions, phone-verify stub button) | All gated by React Native's compile-time `__DEV__` (stripped from production/release bundles by the bundler, not a runtime toggle); the actual phone-verify bypass (`dev-mark-phone-verified` function) independently fails closed server-side unless `ALLOW_DEV_PHONE_STUB=true` **and** not production |
| Hardcoded secrets | Searched for API-key-shaped strings, test creds | None found; `.env`/`.env.*.local` correctly gitignored |
| Bot/spam | Waitlist had only a honeypot | Added optional Cloudflare Turnstile (Â§7) â€” off by default, buyer opts in |
| Password policy | No enforced minimum | `min_length = 8` in `config.toml` + client-side check; leaked-password protection documented as a Dashboard/paid-plan toggle (not scriptable) |
| Account enumeration | Password reset could confirm registered emails | Generic "if an account existsâ€¦" copy regardless of outcome |
| Dependency audit | `npm audit` | 22 â†’ 18 advisories after non-breaking `npm audit fix`; remainder needs a major Expo bump (deferred, see Â§9) |

---

## 13. DM (in-app messaging) system audit

The in-app direct-message feature (`conversations`/`conversation_participants`/`messages`, migration 032 â€” see [03-Database_Schemas.md](./03-Database_Schemas.md) Â§3.18) was previously undocumented ("no chat" in older doc drafts) and had not gone through a dedicated security pass. This audit closes that gap.

| Area | Finding | Status |
|------|---------|--------|
| Read access | `conversations`/`messages` `SELECT` RLS requires `is_conversation_participant(id, auth.uid())`; `conversation_participants` `SELECT` requires `user_id = auth.uid()` | Pass â€” a user cannot read a thread they're not part of, even via direct REST |
| Write access | `messages` has `FOR INSERT ... WITH CHECK (FALSE)` â€” no direct client insert is possible at all | Pass â€” every message is written only via the `send_conversation_message()` `SECURITY DEFINER` RPC, which independently re-validates participancy before inserting |
| Blocking | `users_are_blocked()` is checked when opening a new thread (`get_or_create_listing_conversation`), on every send (`send_conversation_message`), and when proposing a contact agreement (`propose_contact_agreement`) | Pass â€” blocking a user immediately stops new messages and new meet/deal proposals both directions; existing message history remains visible to both (consistent with how blocking works for listings/reviews elsewhere â€” it hides future contact, not past history) |
| Phone reveal gate | `reveal_conversation_phones()`/`reveal_seller_phone()` require `conversation_contact_unlocked()` â€” both `buyer_accepted_at` and `seller_accepted_at` set on a `conversation_contact_agreements` row | Pass â€” a phone number can't be pulled by one side unilaterally; requires the other participant's explicit in-thread acceptance |
| Spam filter | Message bodies were **not** checked against `banned_keywords` (listings already were) | **Fixed** (migration 115) â€” `send_conversation_message()` now calls `find_banned_keyword_in_text()` and rejects matches with `BANNED_KEYWORD`, mapped client-side to a friendly error in `app/messages/[id].tsx` |
| Rate limiting | 15 messages/minute per `(conversation_id, sender_id)`, enforced inside the same transaction as the insert | Pass â€” bounds spam/flood volume per thread; cannot be bypassed client-side since it's server-enforced in the RPC |
| Sender identity spoofing | `sender_id` is always `auth.uid()` inside the `SECURITY DEFINER` function, never a client-supplied parameter | Pass |
| Unauthenticated access | Every RPC raises `Not authenticated` if `auth.uid()` is null; anon key alone cannot read or write any row (RLS + no anon grants) | Pass |
| Phone-verification gate | Sending requires `is_phone_verified()`; this is a real per-account throttle (verifying a phone number isn't free/instant to automate at scale) on top of rate limiting | Pass |
| Realtime channel | `messages` is added to the `supabase_realtime` publication; Realtime respects the same RLS policies as REST, so a subscriber only receives rows they're already allowed to `SELECT` | Pass |
| Message content moderation (post-hoc) | No admin UI to review/report a specific message today â€” reports are listing/user-level only | **Known gap, deferred:** acceptable for MVP (banned-keyword filter + rate limit + phone-verification cover the automated-abuse case); a per-message "report" surface is future work if message-content abuse becomes a real issue |
| Data retention | Messages have no automatic expiry/deletion; `delete_conversation()` lets a participant remove a thread on their own initiative | Acceptable â€” matches the rest of the app's model of user-initiated deletion rather than automatic retention limits |

---

## 14. Admin panel / RLS audit (full-audit pass, this version)

A full audit of every admin/manager code path found two **critical** PII/RLS gaps and several UI-level (not server-level) gaps in the manager/admin split. All are fixed in migration 116 and the corresponding client code.

| Area | Finding | Status |
|------|---------|--------|
| `profiles` raw SELECT | `profiles_select_admin` RLS used `is_app_staff()` (true for `admin` **and** `manager`), granting any manager's JWT a direct-REST `SELECT *` on `profiles` â€” bypassing every redaction RPC added in migrations 091/101 (`list_staff_users_page`, `list_banned_users`, `list_warned_users`, `list_moderation_log`, `list_college_students` all null out `email` for managers, but the underlying table was still fully readable) | **Fixed** (migration 116) â€” policy now requires `is_app_admin()`; the two legitimate staff-only (non-PII) reads that relied on it (`fetchModerationTargetState`, `fetchPublicProfile`'s hidden-profile fallback) were moved to new narrow `SECURITY DEFINER` RPCs (`get_moderation_target_state`, `get_staff_visible_profile`) that only ever return non-PII columns |
| `waitlist_signups` admin read | `waitlist_signups_admin_select` checked raw `role = 'admin'` instead of `is_app_admin()`, skipping the mandatory AAL2 (2FA step-up) check every other admin policy enforces â€” an admin who hadn't completed a TOTP challenge this session could still read waitlist emails | **Fixed** (migration 116) â€” uses `is_app_admin()` |
| `list_college_students` redaction | Redacted `email` and `college_edu_email` for managers but returned `phone` unredacted for the same row â€” inconsistent PII rule; the client already filters managers to zero rows here (a row is dropped if `college_edu_email` is null), but the RPC itself was still a bypass for a manager calling it directly | **Fixed** (migration 116) â€” `phone` is now redacted the same way as `email`/`college_edu_email` |
| Manager route access (client) | `app/admin/_layout.tsx` rendered every admin screen's `Stack.Screen` for managers with no per-route check â€” `src/lib/admin-access.ts` already had a `canAccessAdminRoute()`/`MANAGER_ROUTES` allowlist, but it was only used to hide/show links on the hub screen, not enforced on direct navigation. Server-side writes were always correctly blocked (`is_app_admin()`-gated RPCs/RLS), so this was a UI/UX gap, not a data-exposure one | **Fixed** â€” `_layout.tsx` now redirects to `/admin` for any route `canAccessAdminRoute()` disallows for the signed-in role |
| AAL2 layout gate | The layout's step-up redirect checked only `mfaStatus?.verifiedFactor` (enrollment exists), not `mfaStatus?.currentLevel === 'aal2'` (this session actually completed the challenge) | **Fixed** (defense-in-depth) â€” gate now checks `currentLevel === 'aal2'` directly, matching what RLS/`is_app_staff()` actually require. In practice the app-wide `MfaStepUpGate` (root layout) already forces a step-up challenge before any route renders when `needsStepUp` is true, so this was not independently exploitable â€” the tightened check just makes the invariant explicit at the point that matters |
| Moderation-action notifications | `warn_user`/`ban_user`/`delete_listing` actions from `AdminReportCard.tsx`, `app/admin/moderation.tsx`, and `app/admin/users.tsx` never called `notifyModerationAction` (only `StaffModerationMenu.tsx` did) â€” affected users weren't told why they were moderated from those surfaces | **Fixed** â€” best-effort `notifyModerationAction` call wired into all three, matching the existing `StaffModerationMenu` pattern |
| Bulk-email confirm dialog | Skipping "Preview count" before "Send email" showed "This will email **all** \<audience\> recipient(s)" â€” read as an unbounded send rather than the (unknown) actual count | **Fixed** â€” `handleSend` now always fetches a fresh accurate count before showing the confirm dialog |
| `setup-status.tsx` | The `get-setup-status` edge function reports `TURNSTILE_SECRET_KEY`, but the client's section-key allowlists never included it, so admins could never see whether it was configured from this screen | **Fixed** â€” added to the "Production hardening" section |
| Hardcoded brand name in staff exports | `Share.share()` titles in `waitlist.tsx`/`ios-waitlist.tsx`/`users.tsx` hardcoded "Local Marketplace" instead of the buyer's configured app name | **Fixed** â€” all three now read `appDisplayName` from `useAppConfigStore` |

