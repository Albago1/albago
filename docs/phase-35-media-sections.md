# Phase 35 — Named photo sections + independent cover

Two upgrades to event media, both authored in the wizard's Media step.

## 1. Cover independence

The cover is always `gallery_urls[0]` (a DB trigger keeps `banner_url` in
lockstep). Historically the public page showed the cover in the hero **and**
repeated it as the first tile of the gallery deck. A new per-event flag
`cover_in_gallery` (default `true`, preserving the old look) lets the organizer
turn that repeat off, so the deck shows only the non-cover shots.

- **UI**: a checkbox in `MediaStep` ("Show the cover again in the gallery").
- **Render**: `app/events/[slug]/page.tsx` drops `gallery_urls[0]` from the deck
  passed to `EventGallery` when the flag is `false`.

## 2. Named photo sections

An ordered list of `{ title, body, urls[] }` (column `content_sections jsonb`),
rendered as on-brand bands **below** the main gallery — e.g. "The Venue",
"Lineup". Modelled on Airbnb photo-tour groups + a per-group blurb. Additive to
`gallery_urls`, not a replacement.

- **UI**: `MediaSectionsEditor` (add / remove / reorder sections; per-section
  title, blurb, and photo add/remove).
- **Render**: `EventSections` bands + shared `PhotoLightbox` (extracted from
  `EventGallery` so both use one viewer).

## Data flow (why no fragile RPC was rewritten)

`banner_url`/`gallery_urls` still go through the existing create/update RPCs
untouched. The two new fields are written by **new, self-contained** RPCs called
right after the row exists (fail-soft, exactly like ticket tiers):

| Path | Media persistence |
|------|-------------------|
| Organizer create (`organizer_create_event_v2`) | `set_event_media` after |
| Organizer update (`organizer_update_event`)     | `set_event_media` after |
| Admin wizard (direct `events` insert)           | inline columns |
| Community submit (`submit_event_submission`)    | `set_submission_media` after → carried into `events` on approve |

Both RPCs run every incoming sections array through
`_normalize_media_sections` (known keys only, title/body length caps, empty
sections dropped), so a client can never store arbitrary jsonb.

## Migration

`docs/seeds/phase-35-media-sections.sql` — additive columns on `events` +
`event_submissions`, plus `_normalize_media_sections`, `set_event_media`,
`set_submission_media`. Idempotent; reverse by dropping the three functions and
four columns. **Must be applied in Supabase before the feature works end-to-end.**

## Touched files

- `types/eventDraft.ts` — `MediaSection`, draft fields, `normalizeSections`
- `components/event-wizard/steps/MediaStep.tsx` + `MediaSectionsEditor.tsx`
- `lib/wizardSubmit.ts` — all four write paths
- `app/organizer/create/CreateEventClient.tsx` — edit-mode hydration
- `app/admin/AdminClient.tsx` — submission type + approve mapping + preview
- `app/events/[slug]/page.tsx` — query + cover de-dupe + sections
- `components/events/PhotoLightbox.tsx` (new), `EventSections.tsx` (new)
- `components/EventGallery.tsx` — reuse `PhotoLightbox`
- `components/events/EventPagePreview.tsx` + `ReviewStep.tsx` — preview parity
