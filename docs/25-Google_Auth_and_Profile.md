# Local Marketplace — Auth & Profile (Google, Apple, Email/Password)

**Version:** 2.0
**Status:** Required for MVP
**Rule:** Users sign in with **Google**, **Apple** (iOS only), or **email/password**. Google/Apple accounts get their **profile auto-populated from the provider**; email/password accounts enter a display name on sign-up. There is no separate "create profile" wizard beyond that.

> This doc originally covered Google-only auth. It's kept as the primary reference for the **Google** path and the shared profile-sync model; see [08-Cursor_Prompts.md](./08-Cursor_Prompts.md) and the auth source (`src/lib/auth/`, `src/features/auth/syncProfileFromAuthUser.ts`) for the generalized multi-provider implementation. Code samples below that say "Google-only" describe the original Path A/B OAuth flow, which is still used for the Google button specifically.

---

## 1. Product requirements

| Requirement | Detail |
|-------------|--------|
| Sign-in methods | **Google OAuth**, **Apple Sign-In** (iOS only — required once other account-creation methods exist, App Store Guideline 4.8), **email/password** |
| Profile source | Google/Apple account data synced into `profiles` automatically; email/password accounts provide a display name on sign-up |
| No manual signup (Google/Apple) | First sign-in creates account + profile automatically |
| Manual signup (email/password) | Sign-up form collects display name, email, password; optional email confirmation before first sign-in |
| Avatar | **Provider profile photo** for Google (and Apple, when shared) — used everywhere (feed, detail, profile); email/password accounts have no avatar until a future custom-upload feature ships |
| Display name | Provider name, or the name entered at sign-up for email/password; `@username` for links |
| Email | Stored from the provider or entered at sign-up; **never** shown publicly |
| Username | Auto-generated from display name; user may **edit once** in settings |
| Password reset | Email/password accounts: `forgot-password` screen emails a reset link → `reset-password` screen sets a new password |
| 2FA | Optional TOTP for any account; mandatory for `admin`/`manager` roles (see security settings screen) |

**Non-goals (MVP):**

- Custom profile photo upload for email/password accounts
- Social login providers beyond Google/Apple (e.g. Facebook, Twitter/X)
- SMS-based 2FA (TOTP only)

---

## 2. User experience

### 2.1 Sign-in screen

- Primary buttons: **"Continue with Google"** and, on iOS, **"Sign in with Apple"**
- A divider, then email + password fields with a "Sign in" button
- Subtext: "Continue with Google, Apple, or your email and password."
- Links: "Forgot password?", "Create account" (→ sign-up), Terms + Privacy

### 2.2 After first sign-in

```
Google OAuth success
  → Profile row created/updated from Google
  → If no ZIP in user_prefs → Location setup modal
  → Else → Home feed
```

**No** “choose username” or “upload photo” step on first launch.

### 2.3 Profile screen (own)

| UI element | Source |
|------------|--------|
| Large avatar | `profiles.avatar_url` (Google) |
| Name line | `profiles.display_name` (Google) |
| Subtitle | `@username` |
| Email row (settings only) | `profiles.email` — read-only, labeled “Google account” |

### 2.4 Public seller profile

Shows: Google avatar, display name, `@username`, ratings, listings — **not** email.

### 2.5 Sign-out / return

- Sign out clears session and React Query cache
- Next sign-in with **same** Google account → same `profiles.id` (UUID from `auth.users`)

---

## 3. Implementation paths (choose one for MVP)

| Path | When | Package |
|------|------|---------|
| **A — Browser OAuth** | Fastest MVP; OK for first TestFlight | `expo-web-browser` + `signInWithOAuth` |
| **B — Native Google** | OAuth redirect flaky on Android/iOS | `@react-native-google-signin/google-signin` + `signInWithIdToken` |

**Decision:** Start with **A**; ship **B** via prompt `02b` if needed.

---

## 3.1 Supabase + Google Cloud checklist

**Supabase → Auth → Google:**

- Enable provider
- Web Client ID + Secret
- **Authorized Client IDs:** include Web + Android (comma-separated)
- For Path B: enable **Skip nonce checks** (required for some native flows)

**Google Cloud Console:**

1. OAuth consent screen (External) + **test users** for dev
2. Create **Web** Client ID → use as `webClientId` in native code (Path B)
3. Create **Android** Client ID → SHA-1 fingerprints (debug + release + Play)
4. Create **iOS** Client ID → bundle ID + URL scheme in `app.json`

**Critical (Path B):** In app code use **Web Client ID** in `GoogleSignin.configure({ webClientId })` — NOT Android/iOS client IDs (causes `DEVELOPER_ERROR`).

**Android SHA-1:**

```bash
keytool -keystore android/app/debug.keystore -list -v -alias androiddebugkey -storepass android
```

Add SHA-1 to Google Cloud Android OAuth client.

---

## 3.2 Path A — Browser OAuth (MVP default)

```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: makeRedirectUri({ scheme: 'localmarketplace', path: 'auth/callback' }),
    skipBrowserRedirect: false,
  },
});
```

`onAuthStateChange` → `SIGNED_IN` → `syncProfileFromGoogle(user)`.

---

## 3.3 Path B — Native Google Sign-In

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID! });

const { data } = await GoogleSignin.signIn();
const idToken = data?.idToken;
await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken! });
```

Then `syncProfileFromGoogle(session.user)`.

---

## 3.4 Avatar URL quality

Prefer Google picture URL with size param when available: append `=s400` to `lh3.googleusercontent.com` paths for sharper avatars in listing UI.

---

## 4. Provider → profile field mapping

| Supabase `user` field | `profiles` column | Notes |
|----------------------|-------------------|--------|
| `id` | `id` | PK, FK to `auth.users` |
| `email` | `email` | Required; owner-only visibility |
| `user_metadata.full_name` or `.name`, or sign-up display name for email/password | `display_name` | Public display name |
| `user_metadata.avatar_url` or `.picture` (Google only) | `avatar_url` | Public; refresh on sync; `null` for Apple/email |
| Generated | `username` | See §5 |
| `raw_app_meta_data->>'provider'` (`google`/`apple`/`email`) | `auth_provider` | Detected per-session, not hardcoded — see `syncProfileFromAuthUser` |
| `created_at` | `created_at` | First insert only |

---

## 5. Username generation

**On first profile create:**

1. Take `display_name` from Google (e.g. `"Jane Doe"`).
2. Normalize: lowercase, spaces → `_`, strip non `[a-z0-9_]`.
3. Truncate to 24 chars.
4. If length < 3, use `user` + first 8 chars of `id`.
5. If collision, append `_2`, `_3`, … until unique.

**User edit (settings):**

- Allow change **once per 7 days** (enforce in app + optional DB `username_changed_at`).
- Validate: 3–24 chars, `^[a-zA-Z0-9_]+$`, unique case-insensitive.

**Do not** let username edit change `display_name` — that stays tied to Google unless we add manual override later (post-MVP).

---

## 6. Profile sync (`syncProfileFromAuthUser`)

Run on:

- `SIGNED_IN` event
- App cold start when session exists (once per launch)

Generalized (see `src/features/auth/syncProfileFromAuthUser.ts`) to detect the provider from `user.app_metadata.provider` and skip avatar sync for non-Google providers:

```typescript
async function syncProfileFromAuthUser(user: User, opts?: { displayNameOverride?: string }) {
  const provider = detectProvider(user); // 'google' | 'apple' | 'email'
  const meta = user.user_metadata ?? {};
  const display_name =
    opts?.displayNameOverride ??
    meta.full_name ?? meta.name ?? user.email?.split('@')[0] ?? 'User';
  const avatar_url = provider === 'google' ? (meta.avatar_url ?? meta.picture ?? null) : null;

  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email!,
      display_name,
      avatar_url,
      auth_provider: provider,
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: false }
  );

  // If insert (no row before), set username via Edge or RPC generate_username
}
```

**Important:** Upsert updates `display_name` and `avatar_url` for Google when the user changes them on their Google account. Apple only shares name on the *first* authorization ever (Apple's privacy design) — the app captures it then via `displayNameOverride`; email/password accounts always keep the name entered at sign-up unless the user edits it later.

---

## 7. Database changes

Add to `profiles`:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'email';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;
```

`auth_provider` is set per-session from the actual provider (`'google'`, `'apple'`, or `'email'`) by `syncProfileFromAuthUser` / `upsert_user_prefs_location` — it is **not** hardcoded to `'google'` anywhere in the current implementation.

`profiles_public` view includes: `id`, `username`, `display_name`, `avatar_url`, `rating_avg`, `rating_count`, `listing_count`, `is_premium`, `created_at` — **excludes** `email`, `phone`.

### 7.1 Trigger (server-side backup)

`on_auth_user_created` (Edge or DB trigger on `auth.users`):

- Same mapping as §4–5
- Ensures profile exists even if client sync fails

---

## 8. Edge function: `sync-google-profile`

Optional dedicated endpoint for username generation + upsert:

```
POST /functions/v1/sync-google-profile
Authorization: Bearer <jwt>
```

**Logic:**

1. Read user from JWT
2. Map Google metadata → profile fields
3. If new user → generate unique username
4. Upsert `profiles`
5. Return `profiles_public` shape

---

## 9. RLS

| Policy | Rule |
|--------|------|
| `profiles` SELECT (public) | Via `profiles_public` view only |
| `profiles` UPDATE | `auth.uid() = id` — may update `username`, `phone`; **not** `email` or `auth_provider` |
| `profiles` INSERT | Service role or `auth.uid() = id` on upsert from own session |

Client **cannot** set arbitrary `avatar_url` in MVP — it's only ever written server/client-side from a trusted provider field (Google `avatar_url`/`picture`), never from free-form user input; email/password and Apple accounts get `null` and rely on the default avatar in UI.

---

## 10. Listing seller display

Listing cards and detail show:

```
[avatar] display_name · @username
```

Fallback if `display_name` empty: `@username` only.

---

## 11. Acceptance criteria

- [ ] Google, Apple (iOS), and email/password all work on sign-in
- [ ] New Google/Apple user gets profile with provider photo (Google) + name without extra steps
- [ ] New email/password user completes sign-up with a display name and (if enabled) confirms their email before first sign-in
- [ ] Returning user sees updated Google avatar if changed on Google
- [ ] Email/password user can reset a forgotten password via emailed link
- [ ] Email visible only in own settings, read-only
- [ ] Public profiles never expose email
- [ ] Sign-out and re-sign-in preserves same account and listings, regardless of provider used

---

## 12. Implementation reference

| Doc | Section |
|-----|---------|
| [08-Cursor_Prompts.md](./08-Cursor_Prompts.md) | Prompt **02 — Google auth** |
| [04-API_Endpoints.md](./04-API_Endpoints.md) | §2 Authentication, §3 Profiles |
| [06-Frontend_Structure.md](./06-Frontend_Structure.md) | Sign-in, profile screens |
| [03-Database_Schemas.md](./03-Database_Schemas.md) | `profiles` table |
| [21-Edge_Functions_Spec.md](./21-Edge_Functions_Spec.md) | `on-auth-user-created`, `sync-google-profile` |

---

## 13. Account deletion (GDPR-ready)

- Settings → Delete account
- Edge function: delete `auth.users` (service role), cascade `profiles`, anonymize retained moderation logs
- Revoke the active provider session client-side on delete (Google/Apple native session, or just the Supabase session for email/password)

---

## 14. Open decisions

| ID | Decision |
|----|----------|
| GAP-1 | Username change **once per 7 days** |
| GAP-2 | Custom avatar → **post-MVP** |
| — | Auth path A first, B fallback — **decided** |

---

## 15. Revision

| 1.1 | 2026-05-22 | Path A/B, SHA-1, Web Client ID, skip nonce, avatar size |
| 2.0 | 2026-07-13 | Generalized to multi-provider (Google + Apple + email/password), `syncProfileFromAuthUser`, password reset flow, mandatory 2FA for staff |
