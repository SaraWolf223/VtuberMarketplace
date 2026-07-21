# Device QA setup — emulator, Android phone, iPhone

Use this for **final testing** (Stripe, Google sign-in, native modules). **Expo Go is not enough** — use a **development build** (debug APK / EAS iOS build).

---

## Prerequisites (all devices)

1. `.env` filled: Supabase URL/anon key, Google Web Client ID, Stripe `pk_test_...`, Mapbox token.
2. Metro running from project root.
3. Same Wi‑Fi for PC and phones (for physical devices).

| Command | Use when |
|---------|----------|
| `npm run start` | **Emulator only** (localhost + `adb reverse`) |
| `npm run start:lan` | **Physical Android + iPhone** (LAN IP) |
| `npm run qr` | Prints LAN URL + writes `expo-qr.png` (Expo Go only; dev build uses installed app) |

---

## Android emulator (Windows)

1. Start emulator: `npm run android:emu` (opens a separate PowerShell window) **or** Android Studio → Device Manager → **Pixel_6** → Play.
2. Wait until `adb devices` shows `emulator-XXXX   device` (not `offline`).
3. Metro: `npm run start`
4. Install + open app (first time or no APK): `npm run android:install` or full `npm run android:build`
5. Daily open: `npm run android:open` (needs Metro on 8081)

**Stripe / Google:** Works on this debug APK.

---

## Android phone (physical)

1. **Build once** (if no APK): `npm run android:build` → produces `android\app\build\outputs\apk\debug\app-debug.apk`
2. Copy APK to phone (USB, Drive, email) and install (allow unknown sources), **or** USB:
   ```text
   adb install -r android\app\build\outputs\apk\debug\app-debug.apk
   ```
3. PC + phone on **same Wi‑Fi**.
4. Metro: `npm run start:lan` (not `start` — phone cannot use `localhost`).
5. Open **Local Marketplace** on the phone (dev client). It loads JS from your PC’s LAN IP on port **8081**.
6. If it cannot connect: Windows Firewall → allow Node/Metro on private networks; note your PC IP (`ipconfig` → IPv4).

**Google OAuth:** Add your debug SHA-1 to Google Cloud (Android OAuth client) if sign-in fails on device.

---

## iPhone (physical)

You need a **Mac** for local `expo run:ios --device`, **or** an **EAS internal build** from Windows:

### Option A — EAS preview (from Windows)

```bash
npx eas login
npm run eas:build:preview:ios
```

Install the build via the link EAS prints (internal distribution). Register device UDID if prompted.

### Option B — Mac + USB

```bash
npm run start:lan
npx expo run:ios --device
```

Metro must use `--lan` so the phone reaches your Mac/PC bundler.

**Stripe on iOS:** TestFlight/dev build with Stripe configured; public App Store may require IAP (see 10-Monetization_System.md §2).

---

## Quick health checks

| Check | Pass |
|-------|------|
| Metro | Browser `http://localhost:8081/status` → `packager-status:running` |
| Emulator | `adb devices` → `device` |
| Supabase | Sign-in works |
| Stripe test | Card `4242 4242 4242 4242` |

---

## QA checklist

Track progress in [PROJECT_BACKLOG.md](../PROJECT_BACKLOG.md) → **Device QA tracker**.
