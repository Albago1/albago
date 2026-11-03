-- How buyers pay for a seat sale: the bank account behind the scan-to-pay
-- QR code (GiroCode / EPC) and a PayPal.me name. Private: only admins read
-- or write it (RLS). Buyers never read this table — /api/seats/[id]/pay
-- draws the QR code on the server for the owner of a held reservation and
-- never sends the name or IBAN as text.

create table public.seat_payment_settings (
  event_id    uuid primary key references public.seat_sales(event_id) on delete cascade,
  bank_holder text check (bank_holder is null or length(bank_holder) between 2 and 70),
  iban        text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  bic         text check (bic is null or bic ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'),
  paypal_me   text check (paypal_me is null or paypal_me ~ '^[A-Za-z0-9]{1,20}$'),
  updated_at  timestamptz not null default now(),
  -- A bank account needs both the holder's name and the IBAN.
  check ((bank_holder is null) = (iban is null))
);

alter table public.seat_payment_settings enable row level security;
revoke all on public.seat_payment_settings from anon;

create policy seat_payment_settings_admin_select on public.seat_payment_settings
  for select to authenticated using (is_admin());
create policy seat_payment_settings_admin_insert on public.seat_payment_settings
  for insert to authenticated with check (is_admin());
create policy seat_payment_settings_admin_update on public.seat_payment_settings
  for update to authenticated using (is_admin()) with check (is_admin());
create policy seat_payment_settings_admin_delete on public.seat_payment_settings
  for delete to authenticated using (is_admin());
