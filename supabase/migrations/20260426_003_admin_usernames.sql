-- Phase 2.1: username alias lookup for admin login
-- Allows login form to accept username or email while Supabase Auth remains email/password.

create table if not exists admin_usernames (
  username text primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table admin_usernames enable row level security;

-- Keep table private: no direct select policies for anon/authenticated.
-- Username lookup is exposed through a narrow RPC only.

create or replace function resolve_admin_email(input_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email
  from admin_usernames
  where lower(username) = lower(trim(input_username))
  limit 1;
$$;

revoke all on function resolve_admin_email(text) from public;
grant execute on function resolve_admin_email(text) to anon, authenticated;
