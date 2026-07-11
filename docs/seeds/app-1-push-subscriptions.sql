-- APP-1 (master plan 03-apps.md): push_subscriptions
-- One table for all push channels: web push now, FCM/APNs tokens when the
-- APP-2 Capacitor shells ship — a token is just a row with a kind.
-- Run in the Supabase SQL editor.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'webpush' check (kind in ('webpush', 'fcm', 'apns')),
  -- Web push: the subscription endpoint URL. FCM/APNs: the device token.
  endpoint text not null,
  -- Web push encryption keys (null for fcm/apns rows).
  p256dh text,
  auth text,
  -- Targeting hints captured at subscribe time.
  locale text,
  city_slug text,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (endpoint)
);

alter table public.push_subscriptions enable row level security;

-- Per-user RLS (repo pattern: select/insert/delete own rows, no UPDATE —
-- re-subscribes are delete + insert). Sending reads via the service role.
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);
