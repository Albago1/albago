-- Phase 47: ticket allocations ("Sitzplätze auf Anfrage").
-- Tickets sold by count per block, exact seats assigned later by the seller.
-- See docs/phase-47-ticket-allocations-plan.md. Apply after a yes.

CREATE TABLE public.seat_allocations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES public.seat_sales(event_id) ON DELETE CASCADE,
  label       text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  area        text NOT NULL CHECK (length(area) BETWEEN 1 AND 80),
  blocks      text[] NOT NULL DEFAULT '{}' CHECK (cardinality(blocks) <= 10),
  rows_label  text CHECK (rows_label IS NULL OR length(rows_label) BETWEEN 1 AND 40),
  quantity    int NOT NULL CHECK (quantity BETWEEN 0 AND 10000),
  price_cents int NOT NULL CHECK (price_cents BETWEEN 0 AND 10000000),
  note        text CHECK (note IS NULL OR length(note) BETWEEN 1 AND 200),
  active      boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seat_allocations_event_idx ON public.seat_allocations (event_id);
ALTER TABLE public.seat_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY seat_allocations_admin ON public.seat_allocations FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Orders on an allocation. RESTRICT: an allocation with orders can only be paused.
ALTER TABLE public.seat_reservations
  ADD COLUMN allocation_id uuid REFERENCES public.seat_allocations(id) ON DELETE RESTRICT;
CREATE INDEX seat_reservations_allocation_idx ON public.seat_reservations (allocation_id) WHERE allocation_id IS NOT NULL;

-- Tickets of an allocation that are taken: live holds and every order past payment.
CREATE FUNCTION public.seat_allocation_taken(p_allocation_id uuid) RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE(sum(r.quantity), 0)::int
    FROM seat_reservations r
   WHERE r.allocation_id = p_allocation_id
     AND (r.status IN ('paid','transfer_sent','delivered')
          OR (r.status = 'held' AND (r.expires_at IS NULL OR r.expires_at > now())));
$fn$;

-- Buyer reserves N tickets of an allocation (same hold / guard as seats).
CREATE FUNCTION public.seat_reserve_allocation(p_event_id uuid, p_allocation_id uuid, p_quantity int, p_buyer_name text, p_eventim_email text, p_phone text, p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_sale     seat_sales%ROWTYPE;
  v_alloc    seat_allocations%ROWTYPE;
  v_email    text;
  v_eventim  text := lower(btrim(COALESCE(p_eventim_email, '')));
  v_res_id   uuid;
  v_ref      text;
  v_expires  timestamptz;
  attempt    int := 0;
BEGIN
  -- Takes the sale row lock (buyers queue here), sweeps lapsed holds,
  -- checks sale open, quantity, details and the per-buyer cap.
  PERFORM seat_guard_reserve(p_event_id, p_quantity, p_buyer_name, p_eventim_email, p_phone, p_note);

  SELECT * INTO v_sale FROM seat_sales WHERE event_id = p_event_id;
  SELECT * INTO v_alloc FROM seat_allocations
   WHERE id = p_allocation_id AND event_id = p_event_id FOR UPDATE;
  IF NOT FOUND OR NOT v_alloc.active THEN
    RAISE EXCEPTION 'category_not_on_sale';
  END IF;
  IF v_alloc.quantity - seat_allocation_taken(v_alloc.id) < p_quantity THEN
    RAISE EXCEPTION 'sold_out';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  v_expires := now() + make_interval(mins => v_sale.hold_minutes);

  LOOP
    attempt := attempt + 1;
    v_ref := generate_seat_reference();
    BEGIN
      INSERT INTO seat_reservations (
        event_id, user_id, created_by, source, reference, status,
        category, category_label, quantity, unit_price_cents, total_cents,
        currency, buyer_name, buyer_email, eventim_email, phone, note, seats,
        expires_at, allocation_id
      ) VALUES (
        p_event_id, auth.uid(), auth.uid(), 'online', v_ref, 'held',
        'allocation', v_alloc.label, p_quantity, v_alloc.price_cents, v_alloc.price_cents * p_quantity,
        v_sale.currency, btrim(COALESCE(p_buyer_name, '')), COALESCE(v_email, v_eventim), v_eventim,
        NULLIF(btrim(COALESCE(p_phone, '')), ''), NULLIF(btrim(COALESCE(p_note, '')), ''), '[]'::jsonb,
        v_expires, v_alloc.id
      )
      RETURNING id INTO v_res_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt >= 5 THEN
        RAISE EXCEPTION 'reference_collision';
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_res_id, 'reference', v_ref, 'status', 'held',
    'category', 'allocation', 'category_label', v_alloc.label,
    'quantity', p_quantity, 'total_cents', v_alloc.price_cents * p_quantity,
    'currency', v_sale.currency, 'seats', '[]'::jsonb, 'expires_at', v_expires,
    'allocation_id', v_alloc.id
  );
END; $fn$;

-- Seller fills in the real seats of an allocation order (exactly one per ticket).
CREATE FUNCTION public.seat_admin_assign_seats(p_reservation_id uuid, p_seats jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_res    seat_reservations%ROWTYPE;
  v_seats  jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO v_res FROM seat_reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation_not_found';
  END IF;
  IF v_res.allocation_id IS NULL THEN
    RAISE EXCEPTION 'bad_action';
  END IF;
  IF v_res.status NOT IN ('held','paid','transfer_sent','delivered') THEN
    RAISE EXCEPTION 'bad_transition';
  END IF;
  IF p_seats IS NULL OR jsonb_typeof(p_seats) <> 'array' OR jsonb_array_length(p_seats) <> v_res.quantity THEN
    RAISE EXCEPTION 'bad_quantity';
  END IF;
  SELECT jsonb_agg(jsonb_build_object('area', x.area, 'block', x.block, 'row', x."row", 'seat', x.seat)
                   ORDER BY x.block, x."row", x.seat)
    INTO v_seats
    FROM jsonb_to_recordset(p_seats) AS x(area text, block text, "row" text, seat int)
   WHERE length(btrim(COALESCE(x.area, ''))) BETWEEN 1 AND 80
     AND length(btrim(COALESCE(x.block, ''))) BETWEEN 1 AND 20
     AND length(btrim(COALESCE(x."row", ''))) BETWEEN 1 AND 20
     AND x.seat BETWEEN 1 AND 10000;
  IF v_seats IS NULL OR jsonb_array_length(v_seats) <> v_res.quantity THEN
    RAISE EXCEPTION 'bad_details';
  END IF;
  UPDATE seat_reservations SET seats = v_seats WHERE id = v_res.id;
  SELECT * INTO v_res FROM seat_reservations WHERE id = p_reservation_id;
  RETURN to_jsonb(v_res);
END; $fn$;

-- Admin order steps: allocation orders have no linked stock rows, so the
-- "seats still linked" checks apply to seat orders only.
CREATE OR REPLACE FUNCTION public.seat_admin_update(p_reservation_id uuid, p_action text, p_payment_method text, p_payment_ref text, p_admin_note text, p_release boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
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
  SELECT * INTO v_sale FROM seat_sales WHERE event_id = v_event_id FOR UPDATE;
  SELECT * INTO v_res FROM seat_reservations WHERE id = p_reservation_id FOR UPDATE;

  IF p_payment_method IS NOT NULL
     AND p_payment_method NOT IN ('bank_transfer','cash','card','paypal','stripe','other') THEN
    RAISE EXCEPTION 'bad_details';
  END IF;

  IF p_action IN ('mark_paid','extend_hold') AND v_res.status = 'expired' THEN
    RAISE EXCEPTION 'hold_expired';
  END IF;
  -- An allocation hold that ran out (not swept yet) can't be paid or extended.
  IF p_action IN ('mark_paid','extend_hold') AND v_res.allocation_id IS NOT NULL
     AND v_res.status = 'held' AND v_res.expires_at IS NOT NULL AND v_res.expires_at <= now() THEN
    RAISE EXCEPTION 'hold_expired';
  END IF;

  IF p_action = 'mark_paid' THEN
    IF v_res.status <> 'held' THEN
      RAISE EXCEPTION 'bad_transition';
    END IF;
    IF v_res.allocation_id IS NULL THEN
      SELECT count(*)::int INTO v_linked FROM seat_stock WHERE reservation_id = v_res.id;
      IF v_linked <> v_res.quantity THEN
        RAISE EXCEPTION 'hold_expired';
      END IF;
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
    IF v_res.allocation_id IS NULL THEN
      SELECT count(*)::int INTO v_linked FROM seat_stock WHERE reservation_id = v_res.id;
      IF v_linked <> v_res.quantity THEN
        RAISE EXCEPTION 'hold_expired';
      END IF;
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

-- Public sale data gains the allocations (active ones, with what's left).
CREATE OR REPLACE FUNCTION public.seat_sale_public(p_event_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_sale    seat_sales%ROWTYPE;
  v_cats    jsonb;
  v_blocks  jsonb;
  v_runs    jsonb;
  v_seats   jsonb;
  v_allocs  jsonb;
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', a.id, 'label', a.label, 'area', a.area, 'blocks', to_jsonb(a.blocks),
           'rows', a.rows_label, 'price_cents', a.price_cents, 'note', a.note,
           'available', GREATEST(a.quantity - seat_allocation_taken(a.id), 0))
           ORDER BY a.sort_order, a.price_cents, a.label), '[]'::jsonb)
    INTO v_allocs
    FROM seat_allocations a
   WHERE a.event_id = p_event_id AND a.active;

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
    'allocations', v_allocs,
    'rules', jsonb_build_object(
      'protect', v_sale.protect_singles,
      'phase', seat_phase(p_event_id),
      'flexible_from', v_sale.flexible_from,
      'final_from', v_sale.final_from,
      'overrides', v_sale.quantity_overrides
    )
  );
END; $fn$;

-- Grants (Supabase grants new public functions to anon + authenticated directly).
REVOKE EXECUTE ON FUNCTION public.seat_allocation_taken(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seat_reserve_allocation(uuid, uuid, int, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.seat_reserve_allocation(uuid, uuid, int, text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.seat_admin_assign_seats(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.seat_admin_assign_seats(uuid, jsonb) TO authenticated;
