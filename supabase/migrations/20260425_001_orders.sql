-- Phase 1: orders + order_items + sequential order numbers + RLS

create extension if not exists "pgcrypto";

create sequence if not exists order_number_seq start 1;

create or replace function next_saiko_order_number()
returns text
language sql
as $$
  select 'SAIKO-' || lpad(nextval('order_number_seq')::text, 4, '0');
$$;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default next_saiko_order_number(),
  customer_name text not null,
  customer_phone text not null,
  pickup_label text not null,
  pickup_time timestamptz not null,
  is_pre_order boolean not null default false,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','preparing','ready','completed','cancelled')),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(10,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_status_idx on orders(status);
create index if not exists orders_created_at_idx on orders(created_at desc);
create index if not exists order_items_order_id_idx on order_items(order_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- RLS
alter table orders enable row level security;
alter table order_items enable row level security;

-- anon: INSERT only (customers placing orders from the web)
drop policy if exists "anon insert orders" on orders;
create policy "anon insert orders"
  on orders for insert
  to anon
  with check (true);

drop policy if exists "anon insert order items" on order_items;
create policy "anon insert order items"
  on order_items for insert
  to anon
  with check (true);

-- authenticated: full read/update/delete (admin dashboard, Phase 2)
drop policy if exists "auth read orders" on orders;
create policy "auth read orders"
  on orders for select
  to authenticated
  using (true);

drop policy if exists "auth update orders" on orders;
create policy "auth update orders"
  on orders for update
  to authenticated
  using (true) with check (true);

drop policy if exists "auth delete orders" on orders;
create policy "auth delete orders"
  on orders for delete
  to authenticated
  using (true);

drop policy if exists "auth read order items" on order_items;
create policy "auth read order items"
  on order_items for select
  to authenticated
  using (true);

drop policy if exists "auth delete order items" on order_items;
create policy "auth delete order items"
  on order_items for delete
  to authenticated
  using (true);

-- service_role bypasses RLS entirely. Botcake will use service_role to read orders by order_number.
