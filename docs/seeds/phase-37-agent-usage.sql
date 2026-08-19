-- Phase 37 — AI usage ledger.
--
-- Problem: the platform has made AI calls since Lens shipped and has never
-- recorded a single token (2026-08-12 audit §21: "no cost or token tracking").
-- That was survivable while every call was one-shot and human-triggered. The
-- ingestion agent is a CONVERSATION — one event can cost a dozen calls, and a
-- confused loop costs more — so it ships with the meter, not after.
--
-- Deliberately generic: `surface` is a free label, so Lens, Radar, the crawler
-- and the translator can all start writing here later without a migration.
--
-- Internal/ops only. Never exposed publicly; admin-readable, service-written.
-- No writes from the browser at all — the API route inserts with the service
-- role after a turn completes.
--
-- Idempotent; safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Which feature spent this. 'compose' = the Phase 37 agent.
  surface text NOT NULL,
  -- Who triggered it. NULL for cron/automated callers, which own no session.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  -- Which tools ran this turn. Makes an expensive turn explainable after the
  -- fact instead of just large.
  tools text[] NOT NULL DEFAULT '{}'
);

COMMENT ON TABLE public.ai_usage IS
  'Per-call AI token ledger. Written by server routes with the service role; read by admins only. Generic across features via `surface`.';

-- The two queries this table exists to answer: "what did we spend recently"
-- and "what did this feature spend".
CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx
  ON public.ai_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_surface_created_at_idx
  ON public.ai_usage (surface, created_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Admins read. Nobody else sees it, and NOBODY writes from a browser session:
-- with no INSERT/UPDATE/DELETE policy, only the service role can write, which
-- is exactly the intent (a client that could write its own usage rows could
-- also hide them).
DROP POLICY IF EXISTS "ai_usage_admin_select" ON public.ai_usage;
CREATE POLICY "ai_usage_admin_select"
  ON public.ai_usage FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;

-- Verify: expect the table, both indexes, and exactly one policy.
SELECT count(*) AS rows_so_far FROM public.ai_usage;
