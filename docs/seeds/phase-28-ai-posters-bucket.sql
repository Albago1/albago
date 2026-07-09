-- Phase 28: AI poster backdrops — public storage bucket.
--
-- The /api/ai-poster route generates one backdrop image per event (via
-- Vercel AI Gateway) and caches it here as {slug}.png. Writes go through
-- the service role only (no RLS insert policies on purpose); reads are
-- public via the bucket's public URL.
--
-- To force a regeneration for one event, delete ai-posters/{slug}.png in
-- Studio → Storage and generate again from the share modal.

insert into storage.buckets (id, name, public)
values ('ai-posters', 'ai-posters', true)
on conflict (id) do nothing;
