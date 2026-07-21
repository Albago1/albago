-- Phase 33 — E-Ticketing v1 (TIX-1 core): ticket_tiers, orders, order_items,
-- tickets, ticket_scans + tier_available / claim_free_tickets / check_in_ticket
-- / void_ticket / organizer tier RPCs / door_snapshot + civic guards + RLS.
-- Contract: docs/master-plan/02-ticketing.md + 01-payments.md.
-- Idempotent: safe to re-run. Apply via Supabase Studio → SQL editor.
-- Verified against deployed schema 2026-07-21: events(id, status, is_civic,
-- organizer_id, date, end_date, timezone, listing_status), organizers(id = auth
-- uid), profiles(id, role), is_admin(), set_updated_at() all present; none of
-- the tables below exist yet.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ticket_tiers — full PAY-compatible contract; v1 UI only creates free ones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_tiers (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name           text          NOT NULL,
  description    text,
  price_cents    int           NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency       char(3)       NOT NULL DEFAULT 'EUR',
  capacity       int           NOT NULL CHECK (capacity > 0),
  max_per_order  int           NOT NULL DEFAULT 6 CHECK (max_per_order > 0),
  sales_start    timestamptz,
  sales_end      timestamptz,
  visibility     text          NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','hidden','unlock_code')),
  fee_mode       text          NOT NULL DEFAULT 'pass' CHECK (fee_mode IN ('absorb','pass')),
  status         text          NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','sold_out_manual','archived')),
  sort_order     int           NOT NULL DEFAULT 0,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_tiers_event_idx ON ticket_tiers (event_id);

DROP TRIGGER IF EXISTS ticket_tiers_set_updated_at ON ticket_tiers;
CREATE TRIGGER ticket_tiers_set_updated_at
  BEFORE UPDATE ON ticket_tiers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. orders + order_items — PAY contract subset; v1 only writes provider='free'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  event_id                 uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id             uuid        REFERENCES organizers(id) ON DELETE SET NULL,
  status                   text        NOT NULL CHECK (status IN ('pending','awaiting_door','paid','cancelled','expired','refunded','partially_refunded')),
  provider                 text        NOT NULL CHECK (provider IN ('free','stripe','cash_at_door')),
  provider_session_id      text,
  provider_payment_intent  text,
  subtotal_cents           int         NOT NULL DEFAULT 0,
  fee_cents                int         NOT NULL DEFAULT 0,
  payment_cents            int         NOT NULL DEFAULT 0,
  total_cents              int         NOT NULL DEFAULT 0,
  currency                 char(3)     NOT NULL DEFAULT 'EUR',
  contact_email            text,
  idempotency_key          text        UNIQUE,
  created_at               timestamptz NOT NULL DEFAULT now(),
  paid_at                  timestamptz,
  expires_at               timestamptz
);

CREATE INDEX IF NOT EXISTS orders_event_idx   ON orders (event_id);
CREATE INDEX IF NOT EXISTS orders_user_idx    ON orders (user_id);
-- Live pending holds are the hot path of tier_available.
CREATE INDEX IF NOT EXISTS orders_pending_idx ON orders (event_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS order_items (
  id               uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid  NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tier_id          uuid  NOT NULL REFERENCES ticket_tiers(id) ON DELETE RESTRICT,
  quantity         int   NOT NULL CHECK (quantity > 0),
  unit_price_cents int   NOT NULL DEFAULT 0,
  unit_fee_cents   int   NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_tier_idx  ON order_items (tier_id);

-- ---------------------------------------------------------------------------
-- 3. tickets — one row per admission (the atomic unit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id        uuid        NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  event_id             uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tier_id              uuid        NOT NULL REFERENCES ticket_tiers(id) ON DELETE RESTRICT,
  owner_user_id        uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  serial               text        NOT NULL UNIQUE,
  attendee_name        text,
  status               text        NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','checked_in','void','refunded')),
  qr_version           int         NOT NULL DEFAULT 1,
  payment_due_at_door  boolean     NOT NULL DEFAULT false,
  checked_in_at        timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_event_idx ON tickets (event_id);
CREATE INDEX IF NOT EXISTS tickets_owner_idx ON tickets (owner_user_id);
-- Capacity math counts only these two states — partial index keeps it O(small).
CREATE INDEX IF NOT EXISTS tickets_tier_counted_idx
  ON tickets (tier_id) WHERE status IN ('valid','checked_in');

-- ---------------------------------------------------------------------------
-- 4. ticket_scans — append-only audit of every door scan attempt
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_scans (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid        REFERENCES tickets(id) ON DELETE SET NULL,
  event_id     uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  scanned_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  result       text        NOT NULL CHECK (result IN ('ok','duplicate','void','refunded','wrong_event','bad_signature','not_found')),
  raw          text,
  device_note  text,
  scanned_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_scans_event_idx ON ticket_scans (event_id, scanned_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Civic guards (bible pledge, both directions, at the schema level)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_tier_not_paid_civic()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.price_cents > 0 AND EXISTS (
    SELECT 1 FROM events e WHERE e.id = NEW.event_id AND e.is_civic
  ) THEN
    RAISE EXCEPTION 'civic_events_cannot_have_paid_tiers';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS ticket_tiers_civic_guard ON ticket_tiers;
CREATE TRIGGER ticket_tiers_civic_guard
  BEFORE INSERT OR UPDATE ON ticket_tiers
  FOR EACH ROW EXECUTE FUNCTION guard_tier_not_paid_civic();

CREATE OR REPLACE FUNCTION guard_event_civic_flip()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_civic AND NOT OLD.is_civic AND EXISTS (
    SELECT 1 FROM ticket_tiers t
    WHERE t.event_id = NEW.id AND t.price_cents > 0 AND t.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'event_with_paid_tiers_cannot_become_civic';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS events_civic_tier_guard ON events;
CREATE TRIGGER events_civic_tier_guard
  BEFORE UPDATE OF is_civic ON events
  FOR EACH ROW EXECUTE FUNCTION guard_event_civic_flip();

-- ---------------------------------------------------------------------------
-- 6. Serial generator — 'ALB-XXXX-XXXX', unambiguous alphabet (no 0/O/1/I/L)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_ticket_serial()
RETURNS text LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  s text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    s := s || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN 'ALB-' || substr(s, 1, 4) || '-' || substr(s, 5, 4);
END; $$;

-- ---------------------------------------------------------------------------
-- 7. tier_available — computed, never stored (schema principle #4).
--    capacity − issued (valid/checked_in) − live pending holds.
--    SECURITY DEFINER so anonymous visitors get availability without reading
--    the tickets table. STABLE: consistent within a statement.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tier_available(p_tier_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.capacity
    - COALESCE((SELECT count(*)::int FROM tickets tk
                WHERE tk.tier_id = t.id AND tk.status IN ('valid','checked_in')), 0)
    - COALESCE((SELECT sum(oi.quantity)::int
                FROM order_items oi
                JOIN orders o ON o.id = oi.order_id
                WHERE oi.tier_id = t.id
                  AND o.status = 'pending'
                  AND o.expires_at > now()), 0)
  FROM ticket_tiers t
  WHERE t.id = p_tier_id;
$$;

-- ---------------------------------------------------------------------------
-- 8. claim_free_tickets — the v1 purchase pipeline in ONE transaction.
--    Locks the tier row FOR UPDATE, so overselling is impossible by
--    construction. Free/zero-total orders need no pending hold: order is
--    created 'paid' (provider 'free') and tickets are issued atomically.
--    Errors are machine-readable message codes the UI translates ×4.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_free_tickets(p_tier_id uuid, p_quantity int)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_tier       ticket_tiers%ROWTYPE;
  v_ev_status  text;
  v_ev_civic   boolean;
  v_ev_listing text;
  v_ev_over    boolean;
  v_ev_org     uuid;
  v_email      text;
  v_have       int;
  v_avail      int;
  v_order_id   uuid;
  v_item_id    uuid;
  v_serial     text;
  v_tickets    jsonb := '[]'::jsonb;
  v_tid        uuid;
  i            int;
  attempt      int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'bad_quantity';
  END IF;

  SELECT * INTO v_tier FROM ticket_tiers WHERE id = p_tier_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tier_not_found';
  END IF;

  SELECT e.status, e.is_civic, e.listing_status, e.organizer_id,
         (COALESCE(e.end_date, e.date)
            < (now() AT TIME ZONE COALESCE(e.timezone, 'Europe/Tirane'))::date)
    INTO v_ev_status, v_ev_civic, v_ev_listing, v_ev_org, v_ev_over
  FROM events e WHERE e.id = v_tier.event_id;

  IF v_ev_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'event_not_published';
  END IF;
  -- v1 policy: civic events never ticket through this machine at all
  -- (attendance vocabulary only — bible pledge).
  IF v_ev_civic THEN
    RAISE EXCEPTION 'civic_not_ticketed';
  END IF;
  IF v_ev_listing = 'cancelled' THEN
    RAISE EXCEPTION 'event_cancelled';
  END IF;
  IF v_ev_over THEN
    RAISE EXCEPTION 'event_ended';
  END IF;

  IF v_tier.status <> 'active' THEN
    RAISE EXCEPTION 'tier_not_active';
  END IF;
  IF v_tier.visibility <> 'public' THEN
    RAISE EXCEPTION 'tier_not_available';        -- unlock codes are TIX-4
  END IF;
  IF v_tier.price_cents <> 0 THEN
    RAISE EXCEPTION 'paid_not_available';        -- paid tiers unlock with PAY
  END IF;
  IF v_tier.sales_start IS NOT NULL AND v_tier.sales_start > now() THEN
    RAISE EXCEPTION 'sales_not_started';
  END IF;
  IF v_tier.sales_end IS NOT NULL AND v_tier.sales_end <= now() THEN
    RAISE EXCEPTION 'sales_ended';
  END IF;
  IF p_quantity > v_tier.max_per_order THEN
    RAISE EXCEPTION 'over_max_per_order';
  END IF;

  -- Per-user-per-event cap: repeat orders must not drain free inventory
  -- (decision log 2026-07-12). Counted across the EVENT, not just the tier.
  SELECT count(*)::int INTO v_have
  FROM tickets tk
  WHERE tk.event_id = v_tier.event_id
    AND tk.owner_user_id = v_uid
    AND tk.status IN ('valid','checked_in');
  IF v_have + p_quantity > v_tier.max_per_order THEN
    RAISE EXCEPTION 'user_cap_reached';
  END IF;

  v_avail := tier_available(p_tier_id);
  IF v_avail IS NULL OR v_avail < p_quantity THEN
    RAISE EXCEPTION 'sold_out';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO orders (user_id, event_id, organizer_id, status, provider,
                      subtotal_cents, fee_cents, payment_cents, total_cents,
                      currency, contact_email, paid_at)
  VALUES (v_uid, v_tier.event_id, v_ev_org, 'paid', 'free',
          0, 0, 0, 0, v_tier.currency, v_email, now())
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (order_id, tier_id, quantity, unit_price_cents, unit_fee_cents)
  VALUES (v_order_id, p_tier_id, p_quantity, 0, 0)
  RETURNING id INTO v_item_id;

  FOR i IN 1..p_quantity LOOP
    attempt := 0;
    LOOP
      attempt := attempt + 1;
      v_serial := generate_ticket_serial();
      BEGIN
        INSERT INTO tickets (order_item_id, event_id, tier_id, owner_user_id, serial)
        VALUES (v_item_id, v_tier.event_id, p_tier_id, v_uid, v_serial)
        RETURNING id INTO v_tid;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempt >= 5 THEN
          RAISE EXCEPTION 'serial_collision';
        END IF;
      END;
    END LOOP;
    v_tickets := v_tickets || jsonb_build_object('id', v_tid, 'serial', v_serial);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'event_id', v_tier.event_id,
    'tickets', v_tickets
  );
END; $$;

-- ---------------------------------------------------------------------------
-- 9. check_in_ticket — atomic door verdict + append-only audit.
--    Two simultaneous scans of one ticket: exactly one GREEN; the loser reads
--    the row and reports duplicate with the original check-in time.
--    p_ticket_id NULL = client-side signature failure being logged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_in_ticket(
  p_event_id uuid,
  p_ticket_id uuid DEFAULT NULL,
  p_raw text DEFAULT NULL,
  p_device_note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_result    text;
  v_ticket    tickets%ROWTYPE;
  v_tier_name text;
  v_attendee  text;
  v_when      timestamptz;
  v_issued    int;
  v_in        int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT (is_admin() OR EXISTS (
    SELECT 1 FROM events e WHERE e.id = p_event_id AND e.organizer_id = v_uid
  )) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_ticket_id IS NULL THEN
    v_result := 'bad_signature';
  ELSE
    SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id;
    IF NOT FOUND THEN
      v_result := 'not_found';
    ELSIF v_ticket.event_id <> p_event_id THEN
      v_result := 'wrong_event';
    ELSE
      UPDATE tickets
        SET status = 'checked_in', checked_in_at = now()
        WHERE id = p_ticket_id AND status = 'valid'
        RETURNING * INTO v_ticket;
      IF FOUND THEN
        v_result := 'ok';
      ELSE
        SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id;
        v_result := CASE v_ticket.status
          WHEN 'checked_in' THEN 'duplicate'
          WHEN 'void'       THEN 'void'
          WHEN 'refunded'   THEN 'refunded'
          ELSE 'not_found'
        END;
      END IF;
      v_when := v_ticket.checked_in_at;
      SELECT t.name INTO v_tier_name FROM ticket_tiers t WHERE t.id = v_ticket.tier_id;
      SELECT COALESCE(v_ticket.attendee_name, u.email)
        INTO v_attendee
        FROM auth.users u WHERE u.id = v_ticket.owner_user_id;
    END IF;
  END IF;

  INSERT INTO ticket_scans (ticket_id, event_id, scanned_by, result, raw, device_note)
  VALUES (
    CASE WHEN v_result IN ('bad_signature','not_found') THEN NULL ELSE p_ticket_id END,
    p_event_id, v_uid, v_result, p_raw, p_device_note
  );

  -- Two plain counts on purpose: FILTER-aggregates directly before plpgsql's
  -- INTO clause trip the plpgsql parser (syntax error at or near INTO).
  SELECT count(*)::int INTO v_issued
    FROM tickets WHERE event_id = p_event_id AND status IN ('valid','checked_in');
  SELECT count(*)::int INTO v_in
    FROM tickets WHERE event_id = p_event_id AND status = 'checked_in';

  RETURN jsonb_build_object(
    'result', v_result,
    'serial', v_ticket.serial,
    'tier_name', v_tier_name,
    'attendee', v_attendee,
    'checked_in_at', v_when,
    'payment_due_at_door', COALESCE(v_ticket.payment_due_at_door, false),
    'stats', jsonb_build_object('issued', v_issued, 'checked_in', v_in)
  );
END; $$;

-- ---------------------------------------------------------------------------
-- 10. void_ticket — organizer of the event or admin; valid tickets only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION void_ticket(p_ticket_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_event uuid;
  v_updated int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT event_id INTO v_event FROM tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  IF NOT (is_admin() OR EXISTS (
    SELECT 1 FROM events e WHERE e.id = v_event AND e.organizer_id = v_uid
  )) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE tickets SET status = 'void' WHERE id = p_ticket_id AND status = 'valid';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN RAISE EXCEPTION 'ticket_not_voidable'; END IF;
END; $$;

-- ---------------------------------------------------------------------------
-- 11. Organizer tier CRUD (writes only via RPC; v1 forces price to 0)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION organizer_save_tier(
  p_event_id uuid,
  p_tier_id uuid,            -- NULL = create
  p_name text,
  p_description text,
  p_capacity int,
  p_max_per_order int,
  p_sales_start timestamptz,
  p_sales_end timestamptz,
  p_sort_order int
)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_issued int;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT (is_admin() OR EXISTS (
    SELECT 1 FROM events e WHERE e.id = p_event_id AND e.organizer_id = v_uid
  )) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF EXISTS (SELECT 1 FROM events e WHERE e.id = p_event_id AND e.is_civic) THEN
    RAISE EXCEPTION 'civic_not_ticketed';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF p_capacity IS NULL OR p_capacity < 1 THEN RAISE EXCEPTION 'bad_capacity'; END IF;
  IF p_max_per_order IS NULL OR p_max_per_order < 1 OR p_max_per_order > 10 THEN
    RAISE EXCEPTION 'bad_max_per_order';
  END IF;
  IF p_sales_start IS NOT NULL AND p_sales_end IS NOT NULL
     AND p_sales_end <= p_sales_start THEN
    RAISE EXCEPTION 'bad_sales_window';
  END IF;

  IF p_tier_id IS NULL THEN
    INSERT INTO ticket_tiers (event_id, name, description, price_cents, capacity,
                              max_per_order, sales_start, sales_end, sort_order)
    VALUES (p_event_id, trim(p_name), NULLIF(trim(COALESCE(p_description,'')),''), 0,
            p_capacity, p_max_per_order, p_sales_start, p_sales_end,
            COALESCE(p_sort_order, 0))
    RETURNING id INTO v_id;
  ELSE
    -- Capacity may never drop below what is already issued.
    SELECT count(*)::int INTO v_issued
    FROM tickets WHERE tier_id = p_tier_id AND status IN ('valid','checked_in');
    IF p_capacity < v_issued THEN
      RAISE EXCEPTION 'capacity_below_issued';
    END IF;
    UPDATE ticket_tiers
      SET name = trim(p_name),
          description = NULLIF(trim(COALESCE(p_description,'')),''),
          capacity = p_capacity,
          max_per_order = p_max_per_order,
          sales_start = p_sales_start,
          sales_end = p_sales_end,
          sort_order = COALESCE(p_sort_order, sort_order)
      WHERE id = p_tier_id AND event_id = p_event_id
      RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'tier_not_found'; END IF;
  END IF;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION organizer_set_tier_status(p_tier_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_event uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_status NOT IN ('active','paused','archived') THEN
    RAISE EXCEPTION 'bad_status';
  END IF;
  SELECT event_id INTO v_event FROM ticket_tiers WHERE id = p_tier_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'tier_not_found'; END IF;
  IF NOT (is_admin() OR EXISTS (
    SELECT 1 FROM events e WHERE e.id = v_event AND e.organizer_id = v_uid
  )) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE ticket_tiers SET status = p_status WHERE id = p_tier_id;
END; $$;

-- ---------------------------------------------------------------------------
-- 12. door_snapshot — one event's {ticket → qr_version/status} for offline
--     door verdicts. Compact keys on purpose (payload size at the door).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION door_snapshot(p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF NOT (is_admin() OR EXISTS (
    SELECT 1 FROM events e WHERE e.id = p_event_id AND e.organizer_id = v_uid
  )) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  RETURN jsonb_build_object(
    'tickets',
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'v', t.qr_version, 's', t.status))
              FROM tickets t WHERE t.event_id = p_event_id), '[]'::jsonb),
    'stats', (SELECT jsonb_build_object(
        'issued', count(*) FILTER (WHERE status IN ('valid','checked_in')),
        'checked_in', count(*) FILTER (WHERE status = 'checked_in'))
      FROM tickets WHERE event_id = p_event_id)
  );
END; $$;

-- ---------------------------------------------------------------------------
-- 13. RLS — every table enabled; reads scoped; ALL writes via the RPCs above
-- ---------------------------------------------------------------------------
ALTER TABLE ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_scans ENABLE ROW LEVEL SECURITY;

-- Anon may see ONLY public tiers of published events (hidden/unlock tiers
-- must not be publicly selectable — decision log 2026-07-12).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
             AND tablename='ticket_tiers' AND policyname='ticket_tiers_select') THEN
    DROP POLICY ticket_tiers_select ON ticket_tiers;
  END IF;
END $$;
CREATE POLICY ticket_tiers_select ON ticket_tiers FOR SELECT
  TO anon, authenticated
  USING (
    (visibility = 'public' AND EXISTS (
      SELECT 1 FROM events e WHERE e.id = event_id AND e.status = 'published'))
    OR is_admin()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
             AND tablename='orders' AND policyname='orders_select') THEN
    DROP POLICY orders_select ON orders;
  END IF;
END $$;
CREATE POLICY orders_select ON orders FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_admin()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
             AND tablename='order_items' AND policyname='order_items_select') THEN
    DROP POLICY order_items_select ON order_items;
  END IF;
END $$;
CREATE POLICY order_items_select ON order_items FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_id
      AND (o.user_id = auth.uid()
           OR is_admin()
           OR EXISTS (SELECT 1 FROM events e WHERE e.id = o.event_id AND e.organizer_id = auth.uid()))
  ));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
             AND tablename='tickets' AND policyname='tickets_select') THEN
    DROP POLICY tickets_select ON tickets;
  END IF;
END $$;
CREATE POLICY tickets_select ON tickets FOR SELECT
  TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR is_admin()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
  );

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
             AND tablename='ticket_scans' AND policyname='ticket_scans_select') THEN
    DROP POLICY ticket_scans_select ON ticket_scans;
  END IF;
END $$;
CREATE POLICY ticket_scans_select ON ticket_scans FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 14. Function grants — explicit; nothing executable by accident
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION tier_available(uuid) FROM public;
GRANT EXECUTE ON FUNCTION tier_available(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION claim_free_tickets(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION claim_free_tickets(uuid, int) TO authenticated;

REVOKE ALL ON FUNCTION check_in_ticket(uuid, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION check_in_ticket(uuid, uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION void_ticket(uuid) FROM public;
GRANT EXECUTE ON FUNCTION void_ticket(uuid) TO authenticated;

REVOKE ALL ON FUNCTION organizer_save_tier(uuid, uuid, text, text, int, int, timestamptz, timestamptz, int) FROM public;
GRANT EXECUTE ON FUNCTION organizer_save_tier(uuid, uuid, text, text, int, int, timestamptz, timestamptz, int) TO authenticated;

REVOKE ALL ON FUNCTION organizer_set_tier_status(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION organizer_set_tier_status(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION door_snapshot(uuid) FROM public;
GRANT EXECUTE ON FUNCTION door_snapshot(uuid) TO authenticated;

REVOKE ALL ON FUNCTION generate_ticket_serial() FROM public;

COMMIT;

-- Verify
SELECT
  (SELECT count(*) FROM ticket_tiers)  AS tiers,
  (SELECT count(*) FROM orders)        AS orders,
  (SELECT count(*) FROM tickets)       AS tickets,
  (SELECT count(*) FROM ticket_scans)  AS scans;
