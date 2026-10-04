-- =====================================================================
-- Event Intelligence Engine — schema `engine` (Phase 0, step 9)
--
-- Customer-neutral data owned by the engine. Nothing here references the
-- AlbaGo application tables in `public`, and nothing in `public` is changed.
-- RLS is enabled on every table with NO policies, and only service_role is
-- granted access: anon/authenticated (website visitors) can never read or
-- write engine data. See docs/engine/phase-0-plan.md §1 and
-- docs/engine/discovery-architecture.md §6–7.
-- =====================================================================

create schema if not exists engine;

revoke all on schema engine from public;
revoke all on schema engine from anon, authenticated;
grant usage on schema engine to service_role;

create or replace function engine.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- sources — the source graph (proposed by the AI or an admin → active)
-- ---------------------------------------------------------------------
create table engine.sources (
  id                    uuid primary key default gen_random_uuid(),
  connector             text not null,                       -- website_html | website_jsonld | rss | text | ingest_api | search | …
  url                   text not null,
  normalized_url        text not null unique,
  label                 text,
  scope                 jsonb not null default '{}'::jsonb,   -- { country_codes:[…], localities:[…] }
  access                jsonb not null default '{}'::jsonb,   -- { basis, terms_note, robots_ok, contact } — compliance record
  status                text not null default 'proposed'
                          check (status in ('proposed','active','paused','rejected')),
  status_reason         text,
  evaluation            jsonb not null default '{}'::jsonb,   -- deterministic yield/verification stats
  check_interval_hours  integer check (check_interval_hours is null or check_interval_hours > 0),
  discovered_by_run     uuid,
  last_checked_at       timestamptz,
  last_status           text check (last_status in ('ok','empty','error')),
  last_error            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger sources_set_updated_at before update on engine.sources
  for each row execute function engine.set_updated_at();

-- ---------------------------------------------------------------------
-- runs — audit trail of every discovery / monitoring run
-- ---------------------------------------------------------------------
create table engine.runs (
  id            uuid primary key default gen_random_uuid(),
  lane          text not null check (lane in ('research','monitoring','direct','manual')),
  goal          jsonb,                                       -- the DiscoveryGoalV1 that was run
  status        text not null default 'running'
                  check (status in ('running','completed','failed','stopped_budget')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  stats         jsonb not null default '{}'::jsonb,         -- searches, fetches, tokens, observations, outcomes
  log           jsonb not null default '[]'::jsonb,         -- queries issued, pages fetched, decisions (bounded)
  error         text,
  triggered_by  uuid                                         -- opaque actor id from the caller
);
alter table engine.sources
  add constraint sources_discovered_by_run_fkey
  foreign key (discovered_by_run) references engine.runs (id) on delete set null;

-- ---------------------------------------------------------------------
-- venues — neutral venue/entity graph (no customer ids, ever)
-- ---------------------------------------------------------------------
create table engine.venues (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  aliases                   text[] not null default '{}',
  address                   text,
  locality                  text,
  country_code              char(2) check (country_code ~ '^[A-Z]{2}$'),
  lat                       double precision check (lat between -90 and 90),
  lng                       double precision check (lng between -180 and 180),
  website                   text,
  created_from_observation  uuid,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);
create index venues_locality_idx on engine.venues (country_code, lower(locality));
create trigger venues_set_updated_at before update on engine.venues
  for each row execute function engine.set_updated_at();

-- ---------------------------------------------------------------------
-- entities — performers / organizers / institutions with affiliations
-- ---------------------------------------------------------------------
create table engine.entities (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('performer','organizer','institution')),
  name          text not null,
  aliases       text[] not null default '{}',
  affiliations  jsonb not null default '{}'::jsonb,   -- { "albanian": { "evidence": [...], "since": "..." } }
  evidence      jsonb not null default '[]'::jsonb,   -- observation ids / urls supporting the entity
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index entities_kind_name_key on engine.entities (kind, lower(name));
create trigger entities_set_updated_at before update on engine.entities
  for each row execute function engine.set_updated_at();

-- ---------------------------------------------------------------------
-- occurrences — what the engine believes (CanonicalOccurrenceV1)
-- ---------------------------------------------------------------------
create table engine.occurrences (
  id                   uuid primary key default gen_random_uuid(),
  version              integer not null default 1 check (version >= 1),
  title                text not null check (length(btrim(title)) > 0),
  description          text,
  language             text check (language ~ '^[a-z]{2}$'),
  event_type           text not null,                       -- engine taxonomy, validated in code
  tags                 text[] not null default '{}',
  start_date           date not null,
  start_time           time,                                -- null = not published; never guessed
  end_date             date,
  end_time             time,
  timezone             text,
  status               text not null default 'scheduled'
                         check (status in ('scheduled','cancelled','postponed','rescheduled')),
  venue_id             uuid references engine.venues (id) on delete set null,
  venue_text           text,
  venue_address        text,
  locality             text,
  country_code         char(2) check (country_code ~ '^[A-Z]{2}$'),
  lat                  double precision check (lat between -90 and 90),
  lng                  double precision check (lng between -180 and 180),
  organizer_name       text,
  performers           text[] not null default '{}',
  promotion_languages  text[] not null default '{}',
  audience_statements  text[] not null default '{}',
  cultural_occasion    text,
  price                jsonb not null default '{"state":"unknown","min":null,"max":null,"currency":null,"note":null}'::jsonb,
  ticket_url           text,
  media                jsonb not null default '[]'::jsonb,
  source_urls          text[] not null default '{}',
  provenance           jsonb not null default '{}'::jsonb,
  relevance            jsonb not null default '{}'::jsonb,
  review_status        text not null default 'needs_review'
                         check (review_status in ('needs_review','verified','rejected')),
  verified_at          timestamptz,
  verified_by          uuid,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (end_date is null or end_date <> start_date or start_time is null or end_time is null or end_time >= start_time),
  check ((lat is null) = (lng is null))
);
create index occurrences_review_idx on engine.occurrences (review_status, start_date);
create index occurrences_match_idx on engine.occurrences (start_date, country_code, lower(locality));
create trigger occurrences_set_updated_at before update on engine.occurrences
  for each row execute function engine.set_updated_at();

-- ---------------------------------------------------------------------
-- observations — what a source reported (immutable evidence)
-- ---------------------------------------------------------------------
create table engine.observations (
  id               uuid primary key default gen_random_uuid(),
  source_id        uuid references engine.sources (id) on delete set null,
  run_id           uuid references engine.runs (id) on delete set null,
  connector        text not null,
  source_url       text,
  normalized_url   text,
  retrieved_at     timestamptz not null,
  content_hash     text not null,
  evidence         jsonb not null,                          -- jsonld, text excerpt, title, meta, media refs
  lead             jsonb,                                   -- search query/snippet that led here (never evidence)
  extracted        jsonb,                                   -- contract-shaped fields + per-field status
  extractor        text,                                    -- e.g. jsonld@1, llm:<provider>/<model>@<version>
  status           text not null default 'extracted'
                     check (status in ('extracted','not_event','failed')),
  error            text,
  occurrence_id    uuid references engine.occurrences (id) on delete set null,
  match            jsonb,                                   -- dedup decision: new | attached | possible_duplicate, score, reasons
  created_at       timestamptz not null default now()
);
-- Same page, same content → one observation (no repeat AI cost).
create unique index observations_url_hash_key
  on engine.observations (normalized_url, content_hash) where normalized_url is not null;
create index observations_occurrence_idx on engine.observations (occurrence_id);
create index observations_run_idx on engine.observations (run_id);

alter table engine.venues
  add constraint venues_created_from_observation_fkey
  foreign key (created_from_observation) references engine.observations (id) on delete set null;

-- ---------------------------------------------------------------------
-- review_actions — human decisions and corrections (asset)
-- ---------------------------------------------------------------------
create table engine.review_actions (
  id              uuid primary key default gen_random_uuid(),
  occurrence_id   uuid references engine.occurrences (id) on delete cascade,
  observation_id  uuid references engine.observations (id) on delete set null,
  action          text not null
                    check (action in ('verify','reject','edit','attach','detach','create_venue','relevance')),
  changes         jsonb not null default '{}'::jsonb,       -- { field: { from, to } }
  reason          text,
  actor           uuid,                                      -- opaque to the engine
  created_at      timestamptz not null default now()
);
create index review_actions_occurrence_idx on engine.review_actions (occurrence_id, created_at);

-- ---------------------------------------------------------------------
-- Access: service_role only. RLS on, no policies.
-- ---------------------------------------------------------------------
alter table engine.sources        enable row level security;
alter table engine.runs           enable row level security;
alter table engine.venues         enable row level security;
alter table engine.entities       enable row level security;
alter table engine.occurrences    enable row level security;
alter table engine.observations   enable row level security;
alter table engine.review_actions enable row level security;

revoke all on all tables in schema engine from public, anon, authenticated;
revoke all on all functions in schema engine from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema engine to service_role;
alter default privileges in schema engine revoke all on tables from public, anon, authenticated;
alter default privileges in schema engine grant select, insert, update, delete on tables to service_role;
