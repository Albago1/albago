-- Phase 8 seed — Albanian Revolution: Tirana + Prishtina
-- Idempotent: ON CONFLICT (slug) DO NOTHING. Safe to re-run.
-- Apply via Supabase Studio → SQL editor (paste + Run).
-- Prereq: Phase 8 migration must already be applied (events.is_civic etc. must exist).

INSERT INTO events (
  slug, title, category, event_type, is_civic, featured_movement_slug,
  description, date, time, price, highlight, status,
  location_slug, country, region,
  organizer_contact, telegram_link, expected_attendees, safety_notes
) VALUES
(
  'albanian-revolution-tirana',
  'Tirana — Peaceful Civic Gathering',
  'civic', 'protest', true, 'albanian-revolution',
  'A peaceful civic gathering in the heart of Tirana to call for transparent institutions and a fair future. Open to all citizens. Bring water, comfortable shoes, and respect for fellow demonstrators.',
  '2026-07-04', '18:00', 'Free', true, 'published',
  'tirana', 'Albania', 'Tirana County',
  'tirana@albago.org', 'https://t.me/+example_tirana', 12000,
  'Peaceful and lawful. Coordinated with local authorities. Family-friendly, no alcohol, no political party signage. Stay hydrated and follow marshal instructions.'
),
(
  'albanian-revolution-prishtina',
  'Prishtina — Sheshi Nënë Tereza',
  'civic', 'protest', true, 'albanian-revolution',
  'Solidarity march for civic rights and transparent governance. Family-friendly, peaceful, and inclusive.',
  '2026-07-04', '17:30', 'Free', true, 'published',
  'prishtina', 'Kosovo', NULL,
  'prishtina@albago.org', 'https://t.me/+example_prishtina', 8000,
  'Peaceful and lawful. Inclusive event. No alcohol. Bring ID for entry to the central square.'
)
ON CONFLICT (slug) DO NOTHING;

-- Verify
SELECT slug, title, date, country, is_civic, featured_movement_slug, expected_attendees
FROM events
WHERE featured_movement_slug = 'albanian-revolution'
ORDER BY date, time;
