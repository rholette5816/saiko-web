-- Phase 7A: dine-in table orders

alter table orders
  add column if not exists table_number text;

create index if not exists orders_table_open_idx
  on orders(table_number, status)
  where table_number is not null and status in ('preparing','ready');

-- RPC: open a new round for a table.
-- Creates an order with status='preparing', table_number stamped, NO payment fields yet.
-- VAT breakdown computed per round so each round's OR is BIR-compliant.
-- Senior/PWD is NOT handled here; applied at close-bill time.

create or replace function place_table_round(
  p_table_number text,
  p_subtotal numeric,
  p_notes text,
  p_items jsonb
)
returns table (
  order_id uuid,
  order_number text,
  or_number text,
  vatable_sales numeric,
  vat_amount numeric
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
begin
  if p_table_number is null or trim(p_table_number) = '' then
    raise exception 'Table number is required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  select * into v_settings from business_settings limit 1;

  v_or_number := next_or_number();
  v_tracking_token := replace(gen_random_uuid()::text, '-', '');

  if coalesce(v_settings.vat_registered, false) then
    v_vat := round(p_subtotal * v_settings.vat_rate / (100 + v_settings.vat_rate), 2);
    v_vatable := p_subtotal - v_vat;
  end if;

  insert into orders (
    customer_name, customer_phone, pickup_label, pickup_time,
    is_pre_order, notes, subtotal, total_amount, status, channel,
    table_number, or_number, vatable_sales, vat_amount, tracking_token
  )
  values (
    'Table ' || p_table_number, 'dine-in', 'Dine-in (now)', now(),
    false, nullif(trim(coalesce(p_notes, '')), ''),
    p_subtotal, p_subtotal, 'preparing', 'counter',
    trim(p_table_number), v_or_number, v_vatable, v_vat, v_tracking_token
  )
  returning id, orders.order_number, or_number into v_order_id, v_order_number, v_or_number;

  insert into order_items (order_id, item_id, item_name, unit_price, quantity, line_total)
  select v_order_id, item_id, item_name, unit_price, quantity, line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text, item_name text, unit_price numeric,
    quantity integer, line_total numeric
  );

  return query select v_order_id, v_order_number, v_or_number, v_vatable, v_vat;
end;
$fn$;

revoke all on function place_table_round(text, numeric, text, jsonb) from public;
grant execute on function place_table_round(text, numeric, text, jsonb) to authenticated;

-- RPC: close all open rounds for a table.
-- Aggregates totals, applies Senior/PWD discount if requested, updates payment fields.
-- Returns aggregated info for the printed bill.

create or replace function close_table_bill(
  p_table_number text,
  p_payment_method text,
  p_amount_received numeric,
  p_senior_pwd boolean,
  p_senior_pwd_id text,
  p_senior_pwd_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_settings business_settings%rowtype;
  v_subtotal numeric := 0;
  v_senior_discount numeric := 0;
  v_total numeric := 0;
  v_vatable numeric := 0;
  v_vat numeric := 0;
  v_vat_exempt numeric := 0;
  v_or_first text;
  v_or_last text;
  v_round_count integer;
  v_rounds jsonb;
begin
  if p_table_number is null or trim(p_table_number) = '' then
    raise exception 'Table number is required';
  end if;

  select * into v_settings from business_settings limit 1;

  -- Aggregate subtotal across open rounds for this table.
  select coalesce(sum(subtotal), 0), min(or_number), max(or_number), count(*)
    into v_subtotal, v_or_first, v_or_last, v_round_count
    from orders
   where table_number = trim(p_table_number)
     and status in ('preparing','ready');

  if v_round_count = 0 then
    raise exception 'No open rounds for table %', p_table_number;
  end if;

  -- Compute taxes / discount on the aggregated subtotal.
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

  -- Snapshot of every round being closed (returned to the client for the printed bill).
  select jsonb_agg(jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'or_number', o.or_number,
    'created_at', o.created_at,
    'subtotal', o.subtotal,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'item_name', oi.item_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'line_total', oi.line_total
      ) order by oi.id)
      from order_items oi where oi.order_id = o.id
    )
  ) order by o.created_at)
  into v_rounds
  from orders o
  where o.table_number = trim(p_table_number)
    and o.status in ('preparing','ready');

  -- Close every open round atomically and stamp the payment + senior/pwd fields.
  update orders
     set status = 'completed',
         payment_method = nullif(trim(coalesce(p_payment_method, '')), ''),
         amount_received = p_amount_received,
         senior_pwd_discount = case
           when p_senior_pwd then round(subtotal * 0.20, 2)
           else 0
         end,
         senior_pwd_id = case when p_senior_pwd then nullif(trim(coalesce(p_senior_pwd_id, '')), '') else null end,
         senior_pwd_name = case when p_senior_pwd then nullif(trim(coalesce(p_senior_pwd_name, '')), '') else null end,
         vat_exempt_sales = case when p_senior_pwd then subtotal - round(subtotal * 0.20, 2) else 0 end,
         vat_amount = case when p_senior_pwd then 0 else vat_amount end,
         vatable_sales = case when p_senior_pwd then 0 else vatable_sales end
   where table_number = trim(p_table_number)
     and status in ('preparing','ready');

  return jsonb_build_object(
    'table_number', trim(p_table_number),
    'rounds', v_rounds,
    'round_count', v_round_count,
    'or_first', v_or_first,
    'or_last', v_or_last,
    'subtotal', v_subtotal,
    'senior_discount', v_senior_discount,
    'vatable_sales', v_vatable,
    'vat_amount', v_vat,
    'vat_exempt_sales', v_vat_exempt,
    'total', v_total,
    'payment_method', nullif(trim(coalesce(p_payment_method, '')), ''),
    'amount_received', p_amount_received,
    'change', greatest(coalesce(p_amount_received, 0) - v_total, 0),
    'senior_pwd', coalesce(p_senior_pwd, false),
    'senior_pwd_id', nullif(trim(coalesce(p_senior_pwd_id, '')), ''),
    'senior_pwd_name', nullif(trim(coalesce(p_senior_pwd_name, '')), '')
  );
end;
$fn$;

revoke all on function close_table_bill(text, text, numeric, boolean, text, text) from public;
grant execute on function close_table_bill(text, text, numeric, boolean, text, text) to authenticated;
