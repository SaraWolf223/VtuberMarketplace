# Local Marketplace — Deployment and DevOps

**Version:** 1.0

---

## 1. Environments

| Env | Supabase | Expo | Stripe |
|-----|----------|------|--------|
| Local | `supabase start` | dev client | test mode |
| Preview | `localmarketplace-dev` | EAS preview | test mode |
| Production | `localmarketplace-prod` | EAS production | live mode |

---

## 2. Environment variables

### 2.1 Expo (EAS Secrets)

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_MAPBOX_TOKEN=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID=
EXPO_PUBLIC_ADMOB_IOS_BANNER_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=   # Path B native Google
EXPO_PUBLIC_POSTHOG_KEY=
```

### 2.2 Supabase Edge secrets

```
SUPABASE_SERVICE_ROLE_KEY=  # auto in edge runtime
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
MAPBOX_ACCESS_TOKEN=
```

### 2.3 Local `.env` (gitignored)

Copy from `.env.example`.

---

## 3. Supabase deployment

```bash
# Link project
supabase link --project-ref <prod-ref>

# Push migrations
supabase db push

# Deploy functions
supabase functions deploy --project-ref <prod-ref>
```

**Cron:** Enable pg_cron in Supabase dashboard; schedule SQL jobs per **05-Backend**.

---

## 4. Expo EAS

### 4.1 `eas.json` profiles

| Profile | Use |
|---------|-----|
| `development` | Dev client, internal |
| `preview` | TestFlight / internal APK |
| `production` | Store release |

### 4.2 Build commands

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
eas submit --platform ios
eas submit --platform android
```

### 4.3 OTA updates (EAS Update playbook)

1. Publish to **`preview`** channel first; test on preview build
2. Production channel uses **`runtimeVersion`** matching native binary
3. **Staged rollout:** `eas update --rollout-percentage=10` → monitor → 100%
4. **Rollback:** republish previous update bundle from Expo dashboard
5. Use `expo-updates` on-demand check after critical fixes

**Never OTA:** native module changes (Google Sign-In, AdMob, Stripe SDK) — new `eas build` required.

See [Expo OTA best practices](https://expo.dev/blog/eas-update-best-practices).

---

## 5. CI (GitHub Actions minimal)

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run typecheck
```

Optional: `supabase db lint` on migration PRs.

---

## 6. Stripe production cutover

1. Complete Stripe business verification
2. Create live Products/Prices
3. Update Edge secrets to live keys
4. Register live webhook URL
5. Test $1 boost with real card in TestFlight

---

## 7. Domain & deep links

- `yourdomain.com` → marketing + legal pages
- `app.json` scheme: `localmarketplace`
- Apple Associated Domains / Android App Links for OAuth redirect

---

## 8. Backups

- Supabase Pro: enable PITR when on paid tier
- Export schema weekly: `supabase db dump -f schema.sql`
- Stripe data: rely on Stripe dashboard

---

## 9. Rollback plan

| Failure | Rollback |
|---------|----------|
| Bad migration | `supabase migration repair` + forward fix migration |
| Bad OTA | Roll back update channel in Expo dashboard |
| Bad Edge function | `supabase functions deploy` previous git tag |

---

## 10. Launch day checklist

- [ ] Prod Supabase migrated
- [ ] Edge functions deployed
- [ ] Stripe live webhooks 200 OK
- [ ] EAS production build uploaded
- [ ] Store listings approved
- [ ] Terms/Privacy URLs live
- [ ] Seed listings loaded in target city
- [ ] Monitor Supabase logs 24h

**After launch:** ongoing upkeep per [27-Platform_Maintenance_Runbook.md](./27-Platform_Maintenance_Runbook.md).
