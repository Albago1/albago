# 04 — Organizer Ecosystem Track (ORG)

Audited 2026-07-11 against the anchors: RA promoter tools, DICE partner portal, Airbnb host trust ladder, Eventbrite organizer machinery. Verdict: **the architecture is already right — progressive trust is exactly how the best do it — but the finish is not world-class yet.** The gaps are specific and fixable in stages.

## 1. What ALREADY exists (do not rebuild — polish)

| Piece | State |
|---|---|
| Apply funnel | `/become-organizer` (pitch page) → `/onboarding/organizer` (application + survey) → `create_organizer()` RPC |
| Trust ladder | 3 tiers on `organizers.verification_tier`: `unverified` (every event admin-reviewed) → `established` (auto-earned: 2 approved events in 90 days → instant publish) → `verified` (application: phone + ID doc upload to `organizer-verification` bucket → admin review → public badge + instant publish + repost rights) |
| Badge surfaces | Event page organizer block, organizer public profile (`/organizers/[slug]`), organizers directory |
| Organizer dashboard | Audience stats, 14-day sparklines + trends, activity feed, next-event countdown card, top-events leaderboard, event rows w/ status pills, Preview modal, Share w/ Studio access, weekly quota |
| Admin review | `/admin/organizers` — pending ID queue, approve/reject with REQUIRED rejection notes |
| Event creation | 8-step wizard (type → basics → category → when → where → media → organizer → review), drafts in localStorage, preview replica, 3 modes (organizer/submission/admin) |

This is genuinely the Airbnb-host-trust shape. The user's asks ("apply to become organizer", "badge if verified") are BUILT — the work is making them flawless.

## 2. The honest gap list (world-class delta)

1. **The organizer world is English-only.** `become-organizer`, onboarding, verification, dashboard, wizard — zero `useLanguage` usage. The platform law is native ×4 (en/sq/de/es); an Albanian organizer applying for verification in English is the single most un-professional thing on these surfaces today. **Biggest gap, purely mechanical to fix.**
2. **The UI promises emails that are never sent.** Verification page says "You'll be notified by email when there's an update" — no Resend call exists anywhere in the review flow. Application submitted → silence. Approved/rejected → silence (rejection notes only visible if the organizer happens to revisit the page). Best platforms narrate every state change. **Trust-critical.**
3. **No payments/payouts in the dashboard** — correct per master plan (Gate A not passed), but the dashboard should grow a Balance/Sales area the day PAY-3 ships. Payout profile (IBAN capture) can ship earlier so payouts are instant when money arrives.
4. **Badge reach:** verified badge missing from event *cards* (organizer attribution isn't on cards at all — matches DICE/RA convention, fine) and from search/suggestion rows. Low priority; decide with data.
5. **No organizer follow loop yet** (bible §7: follows → report cards → Pro upsell). Future track, not a polish gap.
6. **Wizard details:** no autosave-to-server (localStorage only — device-locked drafts), no image quality guidance, no duplicate-event detection. Nice-to-haves; not embarrassing.

## 3. Staged plan

### ORG-1 — Keep the promises (emails) — SMALL, ship first
- [ ] Resend templates: application received (to organizer), verification submitted, verification approved (celebratory, badge explained), verification rejected (notes included, "you can reapply"), event approved/rejected (if not already sent by queue — verify).
- [ ] Wire into review RPC path (server-side, service role) + submission flow.
- [ ] Admin organizers queue: link into AdminTopBar/command palette if missing.
- **DoD:** rejecting a test submission delivers the note by email within seconds.

### ORG-2 — i18n the public trust funnel ×4
- [ ] `become-organizer`, `/onboarding/organizer`, `/organizer/verification` fully keyed (en/sq/de/es, natively phrased; Albanian first-class — this is the audience).
- **DoD:** language switcher on all three; key-count parity check.

### ORG-3 — i18n dashboard + wizard ×4
- [ ] `OrganizerDashboardClient` (~974 lines) + all 8 wizard steps + `EventCreationWizard` shell.
- Mechanical but large; split into two commits (dashboard, wizard).

### ORG-4 — Dashboard money-readiness (pairs with PAY-3, profile part can ship anytime)
- [ ] `organizer_payout_profiles` capture UI (legal name, IBAN, country) behind verification-tier gate — verified organizers only.
- [ ] Balance card + sales list placeholders that light up when PAY-3 ledger lands.

### ORG-5 — Badge ubiquity + follow loop (bible §7, post-traction)
- [ ] Follow button on organizer profiles; follower count for organizer; notification fan-out (APP-1 push infra).
- [ ] Badge in any new surface that names an organizer (search rows, cards if attribution ever added).

## Decision Log

| Date | Decision | Why |
|---|---|---|
| 2026-07-11 | Polish existing 3-tier system; do NOT redesign it | The ladder (auto-earned Established + applied Verified) already matches Airbnb/RA best practice |
| 2026-07-11 | Emails before i18n before features | A lying UI ("we'll email you") is worse than an untranslated one; both beat new features (bible: features without follow-through feel like noise) |
