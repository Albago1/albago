-- Phase 33b — FK fix: deleting an event with claimed tickets failed with
-- "violates foreign key constraint order_items_tier_id_fkey".
--
-- Cause: events → ticket_tiers and events → orders both CASCADE, but the
-- cross-links inside the subtree (order_items.tier_id, tickets.tier_id,
-- tickets.order_item_id) were RESTRICT, which Postgres checks IMMEDIATELY —
-- even when the referencing rows are being deleted by the same statement.
--
-- Fix: make those three NO ACTION DEFERRABLE INITIALLY DEFERRED. A whole-
-- event delete passes (the subtree is empty by commit); deleting a tier that
-- still has orders/tickets is still rejected — just at commit time.
--
-- Idempotent: safe to re-run.

BEGIN;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_tier_id_fkey;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_tier_id_fkey
    FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_order_item_id_fkey;
ALTER TABLE tickets
  ADD CONSTRAINT tickets_order_item_id_fkey
    FOREIGN KEY (order_item_id) REFERENCES order_items(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_tier_id_fkey;
ALTER TABLE tickets
  ADD CONSTRAINT tickets_tier_id_fkey
    FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id)
    ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;

COMMIT;

-- Verify: all three should show condeferrable = true
SELECT conname, condeferrable, condeferred
FROM pg_constraint
WHERE conname IN (
  'order_items_tier_id_fkey',
  'tickets_order_item_id_fkey',
  'tickets_tier_id_fkey'
);
