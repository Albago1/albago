-- =============================================================================
-- BC-1 — Broadcast foundation: accounts, posts, campaigns, storage, RPCs
-- =============================================================================
-- Admin-only social distribution engine (docs/master-plan/06-broadcast.md).
-- All tables are deny-all RLS; every access path is a SECURITY DEFINER RPC
-- gated on is_admin(). Credentials are AES-GCM encrypted at the app layer
-- BEFORE insert — the database only ever sees an opaque blob.
-- =============================================================================

-- 1. Tables ------------------------------------------------------------------

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('telegram','instagram','facebook','x','tiktok')),
  label text not null,
  handle text,
  credentials text,
  meta jsonb not null default '{}'::jsonb,
  status text not null default 'connected'
    check (status in ('connected','expiring','error','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_accounts enable row level security;  -- deny-all

create table if not exists public.social_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.social_campaigns enable row level security;  -- deny-all

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  kind text not null check (kind in ('image','carousel','story','reel','link','text')),
  caption text not null default '',
  asset_urls text[] not null default '{}',
  scheduled_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft','queued','publishing','published','failed','cancelled')),
  external_id text,
  external_url text,
  error text,
  attempts int not null default 0,
  campaign_id uuid references public.social_campaigns(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists social_posts_due_idx
  on public.social_posts (status, scheduled_at);
alter table public.social_posts enable row level security;  -- deny-all

-- 2. Storage bucket for rendered assets (public read — IG must fetch URLs) ---

insert into storage.buckets (id, name, public)
  values ('social-assets', 'social-assets', true)
  on conflict (id) do nothing;

drop policy if exists social_assets_admin_write on storage.objects;
create policy social_assets_admin_write
  on storage.objects for insert to authenticated
  with check (bucket_id = 'social-assets' and public.is_admin());

drop policy if exists social_assets_admin_delete on storage.objects;
create policy social_assets_admin_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'social-assets' and public.is_admin());

drop policy if exists social_assets_public_read on storage.objects;
create policy social_assets_public_read
  on storage.objects for select to public
  using (bucket_id = 'social-assets');

-- 3. RPCs ---------------------------------------------------------------------

-- Connect/refresh an account. One row per platform+handle.
create or replace function public.broadcast_upsert_account(
  p_platform text,
  p_label text,
  p_handle text,
  p_credentials text,
  p_meta jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select id into v_id
    from public.social_accounts
   where platform = p_platform and handle = p_handle;

  if v_id is null then
    insert into public.social_accounts (platform, label, handle, credentials, meta)
    values (p_platform, p_label, p_handle, p_credentials, p_meta)
    returning id into v_id;
  else
    update public.social_accounts
       set label = p_label,
           credentials = p_credentials,
           meta = p_meta,
           status = 'connected',
           updated_at = now()
     where id = v_id;
  end if;

  return v_id;
end;
$$;
grant execute on function public.broadcast_upsert_account(text, text, text, text, jsonb) to authenticated;

-- List accounts WITHOUT credentials (queue/composer UI).
create or replace function public.broadcast_list_accounts()
returns table (
  id uuid,
  platform text,
  label text,
  handle text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select a.id, a.platform, a.label, a.handle, a.status, a.created_at
    from public.social_accounts a
   where public.is_admin()
   order by a.created_at asc
$$;
grant execute on function public.broadcast_list_accounts() to authenticated;

-- Queue a post (BC-1: published immediately after by the publish route).
create or replace function public.broadcast_create_post(
  p_event_id uuid,
  p_account_id uuid,
  p_kind text,
  p_caption text,
  p_asset_urls text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  insert into public.social_posts (event_id, account_id, kind, caption, asset_urls, status)
  values (p_event_id, p_account_id, p_kind, coalesce(p_caption, ''), coalesce(p_asset_urls, '{}'), 'queued')
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.broadcast_create_post(uuid, uuid, text, text, text[]) to authenticated;

-- Claim a post for publishing (atomic; also used by the BC-3 scheduler tick).
create or replace function public.broadcast_claim_post(p_id uuid)
returns table (
  id uuid,
  kind text,
  caption text,
  asset_urls text[],
  platform text,
  credentials text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  with claimed as (
    update public.social_posts p
       set status = 'publishing',
           attempts = p.attempts + 1
     where p.id = p_id
       and p.status in ('queued', 'failed')
       and p.attempts < 5
    returning p.id, p.kind, p.caption, p.asset_urls, p.account_id
  )
  select c.id, c.kind, c.caption, c.asset_urls, a.platform, a.credentials
    from claimed c
    join public.social_accounts a on a.id = c.account_id;
end;
$$;
grant execute on function public.broadcast_claim_post(uuid) to authenticated;

-- Record the outcome of a publish attempt.
create or replace function public.broadcast_finish_post(
  p_id uuid,
  p_status text,
  p_external_id text,
  p_external_url text,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('published', 'failed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  update public.social_posts
     set status = p_status,
         external_id = p_external_id,
         external_url = p_external_url,
         error = p_error,
         published_at = case when p_status = 'published' then now() else published_at end
   where id = p_id;
end;
$$;
grant execute on function public.broadcast_finish_post(uuid, text, text, text, text) to authenticated;

-- Recent posts for the queue UI (joined labels, no credentials).
create or replace function public.broadcast_list_posts(p_limit int default 50)
returns table (
  id uuid,
  kind text,
  caption text,
  status text,
  external_url text,
  error text,
  created_at timestamptz,
  published_at timestamptz,
  event_title text,
  account_label text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.kind, p.caption, p.status, p.external_url, p.error,
         p.created_at, p.published_at,
         e.title as event_title,
         a.label as account_label
    from public.social_posts p
    left join public.events e on e.id = p.event_id
    join public.social_accounts a on a.id = p.account_id
   where public.is_admin()
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200))
$$;
grant execute on function public.broadcast_list_posts(int) to authenticated;
