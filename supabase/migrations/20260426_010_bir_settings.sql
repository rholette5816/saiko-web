-- Phase 5B: business settings, BIR-compliant fields on orders, sequential OR numbers, senior/PWD, updated counter RPC.

create table if not exists business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'SAIKO RAMEN & SUSHI',
  business_tin text,
  business_address text,
  business_contact text,
  vat_registered boolean not null default false,
  vat_rate numeric(5,2) not null default 12.00,
  or_prefix text not null default 'SAIKO-OR',
  or_next_number integer not null default 1,
  receipt_footer text,
  is_bir_accredited boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into business_settings (business_name)
select 'SAIKO RAMEN & SUSHI'
where not exists (select 1 from business_settings);

create or replace function set_business_settings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_settings_set_updated_at on business_settings;
create trigger business_settings_set_updated_at
  before update on business_settings
  for each row execute function set_business_settings_updated_at();

alter table business_settings enable row level security;

drop policy if exists "anon read business settings" on business_settings;
create policy "anon read business settings"
  on business_settings for select
  to anon
  using (true);

drop policy if exists "auth manage business settings" on business_settings;
create policy "auth manage business settings"
  on business_settings for all
  to authenticated
  using (true) with check (true);

alter table orders
  add column if not exists subtotal numeric(10,2),
  add column if not exists or_number text,
  add column if not exists vat_amount numeric(10,2) not null default 0
    check (vat_amount >= 0),
  add column if not exists vatable_sales numeric(10,2) not null default 0
    check (vatable_sales >= 0),
  add column if not exists vat_exempt_sales numeric(10,2) not null default 0
    check (vat_exempt_sales >= 0),
  add column if not exists senior_pwd_discount numeric(10,2) not null default 0
    check (senior_pwd_discount >= 0),
  add column if not exists senior_pwd_id text,
  add column if not exists senior_pwd_name text;

create unique index if not exists orders_or_number_idx on orders(or_number) where or_number is not null;
create index if not exists orders_senior_pwd_idx on orders(senior_pwd_id) where senior_pwd_id is not null;

create or replace function next_or_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings business_settings%rowtype;
  v_number integer;
  v_or_number text;
begin
  update business_settings
     set or_next_number = or_next_number + 1
   returning * into v_settings;

  v_number := v_settings.or_next_number - 1;
  v_or_number := v_settings.or_prefix || '-' || lpad(v_number::text, 4, '0');

  return v_or_number;
end;
$$;

revoke all on function next_or_number() from public;
grant execute on function next_or_number() to authenticated;

drop function if exists place_counter_order(text, text, numeric, text, numeric, text, jsonb);

create or replace function place_counter_order(
  p_customer_name text,
  p_customer_phone text,
  p_subtotal numeric,
  p_total_amount numeric,
  p_payment_method text,
  p_amount_received numeric,
  p_notes text,
  p_senior_pwd boolean,
  p_senior_pwd_id text,
  p_senior_pwd_name text,
  p_items jsonb
)
returns table (
  order_id uuid,
  order_number text,
  or_number text,
  vatable_sales numeric,
  vat_amount numeric,
  vat_exempt_sales numeric,
  senior_pwd_discount numeric
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order_id uuid;
  v_order_number text;
  v_or_number text;
  v_tracking_token text;
  v_settings business_settings%rowtype;
  v_vatable numeric := 0;
  v_vat numeric := 0;
  v_vat_exempt numeric := 0;
  v_senior_discount numeric := 0;
  v_total numeric := p_total_amount;
  v_subtotal numeric := p_subtotal;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  select * into v_settings from business_settings limit 1;

  v_or_number := next_or_number();
  v_tracking_token := replace(gen_random_uuid()::text, '-', '');

  if p_senior_pwd then
    v_senior_discount := round(v_subtotal * 0.20, 2);
    v_vat_exempt := v_subtotal - v_senior_discount;
    v_total := v_vat_exempt;
  elsif coalesce(v_settings.vat_registered, false) then
    v_vat := round(v_subtotal * v_settings.vat_rate / (100 + v_settings.vat_rate), 2);
    v_vatable := v_subtotal - v_vat;
    v_total := v_subtotal;
  else
    v_total := v_subtotal;
  end if;

  insert into orders (
    customer_name,
    customer_phone,
    pickup_label,
    pickup_time,
    is_pre_order,
    notes,
    subtotal,
    total_amount,
    status,
    channel,
    payment_method,
    amount_received,
    or_number,
    vatable_sales,
    vat_amount,
    vat_exempt_sales,
    senior_pwd_discount,
    senior_pwd_id,
    senior_pwd_name,
    tracking_token
  )
  values (
    coalesce(nullif(trim(p_customer_name), ''), 'Walk-in'),
    coalesce(nullif(trim(p_customer_phone), ''), 'walk-in'),
    'Walk-in (now)',
    now(),
    false,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_subtotal,
    v_total,
    'completed',
    'counter',
    nullif(trim(coalesce(p_payment_method, '')), ''),
    p_amount_received,
    v_or_number,
    v_vatable,
    v_vat,
    v_vat_exempt,
    v_senior_discount,
    nullif(trim(coalesce(p_senior_pwd_id, '')), ''),
    nullif(trim(coalesce(p_senior_pwd_name, '')), ''),
    v_tracking_token
  )
  returning id, orders.order_number, or_number into v_order_id, v_order_number, v_or_number;

  insert into order_items (order_id, item_id, item_name, unit_price, quantity, line_total)
  select v_order_id, item_id, item_name, unit_price, quantity, line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text,
    item_name text,
    unit_price numeric,
    quantity integer,
    line_total numeric
  );

  return query select v_order_id, v_order_number, v_or_number, v_vatable, v_vat, v_vat_exempt, v_senior_discount;
end;
$fn$;

revoke all on function place_counter_order(text, text, numeric, numeric, text, numeric, text, boolean, text, text, jsonb) from public;
grant execute on function place_counter_order(text, text, numeric, numeric, text, numeric, text, boolean, text, text, jsonb) to authenticated;
