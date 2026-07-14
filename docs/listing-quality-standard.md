# Listing Quality Standard

*Adopted 2026-07-14 (positioning/trust audit §14). Applies to admin seeding, community-submission review, and — eventually — wizard field prompts. A listing that answers these questions is complete; "For the land. For the people." is a slogan, not a description.*

The schema fields that back this: `official_source_url`, `last_verified_at`, `listing_status`, `doors_time`, `practical_info` (jsonb), plus the external-ticket columns — see `schema-reference.md`. Most answers are prose: they go in `description` (the story) or `practical_info` (the logistics), not in new columns.

## Civic events — must answer

| Question | Where it lives |
|---|---|
| Purpose — why gather, in one honest paragraph | `description` |
| Meeting point | `address` + `address_hint`, or `practical_info.meeting_point` |
| Start and estimated end | `time` / `end_time` |
| Route, if it moves | `practical_info.route` |
| Organizer / coordination channels | `organizer_name`, `telegram_link`, `whatsapp_link`, `organizer_contact` |
| Official source | `official_source_url` — renders as the primary "View official information" action |
| Accessibility | `practical_info.accessibility` |
| Public transport | `practical_info.transport` |
| Restrictions (what not to bring) | `practical_info.restrictions` |
| Safety expectations | `safety_notes` (existing civic field) |
| Registration required? | `practical_info.registration` |
| Last verified | `last_verified_at` — set it every time a human re-confirms details |
| Confirmed / changed / postponed / cancelled | `listing_status` — the page shows a banner; never silently edit a changed event |

## Normal events — must answer

| Question | Where it lives |
|---|---|
| What happens there / music or activity type | `description`, `tags`, `category` |
| Audience | `practical_info.audience` |
| Dress code | `practical_info.dress_code` |
| Age requirement | `age_restriction` |
| Doors open | `doors_time` |
| Start / end | `time` / `end_time` |
| Price | `price_from_cents` + `price_currency` (legacy `price` string as fallback) |
| Booking requirement | `ticket_url` + `ticket_sales_status`, or `practical_info.registration` |
| Accessibility | `practical_info.accessibility` |
| Parking / transport | `practical_info.parking`, `practical_info.transport` |
| Food & drink | `practical_info.food_drink` |
| Indoor or outdoor | `practical_info.indoor_outdoor` |
| Cancellation policy | `practical_info.cancellation_policy` |

## Rules

1. **Never invent an answer.** An absent `practical_info` key renders nothing — that is always better than a guessed answer. Blank beats wrong.
2. **Civic changes are announced, not edited away.** Date/venue changed → `listing_status = 'updated'` (or `'postponed'`), keep the page live. Cancelled → `listing_status = 'cancelled'`, row stays `published` so people learn it's off; the lifecycle `status` column is not touched.
3. **`last_verified_at` is a promise.** Only set it when someone actually checked the source. Stale beats false.
4. **Albanian parity applies** (bible standing rule 4): when the i18n sweep reaches event content, `practical_info` prose needs `sq` treatment like everything else.
