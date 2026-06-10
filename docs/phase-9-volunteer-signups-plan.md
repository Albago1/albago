# Phase 9 — Volunteer Signups

**Status:** Implemented.
**Scope:** A public sign-up form at `/volunteer` for civic movements. Captures name, contact, city, role preferences, and an availability note. No account required.
**Compatibility:** Additive only. New table; nothing existing changes.

---

## 1. Goal

Phase 8 promised a `/volunteer` route (§6.7 of `phase-8-civic-events-plan.md`) but only stubbed the role chips in the Albanian Revolution page. Phase 9 actually ships the route, the data table, and a Server Action so volunteers can sign up without creating an AlbaGo account.

The table is intentionally simple — admins read it directly in Supabase Studio until a moderator dashboard is built (deferred, see §6).

---

## 2. SQL migration (run in Supabase SQL editor)

The full SQL lives in `docs/seeds/phase-9-volunteer-signups.sql`. Summary:

```sql
CREATE TABLE IF NOT EXISTS volunteer_signups (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz   NOT NULL DEFAULT now(),
  name              text          NOT NULL,
  email             text          NOT NULL,
  phone             text,
  city              text          NOT NULL,
  country           text,
  roles             text[]        NOT NULL,
  availability_note text,
  movement_slug     text,
  status            text          NOT NULL DEFAULT 'new'
);

ALTER TABLE volunteer_signups ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (form submissions). No SELECT policy ⇒ nobody reads via API.
CREATE POLICY "Public can submit volunteer signups"
  ON volunteer_signups FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
```

Notes:
- `roles` is `text[]` — the application currently writes role keys: `organizer`, `designer`, `video-editor`, `translator`, `marshal`, `social`, `driver`, `legal-observer`.
- `movement_slug` is nullable. `/volunteer` defaults it to `albanian-revolution`, but the form is generic; later pages can pass any slug via `?movement=...`.
- `status` lifecycle: `new` → `contacted` → `confirmed` / `declined`. Enforced by the app, not by a DB CHECK constraint (kept loose for now).
- No SELECT policy is added on purpose. Reads happen via admin tooling that uses the service role; the public API cannot enumerate signups.

---

## 3. Application surface

| File | Role |
|---|---|
| `app/volunteer/page.tsx` | Server component. Reads `?movement=…` and renders the client form. |
| `app/volunteer/VolunteerClient.tsx` | Cinematic form: name, email, phone, city, country, role multi-select, availability note. |
| `app/volunteer/actions.ts` | Server Action `submitVolunteerSignup` — server-side validation, INSERT via the server Supabase client, structured `{ ok, error }` result. |
| `app/events/albanian-revolution/AlbanianRevolutionClient.tsx` | "Volunteer" CTAs now link to `/volunteer?movement=albanian-revolution` (was `/become-organizer`). |
| `app/protests/ProtestsClient.tsx` | Helper strip gains a "Volunteer" tile linking to `/volunteer`. |

The Server Action handles the "table missing" case (PostgREST error code `PGRST205` / `42P01`) so the page can render the form before the migration is applied — the submit will return a clear error pointing to this doc.

---

## 4. Validation rules

Performed in the Server Action (`actions.ts`):

- `name`: trimmed, length 2–80.
- `email`: simple regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, lowercased before insert.
- `phone`: optional; if present, length ≤ 40; not validated for format (international numbers vary).
- `city`: trimmed, length 1–80.
- `country`: optional, length ≤ 80.
- `roles`: array, length 1–8, each value must be in the canonical role-key set.
- `availability_note`: optional, length ≤ 600.
- `movement_slug`: optional, length ≤ 80.

Errors return `{ ok: false, error: 'message' }`. Success returns `{ ok: true }`. The client switches to a thank-you state on success.

---

## 5. RLS / privacy notes

- Public INSERT is intentionally allowed. This is a sign-up form — we want low friction.
- No SELECT policy. Even with the anon key, nobody can list signups via the PostgREST API. Only the service role (used by Supabase Studio and future admin tooling) can read.
- Rows contain PII (name, email, phone). The app never exposes them in any UI or RPC. Add a SELECT policy keyed on `auth.uid()` only when a moderator dashboard is built (Phase 9B, deferred).
- Rate limiting is not implemented in the app. Supabase project-level rate limits apply. If abuse appears, add a per-IP throttle via Middleware before tightening RLS.

---

## 6. Out of scope (deferred)

- Moderator dashboard (`/admin/volunteers`) — list, filter, mark contacted, export CSV.
- Auto-acknowledgement email via a Supabase Edge Function or Resend integration.
- Role-skill matching against open organizing requests.
- Per-movement landing pages (`/volunteer/[movement-slug]`) with custom copy.
- Telegram/WhatsApp deep-link auto-join.
