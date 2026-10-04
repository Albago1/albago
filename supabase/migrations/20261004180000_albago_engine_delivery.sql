-- =====================================================================
-- AlbaGo ← Event Engine delivery link (AlbaGo-side, additive)
--
-- Lets the AlbaGo adapter (integrations/albago/adapter.ts) deliver engine
-- occurrences idempotently: one AlbaGo event per engine occurrence, updated
-- in place when the engine's version moves on. Nullable — every existing
-- event is untouched. The engine itself never reads or writes this table;
-- only the adapter does.
-- =====================================================================

alter table public.events
  add column if not exists engine_occurrence_id uuid,
  add column if not exists engine_version integer;

create unique index if not exists events_engine_occurrence_id_key
  on public.events (engine_occurrence_id)
  where engine_occurrence_id is not null;

comment on column public.events.engine_occurrence_id is
  'Event Engine occurrence this AlbaGo event was delivered from (null for events created in AlbaGo).';
comment on column public.events.engine_version is
  'Engine occurrence version last delivered; the adapter only re-delivers newer versions.';
