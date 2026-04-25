-- Phase 3: item_overrides for admin-controlled availability + best-seller flags

create table if not exists item_overrides (
  item_id text primary key,
  is_available boolean not null default true,
  is_best_seller boolean not null default false,
  updated_at timestamptz not null default now()
);

create or replace function set_item_overrides_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists item_overrides_set_updated_at on item_overrides;
create trigger item_overrides_set_updated_at
  before update on item_overrides
  for each row execute function set_item_overrides_updated_at();

alter table item_overrides enable row level security;

-- anon: SELECT only (public menu reads to show sold-out and best-seller states)
drop policy if exists "anon read item overrides" on item_overrides;
create policy "anon read item overrides"
  on item_overrides for select
  to anon
  using (true);

-- authenticated: full read/write (admin)
drop policy if exists "auth read item overrides" on item_overrides;
create policy "auth read item overrides"
  on item_overrides for select
  to authenticated
  using (true);

drop policy if exists "auth upsert item overrides" on item_overrides;
create policy "auth upsert item overrides"
  on item_overrides for insert
  to authenticated
  with check (true);

drop policy if exists "auth update item overrides" on item_overrides;
create policy "auth update item overrides"
  on item_overrides for update
  to authenticated
  using (true) with check (true);
