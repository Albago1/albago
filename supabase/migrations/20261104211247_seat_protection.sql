-- Single-seat protection (phase 46). Sell seats so nobody leaves one lonely
-- seat behind that can't be sold any more, relaxing as the event gets close:
--   protected — a purchase must start at an end of its group and never leave
--               exactly one seat (default until flexible_from)
--   flexible  — a lonely seat only when no other group of that price could
--               take the order cleanly (from flexible_from, Berlin date)
--   final     — any quantity, seats still side by side (from final_from)
--   off       — protect_singles switched off: seats side by side, nothing else
-- A "group" is a free run (seat_free_runs). lib/seats/protection.ts mirrors
-- these rules for the screens — keep the two in sync.
-- Also: seats can be marked "sold elsewhere" (Viagogo, in person), and every
-- admin change to stock or rules is written to seat_admin_log.
-- Function bodies below start from the live versions of 2026-11-04.

-- 1. Settings on the sale -------------------------------------------------------
ALTER TABLE seat_sales
  ADD COLUMN IF NOT EXISTS protect_singles boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS flexible_from date,
  ADD COLUMN IF NOT EXISTS final_from date,
  -- [{area, block, row, from, to, quantities: [..]}] — quantities allowed
  -- for groups inside seats from..to of that row (protected/flexible only).
  ADD COLUMN IF NOT EXISTS quantity_overrides jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $do$ BEGIN
  ALTER TABLE seat_sales ADD CONSTRAINT seat_sales_overrides_array CHECK (jsonb_typeof(quantity_overrides) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN
  ALTER TABLE seat_sales ADD CONSTRAINT seat_sales_phase_order CHECK (flexible_from IS NULL OR final_from IS NULL OR flexible_from <= final_from);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;

-- 2. Why a seat is off sale ------------------------------------------------------
ALTER TABLE seat_stock
  ADD COLUMN IF NOT EXISTS withdrawn_reason text,
  ADD COLUMN IF NOT EXISTS withdrawn_note text;
DO $do$ BEGIN
  ALTER TABLE seat_stock ADD CONSTRAINT seat_stock_withdrawn_reason CHECK (withdrawn_reason IN ('kept', 'external'));
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
DO $do$ BEGIN
  ALTER TABLE seat_stock ADD CONSTRAINT seat_stock_withdrawn_note CHECK (withdrawn_note IS NULL OR length(withdrawn_note) <= 200);
EXCEPTION WHEN duplicate_object THEN NULL; END $do$;
UPDATE seat_stock SET withdrawn_reason = 'kept' WHERE withdrawn AND withdrawn_reason IS NULL;

-- 3. Admin activity log (append-only) ----------------------------------------
CREATE TABLE IF NOT EXISTS seat_admin_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES seat_sales(event_id) ON DELETE CASCADE,
  actor      uuid REFERENCES profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  action     text NOT NULL CHECK (length(action) BETWEEN 1 AND 40),
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seat_admin_log_event_time ON seat_admin_log (event_id, created_at DESC);
ALTER TABLE seat_admin_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON seat_admin_log FROM anon;
DROP POLICY IF EXISTS seat_admin_log_admin_select ON seat_admin_log;
CREATE POLICY seat_admin_log_admin_select ON seat_admin_log
  FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS seat_admin_log_admin_insert ON seat_admin_log;
CREATE POLICY seat_admin_log_admin_insert ON seat_admin_log
  FOR INSERT TO authenticated WITH CHECK (is_admin() AND actor = auth.uid());

-- 4. Rule helpers (internal) -------------------------------------------------------

-- Today's phase, on the Berlin calendar date. An admin's manual sale sets
-- albago.seat_rules = 'off' for its own transaction and is not restricted.
CREATE OR REPLACE FUNCTION seat_phase(p_event_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = public AS $fn$
DECLARE
  v_sale  seat_sales%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Europe/Berlin')::date;
BEGIN
  IF current_setting('albago.seat_rules', true) = 'off' AND is_admin() THEN
    RETURN 'off';
  END IF;
  SELECT * INTO v_sale FROM seat_sales WHERE event_id = p_event_id;
  IF NOT FOUND OR NOT v_sale.protect_singles THEN
    RETURN 'off';
  END IF;
  IF v_sale.final_from IS NOT NULL AND v_today >= v_sale.final_from THEN
    RETURN 'final';
  END IF;
  IF v_sale.flexible_from IS NOT NULL AND v_today >= v_sale.flexible_from THEN
    RETURN 'flexible';
  END IF;
  RETURN 'protected';
END; $fn$;

-- May q seats be sold from one end of this group today?
CREATE OR REPLACE FUNCTION seat_run_allows(
  p_event_id uuid, p_category text, p_area text, p_block text, p_row text,
  p_first int, p_len int, p_quantity int, p_phase text
) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path = public AS $fn$
DECLARE
  v_over jsonb;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > p_len THEN
    RETURN false;
  END IF;
  IF p_phase IN ('off', 'final') THEN
    RETURN true;
  END IF;

  SELECT o INTO v_over
    FROM seat_sales s, jsonb_array_elements(s.quantity_overrides) o
   WHERE s.event_id = p_event_id
     AND o->>'area' = p_area AND o->>'block' = p_block AND o->>'row' = p_row
     AND p_first >= (o->>'from')::int
     AND p_first + p_len - 1 <= (o->>'to')::int
   LIMIT 1;
  IF v_over IS NOT NULL AND NOT (v_over->'quantities') @> to_jsonb(p_quantity) THEN
    RETURN false;
  END IF;

  IF p_len - p_quantity <> 1 THEN
    RETURN true;
  END IF;
  IF p_phase = 'protected' THEN
    RETURN false;
  END IF;
  -- flexible: leave a lonely seat only when no other group of this price
  -- could take the order cleanly.
  RETURN NOT EXISTS (
    SELECT 1 FROM seat_free_runs(p_event_id) r
     WHERE r.category = p_category
       AND NOT (r.area = p_area AND r.block = p_block AND r.row_label = p_row AND r.first_seat = p_first)
       AND r.len >= p_quantity
       AND r.len - p_quantity <> 1
  );
END; $fn$;

-- Why a hand-picked set of free seats can't be bought (NULL = it can).
CREATE OR REPLACE FUNCTION seat_selection_problem(p_event_id uuid, p_ids uuid[]) RETURNS text
LANGUAGE plpgsql STABLE SET search_path = public AS $fn$
DECLARE
  v_phase text := seat_phase(p_event_id);
  v_q     int;
  v_rows  int;
  v_min   int;
  v_max   int;
  v_area  text;
  v_block text;
  v_row   text;
  v_run   record;
BEGIN
  SELECT count(*)::int, count(DISTINCT (s.area, s.block, s.row_label))::int,
         min(s.seat_number), max(s.seat_number), min(s.area), min(s.block), min(s.row_label)
    INTO v_q, v_rows, v_min, v_max, v_area, v_block, v_row
    FROM seat_stock s
   WHERE s.event_id = p_event_id AND s.id = ANY (p_ids);
  -- One row, numbers with no gap.
  IF v_q < 1 OR v_rows <> 1 OR v_max - v_min + 1 <> v_q THEN
    RETURN 'not_together';
  END IF;
  SELECT r.* INTO v_run
    FROM seat_free_runs(p_event_id) r
   WHERE r.area = v_area AND r.block = v_block AND r.row_label = v_row
     AND v_min >= r.first_seat AND v_max <= r.first_seat + r.len - 1;
  IF NOT FOUND THEN
    RETURN 'not_together';
  END IF;
  IF v_phase IN ('off', 'final') THEN
    RETURN NULL;
  END IF;
  IF v_min > v_run.first_seat AND v_max < v_run.first_seat + v_run.len - 1 THEN
    RETURN 'splits_group';
  END IF;
  IF NOT seat_run_allows(p_event_id, v_run.category, v_area, v_block, v_row,
                         v_run.first_seat, v_run.len, v_q, v_phase) THEN
    RETURN CASE WHEN v_run.len - v_q = 1 THEN 'strands_seat' ELSE 'quantity_not_allowed' END;
  END IF;
  RETURN NULL;
END; $fn$;

-- Internal: reachable only from the SECURITY DEFINER RPCs below. Supabase
-- grants EXECUTE to anon/authenticated directly, so revoke from them too.
REVOKE EXECUTE ON FUNCTION seat_phase(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION seat_run_allows(uuid, text, text, text, text, int, int, int, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION seat_selection_problem(uuid, uuid[]) FROM public, anon, authenticated;

-- 5. Picking by quantity: only groups the rules allow --------------------------
CREATE OR REPLACE FUNCTION seat_pick(p_event_id uuid, p_category text, p_quantity integer, p_area text, p_block text)
RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_run   record;
  v_ids   uuid[];
  v_phase text := seat_phase(p_event_id);
BEGIN
  SELECT r.* INTO v_run
  FROM seat_free_runs(p_event_id) r
  WHERE r.category = p_category
    AND r.len >= p_quantity
    AND (p_area IS NULL OR (r.area = p_area AND r.block = p_block))
    AND seat_run_allows(p_event_id, r.category, r.area, r.block, r.row_label,
                        r.first_seat, r.len, p_quantity, v_phase)
  ORDER BY
    CASE WHEN r.len = p_quantity THEN 0
         WHEN r.len - p_quantity >= 2 THEN 1
         ELSE 2 END,
    r.len, r.area, r.block, r.row_label, r.first_seat
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(x.id ORDER BY x.seat_number) INTO v_ids
  FROM (
    SELECT s.id, s.seat_number
    FROM seat_free_stock(p_event_id) s
    WHERE s.category = p_category
      AND s.area = v_run.area
      AND s.block = v_run.block
      AND s.row_label = v_run.row_label
      AND s.seat_number >= v_run.first_seat
      AND s.seat_number < v_run.first_seat + v_run.len
    ORDER BY s.seat_number
    LIMIT p_quantity
  ) x;

  RETURN v_ids;
END; $fn$;

-- 6. Buying by quantity: say why when the rules are the reason -------------------
CREATE OR REPLACE FUNCTION seat_reserve(p_event_id uuid, p_category text, p_quantity integer, p_buyer_name text, p_eventim_email text, p_phone text, p_note text, p_area text, p_block text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_email    text;
  v_eventim  text := lower(btrim(COALESCE(p_eventim_email, '')));
  v_area     text := CASE WHEN p_block IS NOT NULL THEN NULLIF(btrim(p_area), '') END;
  v_block    text := CASE WHEN p_area IS NOT NULL THEN NULLIF(btrim(p_block), '') END;
BEGIN
  PERFORM seat_guard_reserve(p_event_id, p_quantity, p_buyer_name, p_eventim_email, p_phone, p_note);

  -- Seats would fit side by side, but only by stranding one: name the rule.
  IF seat_pick(p_event_id, p_category, p_quantity, v_area, v_block) IS NULL
     AND EXISTS (SELECT 1 FROM seat_free_runs(p_event_id) r
                  WHERE r.category = p_category AND r.len >= p_quantity
                    AND (v_area IS NULL OR (r.area = v_area AND r.block = v_block))) THEN
    RAISE EXCEPTION 'strands_seat';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  RETURN seat_create_reservation(
    p_event_id, p_category, p_quantity,
    auth.uid(), auth.uid(), 'online', 'held',
    btrim(COALESCE(p_buyer_name, '')), COALESCE(v_email, v_eventim), v_eventim,
    NULLIF(btrim(COALESCE(p_phone, '')), ''), NULLIF(btrim(COALESCE(p_note, '')), ''), NULL,
    v_area, v_block,
    NULL
  );
END; $fn$;

-- 7. Buying exact seats: side by side, and by the rules ------------------------
CREATE OR REPLACE FUNCTION seat_reserve_seats(p_event_id uuid, p_seats jsonb, p_buyer_name text, p_eventim_email text, p_phone text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_qty      int;
  v_ids      uuid[];
  v_cats     text[];
  v_email    text;
  v_eventim  text := lower(btrim(COALESCE(p_eventim_email, '')));
  v_problem  text;
BEGIN
  IF p_seats IS NULL OR jsonb_typeof(p_seats) <> 'array'
     OR jsonb_array_length(p_seats) < 1 OR jsonb_array_length(p_seats) > 20 THEN
    RAISE EXCEPTION 'bad_quantity';
  END IF;
  v_qty := jsonb_array_length(p_seats);

  -- Takes the sale row lock: concurrent buyers queue here, so the checks
  -- below always see the latest stock.
  PERFORM seat_guard_reserve(p_event_id, v_qty, p_buyer_name, p_eventim_email, p_phone, p_note);

  SELECT array_agg(DISTINCT s.id), array_agg(DISTINCT s.category)
    INTO v_ids, v_cats
    FROM seat_free_stock(p_event_id) s
    JOIN jsonb_to_recordset(p_seats) AS x(area text, block text, "row" text, seat int)
      ON s.area = x.area AND s.block = x.block AND s.row_label = x."row" AND s.seat_number = x.seat;
  IF v_ids IS NULL OR array_length(v_ids, 1) IS DISTINCT FROM v_qty THEN
    RAISE EXCEPTION 'seats_taken';
  END IF;
  IF array_length(v_cats, 1) <> 1 THEN
    RAISE EXCEPTION 'mixed_categories';
  END IF;

  v_problem := seat_selection_problem(p_event_id, v_ids);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  RETURN seat_create_reservation(
    p_event_id, v_cats[1], v_qty,
    auth.uid(), auth.uid(), 'online', 'held',
    btrim(COALESCE(p_buyer_name, '')), COALESCE(v_email, v_eventim), v_eventim,
    NULLIF(btrim(COALESCE(p_phone, '')), ''), NULLIF(btrim(COALESCE(p_note, '')), ''), NULL,
    NULL, NULL, v_ids
  );
END; $fn$;

-- 8. Manual sales by the seller are not restricted ----------------------------
CREATE OR REPLACE FUNCTION seat_admin_manual_sale(p_event_id uuid, p_category text, p_quantity integer, p_buyer_name text, p_buyer_email text, p_eventim_email text, p_phone text, p_note text, p_paid boolean, p_payment_method text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_sale     seat_sales%ROWTYPE;
  v_buyer    uuid;
  v_name     text := btrim(COALESCE(p_buyer_name, ''));
  v_email    text := lower(btrim(COALESCE(p_buyer_email, '')));
  v_eventim  text := lower(btrim(COALESCE(NULLIF(btrim(p_eventim_email), ''), p_buyer_email, '')));
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_sale FROM seat_sales WHERE event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale_not_found';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 20 THEN
    RAISE EXCEPTION 'bad_quantity';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120
     OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     OR v_eventim !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'bad_details';
  END IF;
  IF p_payment_method IS NOT NULL
     AND p_payment_method NOT IN ('bank_transfer','cash','card','paypal','stripe','other') THEN
    RAISE EXCEPTION 'bad_details';
  END IF;

  PERFORM seat_sweep(p_event_id);
  -- The seller decides: single-seat protection doesn't apply to this sale.
  PERFORM set_config('albago.seat_rules', 'off', true);

  SELECT id INTO v_buyer FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  RETURN seat_create_reservation(
    p_event_id, p_category, p_quantity,
    v_buyer, v_uid, 'manual',
    CASE WHEN p_paid THEN 'paid' ELSE 'held' END,
    v_name, v_email, v_eventim,
    NULLIF(btrim(COALESCE(p_phone, '')), ''),
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    p_payment_method,
    NULL, NULL, NULL
  );
END; $fn$;

-- 9. The public sale carries today's rules -----------------------------------
CREATE OR REPLACE FUNCTION seat_sale_public(p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_sale    seat_sales%ROWTYPE;
  v_cats    jsonb;
  v_blocks  jsonb;
  v_runs    jsonb;
  v_seats   jsonb;
BEGIN
  SELECT * INTO v_sale FROM seat_sales WHERE event_id = p_event_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF v_sale.mode = 'draft' AND NOT is_admin() THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'code', c.code,
           'label', c.label,
           'price_cents', c.price_cents,
           'face_value_cents', CASE WHEN v_sale.show_face_value THEN c.face_value_cents END,
           'available', COALESCE(a.available, 0),
           'max_together', LEAST(COALESCE(a.max_run, 0), v_sale.max_per_order)
         ) ORDER BY c.sort_order, c.code), '[]'::jsonb)
    INTO v_cats
    FROM seat_categories c
    LEFT JOIN (
      SELECT r.category, sum(r.len)::int AS available, max(r.len)::int AS max_run
        FROM seat_free_runs(p_event_id) r
       GROUP BY r.category
    ) a ON a.category = c.code
   WHERE c.event_id = p_event_id
     AND c.price_cents IS NOT NULL
     AND EXISTS (SELECT 1 FROM seat_stock s
                  WHERE s.event_id = c.event_id AND s.category = c.code);

  SELECT COALESCE(jsonb_agg(b ORDER BY b->>'area', b->>'block'), '[]'::jsonb)
    INTO v_blocks
    FROM (
      SELECT DISTINCT jsonb_build_object('category', s.category, 'area', s.area, 'block', s.block) AS b
        FROM seat_stock s
        JOIN seat_categories c ON c.event_id = s.event_id AND c.code = s.category
       WHERE s.event_id = p_event_id
         AND NOT s.withdrawn
         AND c.price_cents IS NOT NULL
    ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'category', r.category, 'area', r.area, 'block', r.block,
           'row', r.row_label, 'first', r.first_seat, 'len', r.len)
           ORDER BY r.area, r.block, r.row_label, r.first_seat), '[]'::jsonb)
    INTO v_runs
    FROM seat_free_runs(p_event_id) r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'category', s.category, 'area', s.area, 'block', s.block,
           'row', s.row_label, 'seat', s.seat_number, 'free', f.id IS NOT NULL)
           ORDER BY s.area, s.block, s.row_label, s.seat_number), '[]'::jsonb)
    INTO v_seats
    FROM seat_stock s
    JOIN seat_categories c ON c.event_id = s.event_id AND c.code = s.category
    LEFT JOIN seat_free_stock(p_event_id) f ON f.id = s.id
   WHERE s.event_id = p_event_id
     AND NOT s.withdrawn
     AND c.price_cents IS NOT NULL;

  RETURN jsonb_build_object(
    'mode', v_sale.mode,
    'currency', v_sale.currency,
    'max_per_order', v_sale.max_per_order,
    'hold_minutes', v_sale.hold_minutes,
    'deliver_by', v_sale.deliver_by,
    'seller_name', v_sale.seller_name,
    'public_note', v_sale.public_note,
    'categories', v_cats,
    'blocks', v_blocks,
    'runs', v_runs,
    'seats', v_seats,
    'rules', jsonb_build_object(
      'protect', v_sale.protect_singles,
      'phase', seat_phase(p_event_id),
      'flexible_from', v_sale.flexible_from,
      'final_from', v_sale.final_from,
      'overrides', v_sale.quantity_overrides
    )
  );
END; $fn$;
