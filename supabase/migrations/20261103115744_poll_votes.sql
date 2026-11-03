-- Fan polls ("Who wins?" on a fight page). Anonymous: one vote per browser
-- session per poll, voting again changes the pick. Only the server
-- (/api/polls/[key], service role) reads or writes; visitors see totals.

create table public.poll_votes (
  poll       text not null check (poll ~ '^[a-z0-9-]{1,60}$'),
  session_id uuid not null,
  choice     text not null check (choice ~ '^[a-z0-9-]{1,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll, session_id)
);

-- RLS on with no policies: anon and signed-in users can't read or write.
alter table public.poll_votes enable row level security;
revoke all on public.poll_votes from anon, authenticated;

create function public.poll_totals(p_poll text)
returns table (choice text, votes bigint)
language sql
stable
set search_path = public
as $$
  select choice, count(*) from poll_votes where poll = p_poll group by choice
$$;

-- Supabase grants new functions to anon/authenticated directly; this one is
-- for the server only.
revoke execute on function public.poll_totals(text) from public, anon, authenticated;
grant execute on function public.poll_totals(text) to service_role;
