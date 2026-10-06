-- Phase 43 — Seat sales: selling AlbaGo's own stock of real (Eventim) seats.
-- seat_sales (one per event) → seat_categories → seat_stock (one row per
-- physical seat) → seat_reservations (a buyer's group of seats) + seat_waitlist.
-- Plan: docs/phase-43-fight-night-seats-plan.md.
--
-- Payment is deliberately NOT here yet: a reservation is 'held' until an admin
-- marks it paid (any method). Stripe later only needs to call the same
-- transition — no schema change.
--
-- Idempotent: safe to re-run. TWO PARTS, each its own transaction — run
-- PART 1 (tables + RLS) first, then PART 2 (functions + grants), via Supabase
-- Studio → SQL editor → New query → paste → Run. Function bodies use $fn$
-- and one-line headers so a browser paste can't mangle them.
-- Depends on (all verified present by the phase-33 seed): events(id, status,
-- date, end_date, timezone, listing_status), profiles(id, role), is_admin(),
-- set_updated_at(), auth.users(id, email).

-- ===========================================================================
-- PART 1 of 2 — tables, triggers, RLS
-- ===========================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. seat_sales — one per event. mode drives what the public sees:
--    draft = admins only (test the whole flow), waitlist = join-the-list,
--    live = reservations open, closed = shown as closed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seat_sales (
  event_id         uuid        PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  mode             text        NOT NULL DEFAULT 'draft' CHECK (mode IN ('draft','waitlist','live','closed')),
  currency         char(3)     NOT NULL DEFAULT 'EUR',
  hold_minutes     int         NOT NULL DEFAULT 2880 CHECK (hold_minutes BETWEEN 30 AND 20160),
  max_per_order    int         NOT NULL DEFAULT 8 CHECK (max_per_order BETWEEN 1 AND 20),
  deliver_by       date,
  seller_name      text        CHECK (seller_name IS NULL OR length(seller_name) <= 120),
  public_note      text        CHECK (public_note IS NULL OR length(public_note) <= 600),
  show_face_value  boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS seat_sales_set_updated_at ON seat_sales;
CREATE TRIGGER seat_sales_set_updated_at
  BEFORE UPDATE ON seat_sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. seat_categories — price lives per category (code = the Eventim "Cat 4").
--    price_cents NULL = not on sale yet (hidden from the public).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seat_categories (
  event_id          uuid        NOT NULL REFERENCES seat_sales(event_id) ON DELETE CASCADE,
  code              text        NOT NULL CHECK (length(code) BETWEEN 1 AND 40),
  label             text        NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  face_value_cents  int         CHECK (face_value_cents >= 0),
  price_cents       int         CHECK (price_cents >= 0),
  sort_order        int         NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, code)
);

DROP TRIGGER IF EXISTS seat_categories_set_updated_at ON seat_categories;
CREATE TRIGGER seat_categories_set_updated_at
  BEFORE UPDATE ON seat_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. seat_reservations — one buyer's group of seats and its life:
--    held → paid → transfer_sent → delivered, or cancelled / expired / refunded.
--    `seats` is a snapshot so history survives a seat being released.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seat_reservations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid        NOT NULL REFERENCES seat_sales(event_id) ON DELETE CASCADE,
  user_id           uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_by        uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  source            text        NOT NULL DEFAULT 'online' CHECK (source IN ('online','manual')),
  reference         text        NOT NULL UNIQUE,
  status            text        NOT NULL CHECK (status IN ('held','paid','transfer_sent','delivered','cancelled','expired','refunded')),
  category          text        NOT NULL,
  category_label    text        NOT NULL,
  quantity          int         NOT NULL CHECK (quantity > 0),
  unit_price_cents  int         NOT NULL CHECK (unit_price_cents >= 0),
  total_cents       int         NOT NULL CHECK (total_cents >= 0),
  currency          char(3)     NOT NULL DEFAULT 'EUR',
  buyer_name        text        NOT NULL,
  buyer_email       text        NOT NULL,
  eventim_email     text        NOT NULL,
  phone             text,
  note              text,
  seats             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  payment_method    text        CHECK (payment_method IN ('bank_transfer','cash','card','paypal','stripe','other')),
  payment_ref       text,
  admin_note        text,
  expires_at        timestamptz,
  paid_at           timestamptz,
  transfer_sent_at  timestamptz,
  delivered_at      timestamptz,
  cancelled_at      timestamptz,
  refunded_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seat_reservations_event_status_idx ON seat_reservations (event_id, status);
CREATE INDEX IF NOT EXISTS seat_reservations_user_idx ON seat_reservations (user_id);

DROP TRIGGER IF EXISTS seat_reservations_set_updated_at ON seat_reservations;
CREATE TRIGGER seat_reservations_set_updated_at
  BEFORE UPDATE ON seat_reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. seat_stock — one row per physical seat. A seat is taken while
--    reservation_id points at a live reservation; "free" is COMPUTED by
--    seat_free_stock() (schema principle #4), never stored.
--    The category FK is deferred (phase-33b lesson): deleting a whole sale
--    cascades to categories AND seats in one statement without tripping it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seat_stock (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid        NOT NULL REFERENCES seat_sales(event_id) ON DELETE CASCADE,
  category        text        NOT NULL,
  area            text        NOT NULL CHECK (length(area) BETWEEN 1 AND 80),
  block           text        NOT NULL CHECK (length(block) BETWEEN 1 AND 20),
  row_label       text        NOT NULL CHECK (length(row_label) BETWEEN 1 AND 20),
  seat_number     int         NOT NULL CHECK (seat_number > 0),
  withdrawn       boolean     NOT NULL DEFAULT false,
  reservation_id  uuid        REFERENCES seat_reservations(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seat_stock_category_fk FOREIGN KEY (event_id, category) REFERENCES seat_categories(event_id, code) ON UPDATE CASCADE ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT seat_stock_unique_seat UNIQUE (event_id, area, block, row_label, seat_number)
);

CREATE INDEX IF NOT EXISTS seat_stock_reservation_idx ON seat_stock (reservation_id);

-- ---------------------------------------------------------------------------
-- 5. seat_waitlist — "tell me when sales open". One row per email per event.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seat_waitlist (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES seat_sales(event_id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  name        text        NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email       text        NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  phone       text        CHECK (phone IS NULL OR length(phone) <= 40),
  category    text,
  quantity    int         NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 20),
  city        text        CHECK (city IS NULL OR length(city) <= 80),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seat_waitlist_unique_email UNIQUE (event_id, email)
);

DROP TRIGGER IF EXISTS seat_waitlist_set_updated_at ON seat_waitlist;
CREATE TRIGGER seat_waitlist_set_updated_at
  BEFORE UPDATE ON seat_waitlist
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 18. RLS — admins manage stock directly; buyers read only their own
--     reservations; every write a buyer makes goes through an RPC above.
-- ---------------------------------------------------------------------------
ALTER TABLE seat_sales        ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_stock        ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_waitlist     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seat_sales_admin ON seat_sales;
CREATE POLICY seat_sales_admin ON seat_sales FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS seat_categories_admin ON seat_categories;
CREATE POLICY seat_categories_admin ON seat_categories FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS seat_stock_admin ON seat_stock;
CREATE POLICY seat_stock_admin ON seat_stock FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS seat_reservations_select ON seat_reservations;
CREATE POLICY seat_reservations_select ON seat_reservations FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS seat_waitlist_admin_select ON seat_waitlist;
CREATE POLICY seat_waitlist_admin_select ON seat_waitlist FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS seat_waitlist_admin_delete ON seat_waitlist;
CREATE POLICY seat_waitlist_admin_delete ON seat_waitlist FOR DELETE
  USING (is_admin());

COMMIT;

-- ===========================================================================
-- PART 2 of 2 — functions + grants (run after PART 1)
-- ===========================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 6. Reference generator — 'SEAT-XXXXXX', unambiguous alphabet (no 0/O/1/I/L),
--    short enough to type into a bank-transfer reference field.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_seat_reference() RETURNS text LANGUAGE plpgsql VOLATILE AS $fn$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  s text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    s := s || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN 'SEAT-' || s;
END; $fn$;

-- ---------------------------------------------------------------------------
-- 7. seat_free_stock — THE single definition of "this seat can be sold":
--    not withdrawn, its category has a price, and it is not attached to a
--    live reservation (an expired-but-not-yet-swept hold counts as free).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seat_free_stock(p_event_id uuid) RETURNS SETOF seat_stock LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT s.*
  FROM seat_stock s
  JOIN seat_categories c ON c.event_id = s.event_id AND c.code = s.category
  LEFT JOIN seat_reservations r ON r.id = s.reservation_id
  WHERE s.event_id = p_event_id
    AND NOT s.withdrawn
    AND c.price_cents IS NOT NULL
    AND (
      s.reservation_id IS NULL
      OR r.id IS NULL
      OR r.status IN ('cancelled','expired')
      OR (r.status = 'held' AND r.expires_at <= now())
    );
$fn$;

-- ---------------------------------------------------------------------------
-- 8. seat_free_runs — free seats grouped into runs of side-by-side seats
--    (same category/area/block/row, consecutive numbers). The classic
--    gaps-and-islands trick: seat_number − row_number() is constant per run.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seat_free_runs(p_event_id uuid) RETURNS TABLE (category text, area text, block text, row_label text, first_seat int, len int) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT f.category, f.area, f.block, f.row_label,
         min(f.seat_number)::int AS first_seat,
         count(*)::int           AS len
  FROM (
    SELECT s.category, s.area, s.block, s.row_label, s.seat_number,
           s.seat_number - row_number() OVER (
             PARTITION BY s.category, s.area, s.block, s.row_label
             ORDER BY s.seat_number
           ) AS grp
    FROM seat_free_stock(p_event_id) s
  ) f
  GROUP BY f.category, f.area, f.block, f.row_label, f.grp;
$fn$;

-- ---------------------------------------------------------------------------
-- 9. seat_pick — choose seats for a group so it always sits together and the
--    stock never fragments into lonely single seats:
--      1st choice: a run that fits exactly (nothing left behind)
--      2nd choice: the SMALLEST run that still leaves ≥2 seats (keeps the big
--                  runs for big groups)
--      last resort: a run that would leave exactly 1 seat behind
--    Takes seats from the low end of the run so the remainder stays together.
--    Caller must hold the seat_sales row lock. Returns NULL if nothing fits.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seat_pick(p_event_id uuid, p_category text, p_quantity int) RETURNS uuid[] LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_run record;
  v_ids uuid[];
BEGIN
  SELECT r.* INTO v_run
  FROM seat_free_runs(p_event_id) r
  WHERE r.category = p_category
    AND r.len >= p_quantity
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

-- ---------------------------------------------------------------------------
-- 10. seat_sweep — bookkeeping: flip lapsed holds to 'expired' and detach any
--     seat still pointing at a dead reservation. Correctness never depends on
--     this (seat_free_stock already treats them as free); it keeps the admin
--     view and the per-user caps honest. Caller holds the sale lock.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seat_sweep(p_event_id uuid) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  UPDATE seat_reservations
     SET status = 'expired'
   WHERE event_id = p_event_id
     AND status = 'held'
     AND expires_at <= now();

  UPDATE seat_stock s
     SET reservation_id = NULL
    FROM seat_reservations r
   WHERE s.reservation_id = r.id
     AND s.event_id = p_event_id
     AND r.status IN ('cancelled','expired');
END; $fn$;

-- ---------------------------------------------------------------------------
-- 11. seat_create_reservation — shared core of online reservations and
--     admin manual sales. Not callable by clients (no GRANT); only the two
--     wrappers below call it, after their own checks, under the sale lock.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seat_create_reservation(p_event_id uuid, p_category text, p_quantity int, p_user_id uuid, p_created_by uuid, p_source text, p_status text, p_buyer_name text, p_buyer_email text, p_eventim_email text, p_phone text, p_note text, p_payment_method text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_sale     seat_sales%ROWTYPE;
  v_cat      seat_categories%ROWTYPE;
  v_ids      uuid[];
  v_free     int;
  v_res_id   uuid;
  v_ref      text;
  v_seats    jsonb;
  v_expires  timestamptz;
  attempt    int := 0;
BEGIN
  SELECT * INTO v_sale FROM seat_sales WHERE event_id = p_event_id;

  SELECT * INTO v_cat FROM seat_categories
   WHERE event_id = p_event_id AND code = p_category;
  IF NOT FOUND OR v_cat.price_cents IS NULL THEN
    RAISE EXCEPTION 'category_not_on_sale';
  END IF;

  v_ids := seat_pick(p_event_id, p_category, p_quantity);
  IF v_ids IS NULL OR array_length(v_ids, 1) IS DISTINCT FROM p_quantity THEN
    SELECT count(*)::int INTO v_free
      FROM seat_free_stock(p_event_id) s
     WHERE s.category = p_category;
    IF v_free >= p_quantity THEN
      RAISE EXCEPTION 'not_together';
    END IF;
    RAISE EXCEPTION 'sold_out';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
           'area', s.area, 'block', s.block, 'row', s.row_label, 'seat', s.seat_number)
           ORDER BY s.seat_number)
    INTO v_seats
    FROM seat_stock s
   WHERE s.id = ANY (v_ids);

  v_expires := CASE WHEN p_status = 'held'
                    THEN now() + make_interval(mins => v_sale.hold_minutes)
                    END;

  LOOP
    attempt := attempt + 1;
    v_ref := generate_seat_reference();
    BEGIN
      INSERT INTO seat_reservations (
        event_id, user_id, created_by, source, reference, status,
        category, category_label, quantity, unit_price_cents, total_cents,
        currency, buyer_name, buyer_email, eventim_email, phone, note, seats,
        payment_method, expires_at, paid_at
      ) VALUES (
        p_event_id, p_user_id, p_created_by, p_source, v_ref, p_status,
        v_cat.code, v_cat.label, p_quantity, v_cat.price_cents,
        v_cat.price_cents * p_quantity,
        v_sale.currency, p_buyer_name, p_buyer_email, p_eventim_email,
        p_phone, p_note, v_seats,
        CASE WHEN p_status = 'paid' THEN COALESCE(p_payment_method, 'other') END,
        v_expires,
        CASE WHEN p_status = 'paid' THEN now() END
      )
      RETURNING id INTO v_res_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt >= 5 THEN
        RAISE EXCEPTION 'reference_collision';
      END IF;
    END;
  END LOOP;

  UPDATE seat_stock SET reservation_id = v_res_id WHERE id = ANY (v_ids);

  RETURN jsonb_build_object(
    'id', v_res_id,
    'reference', v_ref,
    'status', p_status,
    'category', v_cat.code,
    'category_label', v_cat.label,
    'quantity', p_quantity,
    'total_cents', v_cat.price_cents * p_quantity,
    'currency', v_sale.currency,
    'seats', v_seats,
    'expires_at', v_expires
  );
END; $fn$;

-- ---------------------------------------------------------------------------
-- 12. seat_reserve — the public reservation (signed-in buyers).
--     Locks the seat_sales row FOR UPDATE: every reservation for one event is
--     serialized, so two buyers can never get the same seat — by construction.
--     In 'draft' mode only admins may reserve (test the flow before launch).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seat_reserve(p_event_id uuid, p_category text, p_quantity int, p_buyer_name text, p_eventim_email text, p_phone text, p_note text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid         uuid := auth.uid();
  v_admin       boolean := is_admin();
  v_sale        seat_sales%ROWTYPE;
  v_ev_status   text;
  v_ev_listing  text;
  v_ev_over     boolean;
  v_have        int;
  v_email       text;
  v_name        text := btrim(COALESCE(p_buyer_name, ''));
  v_eventim     text := lower(btrim(COALESCE(p_eventim_email, '')));
  v_phone       text := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_note        text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT * INTO v_sale FROM seat_sales WHERE event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sale_not_found';
  END IF;
  IF NOT (v_sale.mode = 'live' OR (v_sale.mode = 'draft' AND v_admin)) THEN
    RAISE EXCEPTION 'sales_closed';
  END IF;

  SELECT e.status, e.listing_status,
         (COALESCE(e.end_date, e.date)
            < (now() AT TIME ZONE COALESCE(e.timezone, 'Europe/Tirane'))::date)
    INTO v_ev_status, v_ev_listing, v_ev_over
    FROM events e WHERE e.id = p_event_id;
  IF v_ev_status IS DISTINCT FROM 'published' AND NOT v_admin THEN
    RAISE EXCEPTION 'sales_closed';
  END IF;
  IF v_ev_listing = 'cancelled' OR v_ev_over THEN
    RAISE EXCEPTION 'sales_closed';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > v_sale.max_per_order THEN
    RAISE EXCEPTION 'bad_quantity';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'bad_details';
  END IF;
  IF length(v_eventim) > 254 OR v_eventim !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'bad_details';
  END IF;
  IF (v_phone IS NOT NULL AND length(v_phone) > 40)
     OR (v_note IS NOT NULL AND length(v_note) > 500) THEN
    RAISE EXCEPTION 'bad_details';
  END IF;

  PERFORM seat_sweep(p_event_id);

  -- Per-buyer cap across the whole event, live holds and sold seats alike.
  SELECT COALESCE(sum(quantity), 0)::int INTO v_have
    FROM seat_reservations
   WHERE event_id = p_event_id
     AND user_id = v_uid
     AND status IN ('held','paid','transfer_sent','delivered');
  IF v_have + p_quantity > v_sale.max_per_order THEN
    RAISE EXCEPTION 'user_cap_reached';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  RETURN seat_create_reservation(
    p_event_id, p_category, p_quantity,
    v_uid, v_uid, 'online', 'held',
    v_name, COALESCE(v_email, v_eventim), v_eventim, v_phone, v_note, NULL
  );
END; $fn$;

-- ---------------------------------------------------------------------------
-- 13. seat_admin_manual_sale — sales agreed outside the site (WhatsApp, in
--     person). Same seat-picking rules, any sale mode, optional instant 'paid'.
--     Links to the buyer's AlbaGo account when the email matches one, so they
--     still get the tracker.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seat_admin_manual_sale(p_event_id uuid, p_category text, p_quantity int, p_buyer_name text, p_buyer_email text, p_eventim_email text, p_phone text, p_note text, p_paid boolean, p_payment_method text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $fn$
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

  SELECT id INTO v_buyer FROM auth.users WHERE lower(email) = v_email LIMIT 1;

  RETURN seat_create_reservation(
    p_event_id, p_category, p_quantity,
    v_buyer, v_uid, 'manual',
    CASE WHEN p_paid THEN 'paid' ELSE 'held' END,
    v_name, v_email, v_eventim,
    NULLIF(btrim(COALESCE(p_phone, '')), ''),
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    p_payment_method
  );
END; $fn$;

-- ---------------------------------------------------------------------------
-- 14. seat_admin_update — every admin status move goes through this one
--     state machine (Stripe's webhook will call 'mark_paid' the same way).
--     Seats go back on sale on cancel, and on refund when p_release is true.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seat_admin_update(p_reservation_id uuid, p_action text, p_payment_method text, p_payment_ref text, p_admin_note text, p_release boolean) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_event_id  uuid;
  v_sale      seat_sales%ROWTYPE;
  v_res       seat_reservations%ROWTYPE;
  v_linked    int;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT event_id INTO v_event_id FROM seat_reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation_not_found';
  END IF;
  -- Lock order everywhere: sale row first, then the reservation.
  SELECT * INTO v_sale FROM seat_sales WHERE event_id = v_event_id FOR UPDATE;
  SELECT * INTO v_res FROM seat_reservations WHERE id = p_reservation_id FOR UPDATE;

  IF p_payment_method IS NOT NULL
     AND p_payment_method NOT IN ('bank_transfer','cash','card','paypal','stripe','other') THEN
    RAISE EXCEPTION 'bad_details';
  END IF;

  IF p_action IN ('mark_paid','extend_hold') AND v_res.status = 'expired' THEN
    RAISE EXCEPTION 'hold_expired';
  END IF;

  IF p_action = 'mark_paid' THEN
    IF v_res.status <> 'held' THEN
      RAISE EXCEPTION 'bad_transition';
    END IF;
    -- A lapsed hold can still be paid while nobody else took the seats.
    SELECT count(*)::int INTO v_linked FROM seat_stock WHERE reservation_id = v_res.id;
    IF v_linked <> v_res.quantity THEN
      RAISE EXCEPTION 'hold_expired';
    END IF;
    UPDATE seat_reservations
       SET status = 'paid', paid_at = now(), expires_at = NULL,
           payment_method = COALESCE(p_payment_method, payment_method, 'other'),
           payment_ref = COALESCE(NULLIF(btrim(p_payment_ref), ''), payment_ref)
     WHERE id = v_res.id;

  ELSIF p_action = 'extend_hold' THEN
    IF v_res.status <> 'held' THEN
      RAISE EXCEPTION 'bad_transition';
    END IF;
    SELECT count(*)::int INTO v_linked FROM seat_stock WHERE reservation_id = v_res.id;
    IF v_linked <> v_res.quantity THEN
      RAISE EXCEPTION 'hold_expired';
    END IF;
    UPDATE seat_reservations
       SET expires_at = GREATEST(COALESCE(expires_at, now()), now())
                        + make_interval(mins => v_sale.hold_minutes)
     WHERE id = v_res.id;

  ELSIF p_action = 'transfer_sent' THEN
    IF v_res.status <> 'paid' THEN
      RAISE EXCEPTION 'bad_transition';
    END IF;
    UPDATE seat_reservations
       SET status = 'transfer_sent', transfer_sent_at = now()
     WHERE id = v_res.id;

  ELSIF p_action = 'undo_transfer' THEN
    IF v_res.status <> 'transfer_sent' THEN
      RAISE EXCEPTION 'bad_transition';
    END IF;
    UPDATE seat_reservations
       SET status = 'paid', transfer_sent_at = NULL
     WHERE id = v_res.id;

  ELSIF p_action = 'delivered' THEN
    IF v_res.status <> 'transfer_sent' THEN
      RAISE EXCEPTION 'bad_transition';
    END IF;
    UPDATE seat_reservations
       SET status = 'delivered', delivered_at = now()
     WHERE id = v_res.id;

  ELSIF p_action = 'cancel' THEN
    IF v_res.status <> 'held' THEN
      RAISE EXCEPTION 'bad_transition';
    END IF;
    UPDATE seat_reservations
       SET status = 'cancelled', cancelled_at = now(), expires_at = NULL
     WHERE id = v_res.id;
    UPDATE seat_stock SET reservation_id = NULL WHERE reservation_id = v_res.id;

  ELSIF p_action = 'refund' THEN
    IF v_res.status NOT IN ('paid','transfer_sent','delivered') THEN
      RAISE EXCEPTION 'bad_transition';
    END IF;
    UPDATE seat_reservations
       SET status = 'refunded', refunded_at = now()
     WHERE id = v_res.id;
    -- Refunded-but-kept seats stay attached (not free) until the admin
    -- confirms they are back in the stock account.
    IF COALESCE(p_release, false) THEN
      UPDATE seat_stock SET reservation_id = NULL WHERE reservation_id = v_res.id;
    END IF;

  ELSIF p_action = 'release_seats' THEN
    IF v_res.status <> 'refunded' THEN
      RAISE EXCEPTION 'bad_transition';
    END IF;
    UPDATE seat_stock SET reservation_id = NULL WHERE reservation_id = v_res.id;

  ELSIF p_action = 'note' THEN
    NULL; -- note-only update below

  ELSE
    RAISE EXCEPTION 'bad_action';
  END IF;

  IF p_admin_note IS NOT NULL THEN
    UPDATE seat_reservations
       SET admin_note = NULLIF(btrim(p_admin_note), '')
     WHERE id = v_res.id;
  END IF;

  SELECT * INTO v_res FROM seat_reservations WHERE id = p_reservation_id;
  RETURN to_jsonb(v_res);
END; $fn$;

-- ---------------------------------------------------------------------------
-- 15. Buyer self-service: cancel an unpaid hold; confirm the Eventim transfer
--     arrived.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seat_buyer_update(p_reservation_id uuid, p_action text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_event_id  uuid;
  v_res       seat_reservations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT event_id INTO v_event_id FROM seat_reservations
   WHERE id = p_reservation_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation_not_found';
  END IF;
  PERFORM 1 FROM seat_sales WHERE event_id = v_event_id FOR UPDATE;
  SELECT * INTO v_res FROM seat_reservations WHERE id = p_reservation_id FOR UPDATE;

  IF p_action = 'cancel' THEN
    IF v_res.status <> 'held' THEN
      RAISE EXCEPTION 'bad_transition';
    END IF;
    UPDATE seat_reservations
       SET status = 'cancelled', cancelled_at = now(), expires_at = NULL
     WHERE id = v_res.id;
    UPDATE seat_stock SET reservation_id = NULL WHERE reservation_id = v_res.id;

  ELSIF p_action = 'confirm_received' THEN
    IF v_res.status <> 'transfer_sent' THEN
      RAISE EXCEPTION 'bad_transition';
    END IF;
    UPDATE seat_reservations
       SET status = 'delivered', delivered_at = now()
     WHERE id = v_res.id;

  ELSE
    RAISE EXCEPTION 'bad_action';
  END IF;

  SELECT * INTO v_res FROM seat_reservations WHERE id = p_reservation_id;
  RETURN jsonb_build_object('id', v_res.id, 'status', v_res.status);
END; $fn$;

-- ---------------------------------------------------------------------------
-- 16. seat_join_waitlist — anyone (signed in or not) can join; the API route
--     rate-limits by IP. Re-joining with the same email updates the row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seat_join_waitlist(p_event_id uuid, p_name text, p_email text, p_phone text, p_category text, p_quantity int, p_city text) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_mode   text;
  v_name   text := btrim(COALESCE(p_name, ''));
  v_email  text := lower(btrim(COALESCE(p_email, '')));
  v_phone  text := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_city   text := NULLIF(btrim(COALESCE(p_city, '')), '');
  v_cat    text := NULLIF(btrim(COALESCE(p_category, '')), '');
BEGIN
  SELECT mode INTO v_mode FROM seat_sales WHERE event_id = p_event_id;
  IF v_mode IS NULL OR v_mode NOT IN ('waitlist','live') THEN
    RAISE EXCEPTION 'sales_closed';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120
     OR length(v_email) > 254
     OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     OR (v_phone IS NOT NULL AND length(v_phone) > 40)
     OR (v_city IS NOT NULL AND length(v_city) > 80)
     OR p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 20 THEN
    RAISE EXCEPTION 'bad_details';
  END IF;
  IF v_cat IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM seat_categories WHERE event_id = p_event_id AND code = v_cat
  ) THEN
    v_cat := NULL;
  END IF;

  INSERT INTO seat_waitlist (event_id, user_id, name, email, phone, category, quantity, city)
  VALUES (p_event_id, auth.uid(), v_name, v_email, v_phone, v_cat, p_quantity, v_city)
  ON CONFLICT ON CONSTRAINT seat_waitlist_unique_email DO UPDATE
     SET name = EXCLUDED.name,
         phone = COALESCE(EXCLUDED.phone, seat_waitlist.phone),
         category = EXCLUDED.category,
         quantity = EXCLUDED.quantity,
         city = COALESCE(EXCLUDED.city, seat_waitlist.city),
         user_id = COALESCE(seat_waitlist.user_id, EXCLUDED.user_id);
END; $fn$;

-- ---------------------------------------------------------------------------
-- 17. seat_sale_public — everything the event page needs, safe for anonymous
--     visitors: per category the price, how many are free, and the biggest
--     group that can still sit together. Never exposes buyers or seat ids.
--     'draft' sales are visible to admins only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION seat_sale_public(p_event_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_sale  seat_sales%ROWTYPE;
  v_cats  jsonb;
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

  RETURN jsonb_build_object(
    'mode', v_sale.mode,
    'currency', v_sale.currency,
    'max_per_order', v_sale.max_per_order,
    'hold_minutes', v_sale.hold_minutes,
    'deliver_by', v_sale.deliver_by,
    'seller_name', v_sale.seller_name,
    'public_note', v_sale.public_note,
    'categories', v_cats
  );
END; $fn$;

-- ---------------------------------------------------------------------------
-- 19. Grants — internal helpers are callable by nobody but the definer.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION generate_seat_reference() FROM public;
REVOKE ALL ON FUNCTION seat_free_stock(uuid) FROM public;
REVOKE ALL ON FUNCTION seat_free_runs(uuid) FROM public;
REVOKE ALL ON FUNCTION seat_pick(uuid, text, int) FROM public;
REVOKE ALL ON FUNCTION seat_sweep(uuid) FROM public;
REVOKE ALL ON FUNCTION seat_create_reservation(uuid, text, int, uuid, uuid, text, text, text, text, text, text, text, text) FROM public;

REVOKE ALL ON FUNCTION seat_sale_public(uuid) FROM public;
GRANT EXECUTE ON FUNCTION seat_sale_public(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION seat_join_waitlist(uuid, text, text, text, text, int, text) FROM public;
GRANT EXECUTE ON FUNCTION seat_join_waitlist(uuid, text, text, text, text, int, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION seat_reserve(uuid, text, int, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION seat_reserve(uuid, text, int, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION seat_buyer_update(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION seat_buyer_update(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION seat_admin_manual_sale(uuid, text, int, text, text, text, text, text, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION seat_admin_manual_sale(uuid, text, int, text, text, text, text, text, boolean, text) TO authenticated;

REVOKE ALL ON FUNCTION seat_admin_update(uuid, text, text, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION seat_admin_update(uuid, text, text, text, text, boolean) TO authenticated;

COMMIT;

-- Expected result: one row, all zeros on a fresh install.
SELECT
  (SELECT count(*) FROM seat_sales)        AS sales,
  (SELECT count(*) FROM seat_categories)   AS categories,
  (SELECT count(*) FROM seat_stock)        AS seats,
  (SELECT count(*) FROM seat_reservations) AS reservations,
  (SELECT count(*) FROM seat_waitlist)     AS waitlist;
