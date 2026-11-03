-- Seller WhatsApp for seat sales. Buyers tap "Questions?" or "I've paid" and
-- /api/seats/whatsapp forwards them to wa.me with a ready-made message, so
-- the number never sits in a page. Stored next to the payment details in
-- the admin-only seat_payment_settings (same RLS).

alter table public.seat_payment_settings
  -- International digits without "+" (E.164), e.g. 491512345678.
  add column whatsapp text check (whatsapp is null or whatsapp ~ '^[1-9][0-9]{7,14}$'),
  -- false = only buyers with a reservation get the button.
  add column whatsapp_public boolean not null default true;
