# AlbaGo store shells (master plan APP-2)

Capacitor 8 project wrapping **https://www.albago.org** in real native Android
and iOS apps. Remote URL mode: the product ships continuously on the web side;
these shells only change when the native bridge does.

```
apps/shell/
├── capacitor.config.ts   appId org.albago.app, remote server.url
├── www/                  offline fallback shown before first successful load
├── assets/               icon + splash sources (regenerate: npm run assets)
├── android/              generated Android Studio project (committed)
├── ios/                  generated Xcode project, SPM plugins (committed)
└── store/well-known/     deep-link file TEMPLATES (fill + serve at Gate B)
```

Installed native plugins (registered via `npx cap sync`):
`app` (deep links, back button), `haptics`, `push-notifications`,
`splash-screen`, `status-bar`. The web app talks to them through the injected
`window.Capacitor` bridge — see `components/pwa/ShellBridge.tsx` in the main
repo; nothing Capacitor-specific is bundled into the website.

## Build locally (free, no store accounts)

**Android** — install Android Studio, open `apps/shell/android`, let Gradle
sync, then Run on an emulator/device or `Build → Build APK`. Requires JDK 17+
(bundled with Android Studio).

**iOS** — requires a Mac with Xcode: `npx cap open ios`, select the App
target, set your personal team for a free on-device dev build. Plugins are
Swift Package Manager based (no CocoaPods needed).

After changing `capacitor.config.ts` or plugin versions: `npm run sync`.
After changing `assets/`: `npm run assets && npm run sync`.

## Gate B checklist (needs money/accounts — user P0)

1. Google Play developer account ($25 one-time) · Apple Developer Program
   ($99/yr).
2. Firebase project (free) for FCM → download `google-services.json` into
   `android/app/`. APNs key in the Apple account for iOS push. Then wire
   push-notification registration in ShellBridge (tokens go into the same
   `push_subscriptions` table with kind `fcm`/`apns` — schema is ready).
3. Fill + deploy `store/well-known/` files (see its README) for app links /
   universal links.
4. Play App Signing + upload keystore (Play Console generates/holds the
   signing key). Apple signing via Xcode automatic signing.

## App review compliance (from master plan 03-apps.md — verify before submit)

- **Apple 3.1.3(e)/3.1.5** — tickets to real-world events are physical-world
  services: external payment (Stripe) is the correct and allowed path, no IAP.
  Never sell digital goods (e.g. Studio access) inside the iOS app and do not
  link to a web paywall from the app (reader-app posture).
- **Account deletion in-app** — ✅ already live (`/dashboard` → Account →
  DeleteAccountButton).
- **UGC** — report exists on event pages; if review asks, add block-organizer.
- **Privacy labels / Data safety** — declare: email, saved events,
  location-when-in-use (map), push tokens, analytics. Must match the privacy
  policy page.
- **Demo account** for review with a seeded ticket + test event.
- **Google sign-in inside a webview is blocked by Google.** Email flows work;
  before submission either add a system-browser auth plugin (e.g. Custom
  Tabs / ASWebAuthenticationSession) for the Google button or hide it when
  `window.Capacitor` is present. Track this as an APP-2 pre-submission task.
- Store listing: name "AlbaGo — What's happening", category Events,
  screenshots ×4 languages, cinematic frames (poster wall, map, ticket QR,
  protest hub).

## Release ladder

Play: internal testing → closed → production. iOS: TestFlight → App Store.
Shell updates are rare by design — releasing a web feature never requires a
store release unless the native bridge changed.
