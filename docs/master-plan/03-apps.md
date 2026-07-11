# 03 — Apps Track (APP)

Goal: AlbaGo in the App Store and Play Store with a native-feeling experience — without rewriting a product that is already a polished mobile web app. Strategy: **PWA hardening (free, now) → Capacitor store shells (when store accounts exist) → native rewrite only if data demands it** (product-bible M19 gate).

## 1. Why this ladder (and not React Native now)

- The entire product is Next.js + Tailwind, mobile-first, already app-shaped (Instagram-style bottom nav, Google-Maps-style map screen, fixed viewports). A React Native rewrite duplicates ALL of it for months with zero new user value — the bible explicitly lists "native apps before M19" as premature.
- **Capacitor** wraps the real site in a real native shell with real native capabilities (push, camera, haptics, deep links). DICE-level polish is achievable because the web product already has it. One codebase keeps shipping to web + both stores simultaneously.
- The M19 gate then evaluates with data: if push reliability, cold-start, or iOS engagement show ceilings, an Expo app sharing the same Supabase/API layer is the planned escape hatch — the schema/API built in PAY/TIX is client-agnostic by design (RPCs + REST-ish routes, no web-only assumptions).

## 2. APP-1 — PWA hardening (zero cost, start anytime, benefits every current user)

- [x] **Manifest** (`app/manifest.ts`): name/short_name (AlbaGo), theme `#050505`, background ink, display `standalone`, start_url `/?source=pwa`, full icon set (192/512 + maskable — generate from the flame mark), shortcuts (Search, Map, My Tickets). *Shipped `91c69f5`; My Tickets shortcut deferred until TIX ships (route doesn't exist) — Search/Map/Events/Protests instead.*
- [x] **Service worker**: offline app shell + runtime caching (pages: network-first; static/posters: stale-while-revalidate). CRITICAL cache: **My Tickets must render offline** (venue basements have no signal — the DICE lesson). Next.js: hand-rolled SW or `serwist`; keep it minimal and auditable. *Shipped `2c39029`: hand-rolled `public/sw.js`, self-contained 4-language `offline.html`, `TICKET_ROUTES` slot ready for TIX-2.*
- [x] **Install surfaces**: `beforeinstallprompt` capture → tasteful "Add AlbaGo to your home screen" moment (after a save/ticket claim, never a nag popup); iOS Safari gets a one-time instructional sheet (Share → Add to Home Screen). *Shipped `5900b4c`: engagement event fires on successful save; 30-day dismiss memory; suppressed inside the Capacitor shell.*
- [x] **Web push**: `push_subscriptions` table (endpoint, keys, user_id, city, locale) + send worker via API route. Works on Android/desktop; **iOS requires the PWA installed (16.4+)** — this limitation is the main datapoint the M19 gate will weigh. First notification types: "your ticket event starts in 3h" (TIX tie-in), saved-event reminders, followed-organizer announcements. Civic notifications: opt-in only, never geo-targeted pushes to third parties (bible trust rules). *Code shipped `45495a7` (SW handlers, `lib/push/send.ts` fan-out w/ dead-endpoint cleanup, settings toggle, `/api/push/test`); GATED on user running `docs/seeds/app-1-push-subscriptions.sql`. Reminder/announcement send jobs are follow-up work once TIX/ORG-5 exist.*
- [ ] **Wake Lock + fullscreen QR** polish for tickets (TIX §4 dependency — blocked until TIX ships).
- **DoD:** Lighthouse PWA installable pass; offline reload shows shell + cached tickets; a test push lands on an installed Android PWA.

## 3. APP-2 — Store shells with Capacitor (Gate B: $25 Google one-time + $99/yr Apple)

**Architecture:** Capacitor project in-repo (`apps/shell/` or sibling folder), remote URL mode pointing at `https://www.albago.org` with a native splash + offline fallback page, plus a thin plugin bridge:

*Scaffolded 2026-07-11 ahead of Gate B: `apps/shell/` exists with Android + iOS projects generated, all five plugins installed and synced, native icons/splash baked, `ShellBridge` live on the web side. Store accounts + FCM/APNs remain the only blockers — see `apps/shell/README.md` for the Gate B runbook.*

- [ ] **Push**: FCM (Android) + APNs (iOS) via `@capacitor/push-notifications`; register tokens into the same `push_subscriptions` table (`kind: 'fcm' | 'apns' | 'webpush'`). Server send fan-out handles all three. *Plugin installed; token registration needs Firebase/APNs config (Gate B).*
- [ ] **Deep/universal links**: `apple-app-site-association` + `assetlinks.json` served from the domain; `/events/*`, `/map`, `/dashboard/tickets` open in-app. *Templates + fill instructions committed at `apps/shell/store/well-known/`; web-side `appUrlOpen` navigation already live in ShellBridge.*
- [ ] **Native niceties**: haptics on nav/scan verdicts, status-bar ink theming, share sheet passthrough, camera permission flow for door mode (native camera = better scan performance than web). *Status-bar ink theming live in ShellBridge; haptics plugin installed, call sites pending; camera flow is TIX door-mode work.*
- [ ] **App review compliance checklist** (the part that sinks first-time submissions):
  - Apple **3.1.3(e)/3.1.5**: tickets to real-world events are physical-world services → **external payment (Stripe) is REQUIRED-allowed, IAP not needed**. Never sell digital goods in-app without IAP (Studio access, if ever sold in-app, WOULD be IAP territory — sell it on web only, don't link to it from iOS; the Netflix/Spotify "reader" posture).
  - **Account deletion in-app** (Apple hard requirement): verify/ship a delete-account flow in /dashboard before submission.
  - **UGC rules** (both stores): report + block + moderation — report exists; add block-organizer stub if review demands.
  - Privacy nutrition labels / Data safety form: enumerate (email, saved events, location-when-in-use for map, push tokens, analytics events). Privacy policy page must match.
  - Demo account for App Review with a seeded ticket + a test event.
  - Geo: no region locks; content in 4 languages is a plus.
  - Screenshots/store listing ×4 languages, cinematic frames (poster-wall hero, map, ticket QR, protest hub). App name "AlbaGo — What's happening", category Events.
- [ ] **Versioning/release**: shell app updates are rare (only the bridge changes); the product updates continuously on the web side — this is the superpower of the shell approach. Play internal testing → closed → production; TestFlight → App Store.
- **DoD:** both store listings live; push arrives with app closed; universal link opens an event in-app; door mode scans via native camera.

## 4. APP-3 — Native evaluation gate (bible M19, ~Jan 2028 or when data forces it)

Decision inputs to collect from APP-1/2 (instrument now, decide later): push opt-in + delivery rates by platform · PWA/shell WAU retention vs web · cold-start and map FPS on mid-range Android · iOS install friction drop-off · crash/ANR rates in shells.
If ≥2 metrics show a real ceiling → Expo RN app sharing Supabase + the same RPC/API surface (built client-agnostic by PAY/TIX design); map via `@maplibre/maplibre-react-native`; ship screens in the order users live in them (Home feed → Event page → My Tickets → Map). Otherwise: double down on PWA + widgets.

## Decision Log (append here)

| Date | Decision | Why |
|---|---|---|
| 2026-07-10 | PWA → Capacitor → (gate) native ladder | Reuses the finished web product; store presence without a rewrite; bible M19 respected |
| 2026-07-10 | One `push_subscriptions` table for webpush/FCM/APNs | Single fan-out path; tokens are just rows with a kind |
| 2026-07-10 | Tickets use external payments on iOS (no IAP) | Apple 3.1.3(e) physical-world services; how DICE/Eventbrite/Fever all work |
| 2026-07-11 | Manifest shortcuts = Search/Map/Events/Protests (My Tickets deferred) | The tickets route doesn't exist until TIX-2; a dead shortcut is worse than none |
| 2026-07-11 | SW is hand-rolled (no serwist), offline page is a self-contained `public/offline.html` | Auditable per the track doc; a static file needs no JS chunks so it renders on a first-visit offline hit |
| 2026-07-11 | APP-2 scaffolded before Gate B (shell buildable locally, not submittable) | User asked to "prepare the apps professionally without publishing"; everything free was done, only paid accounts remain |
| 2026-07-11 | Deep-link files kept as templates in `apps/shell/store/well-known/`, not served | Both need Gate B values (Play signing SHA-256, Apple Team ID); serving placeholder files validates nothing |
| 2026-07-11 | Google sign-in must be fixed before store submission | Google blocks OAuth inside webviews; needs a system-browser auth plugin or hiding the button in the shell (noted in apps/shell/README.md) |
