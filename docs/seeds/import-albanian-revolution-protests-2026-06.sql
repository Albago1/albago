-- One-off data import: Albanian Revolution diaspora protests, 13–15 June 2026.
--
-- Idempotent — re-running is a no-op for any row whose
-- (location_slug, date, time, address) already exists in public.events.
-- Adds a deterministic slug suffix so the events.slug uniqueness constraint
-- never collides even if other events with the same city+date were ever
-- created from a different source.
--
-- Geocoded by hand (well-known landmarks + street addresses); accuracy
-- ≈ 10–50 m for public squares and ≈ 50–150 m for the specific street
-- addresses. Re-pin individual events in /admin if you want a tighter fix.

with src (
  city_label, slug_suffix, country, region, address,
  date_v, time_v, end_time_v, timezone,
  lat, lng
) as (values
  ('Berlin',                'berlin',         'Germany',         'Berlin',                       'Lustgarten, 10178 Berlin, Germany',                          '2026-06-14'::date, '12:00'::text, null::text,    'Europe/Berlin',     52.519050::double precision,  13.400390::double precision),
  ('Zürich',                'zurich',         'Switzerland',     'Zürich',                       'Europaplatz, 8004 Zürich, Switzerland',                      '2026-06-15'::date, '18:00'::text, '21:00'::text, 'Europe/Zurich',     47.376888::double precision,   8.531350::double precision),
  ('Athens',                'athens',         'Greece',          'Attica',                       'Syntagma Square, Athens 10557, Greece',                      '2026-06-14'::date, '19:00'::text, null::text,    'Europe/Athens',     37.975540::double precision,  23.734880::double precision),
  ('London',                'london',         'United Kingdom',  'England',                      '33 St George''s Drive, London SW1V 4DG, United Kingdom',     '2026-06-13'::date, '15:00'::text, null::text,    'Europe/London',     51.490630::double precision,  -0.139620::double precision),
  ('Hamburg',               'hamburg',        'Germany',         'Hamburg',                      'Rathausmarkt, 20095 Hamburg, Germany',                       '2026-06-13'::date, '17:00'::text, null::text,    'Europe/Berlin',     53.550340::double precision,   9.992190::double precision),
  ('Melbourne',             'melbourne',      'Australia',       'Victoria',                     '328 Swanston Street, Melbourne VIC 3000, Australia',         '2026-06-13'::date, '13:00'::text, '14:30'::text, 'Australia/Melbourne', -37.809580::double precision, 144.964840::double precision),
  ('Milan',                 'milan',          'Italy',           'Lombardy',                     'Piazza Castello, 20121 Milano, Italy',                       '2026-06-13'::date, '16:00'::text, '18:00'::text, 'Europe/Rome',       45.470770::double precision,   9.179400::double precision),
  ('Philadelphia',          'philadelphia',   'United States',   'Pennsylvania',                 '1400 John F Kennedy Blvd, Philadelphia, PA 19107, USA',      '2026-06-13'::date, '18:00'::text, '20:00'::text, 'America/New_York',  39.953260::double precision, -75.163850::double precision),
  ('Arezzo',                'arezzo',         'Italy',           'Tuscany',                      'Piazza Risorgimento, 52100 Arezzo, Italy',                   '2026-06-13'::date, '18:00'::text, null::text,    'Europe/Rome',       43.466470::double precision,  11.880780::double precision),
  ('Novara',                'novara',         'Italy',           'Piedmont',                     'Piazza Antonio Gramsci, 28100 Novara, Italy',                '2026-06-13'::date, '18:00'::text, null::text,    'Europe/Rome',       45.448710::double precision,   8.622710::double precision),
  ('Troy (Michigan)',       'troy-michigan',  'United States',   'Michigan',                     '520 W Big Beaver Rd, Troy, MI 48084, USA',                   '2026-06-14'::date, '16:00'::text, null::text,    'America/Detroit',   42.565500::double precision, -83.166830::double precision),
  ('Düsseldorf',            'dusseldorf',     'Germany',         'North Rhine-Westphalia',       'Marktplatz, 40213 Düsseldorf, Germany',                      '2026-06-13'::date, '17:00'::text, null::text,    'Europe/Berlin',     51.225680::double precision,   6.773070::double precision),
  ('Stuttgart',             'stuttgart',      'Germany',         'Baden-Württemberg',            'Kleiner Schlossplatz, 70173 Stuttgart, Germany',             '2026-06-13'::date, '16:00'::text, null::text,    'Europe/Berlin',     48.778250::double precision,   9.179580::double precision),
  ('Munich',                'munich',         'Germany',         'Bavaria',                      'Geschwister-Scholl-Platz, 80539 München, Germany',           '2026-06-14'::date, '16:00'::text, null::text,    'Europe/Berlin',     48.150340::double precision,  11.580170::double precision),
  ('Parma',                 'parma',          'Italy',           'Emilia-Romagna',               'Piazza Duomo, 43121 Parma, Italy',                           '2026-06-14'::date, '18:00'::text, null::text,    'Europe/Rome',       44.803210::double precision,  10.330640::double precision),
  ('The Hague',             'the-hague',      'Netherlands',     'South Holland',                'Korte Vijverberg 7, 2513 AB Den Haag, Netherlands',          '2026-06-14'::date, '11:00'::text, null::text,    'Europe/Amsterdam',  52.080040::double precision,   4.314230::double precision),
  ('Strasbourg',            'strasbourg',     'France',          'Grand Est',                    'Place d''Austerlitz, 67000 Strasbourg, France',              '2026-06-13'::date, '13:00'::text, '15:30'::text, 'Europe/Paris',      48.578860::double precision,   7.746860::double precision),
  ('Cologne',               'cologne',        'Germany',         'North Rhine-Westphalia',       'Domkloster 4, 50667 Köln, Germany',                          '2026-06-14'::date, '17:00'::text, '19:00'::text, 'Europe/Berlin',     50.941280::double precision,   6.958300::double precision),
  ('Bern',                  'bern',           'Switzerland',     'Bern',                         'Pourtalèsstrasse 45, 3074 Muri bei Bern, Switzerland',       '2026-06-13'::date, '16:00'::text, '17:00'::text, 'Europe/Zurich',     46.935200::double precision,   7.482300::double precision),
  ('New York',              'new-york',       'United States',   'New York',                     '320 E 79th St, New York, NY 10075, USA',                     '2026-06-15'::date, '11:00'::text, null::text,    'America/New_York',  40.774710::double precision, -73.958710::double precision),
  ('Malmö',                 'malmo',          'Sweden',          'Skåne County',                 'Stortorget, 211 22 Malmö, Sweden',                           '2026-06-13'::date, '12:30'::text, null::text,    'Europe/Stockholm',  55.605390::double precision,  13.000220::double precision),
  ('Nürnberg',              'nuremberg',      'Germany',         'Bavaria',                      'Kornmarkt, 90402 Nürnberg, Germany',                         '2026-06-13'::date, '18:00'::text, null::text,    'Europe/Berlin',     49.452090::double precision,  11.075550::double precision),
  ('Mount Clemens (Michigan)', 'mount-clemens','United States',  'Michigan',                     '30 N Main St, Mount Clemens, MI 48043, USA',                 '2026-06-14'::date, '16:00'::text, '18:00'::text, 'America/Detroit',   42.596960::double precision, -82.878090::double precision),
  ('Tampa (Florida)',       'tampa',          'United States',   'Florida',                      '600 N Ashley Dr, Tampa, FL 33602, USA',                      '2026-06-14'::date, '17:00'::text, null::text,    'America/New_York',  27.948480::double precision, -82.459770::double precision)
),
to_insert as (
  select s.* from src s
   where not exists (
     select 1 from public.events e
      where e.location_slug = s.slug_suffix
        and e.date          = s.date_v
        and e.time          = s.time_v
        and e.address       = s.address
   )
),
inserted as (
  insert into public.events (
    title, slug,
    category, description,
    date, time, end_time, timezone,
    status, country, region, location_slug,
    lat, lng, address,
    is_civic, event_type, featured_movement_slug,
    tags, language
  )
  select
    'Albanian Revolution — ' || s.city_label,
    'protest-' || s.slug_suffix || '-' || to_char(s.date_v, 'YYYY-MM-DD')
      || '-' || substring(replace(gen_random_uuid()::text, '-', '') for 6),
    'civic',
    'Peaceful diaspora gathering as part of the Albanian Revolution movement.',
    s.date_v, s.time_v, s.end_time_v, s.timezone,
    'published', s.country, s.region, s.slug_suffix,
    s.lat, s.lng, s.address,
    true, 'protest', 'albanian-revolution',
    array['protest','albanian-revolution','diaspora']::text[], 'en'
  from to_insert s
  returning id, title, location_slug, date, time, address
)
select
  (select count(*) from inserted) as inserted_count,
  (select count(*) from src)      as input_count,
  (select count(*) from src) - (select count(*) from inserted) as skipped_duplicates;
