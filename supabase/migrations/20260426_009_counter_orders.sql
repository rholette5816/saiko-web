-- Phase 5A: counter / walk-in orders. Adds channel + payment fields and a dedicated RPC.

alter table orders
  add column if not exists channel text not null default 'web'
    check (channel in ('web', 'counter')),
  add column if not exists payment_method text,
  add column if not exists amount_received numeric(10,2)
    check (amount_received is null or amount_received >= 0);

create index if not exists orders_channel_idx on orders(channel);

create or replace function place_counter_order(
  p_customer_name text,
  p_customer_phone text,
  p_total_amount numeric,
  p_payment_method text,
  p_amount_received numeric,
  p_notes text,
  p_items jsonb
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order_id uuid;
  v_order_number text;
  v_tracking_token text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  v_tracking_token := replace(gen_random_uuid()::text, '-', '');

  insert into orders (
    customer_name,
    customer_phone,
    pickup_label,
    pickup_time,
    is_pre_order,
    notes,
    total_amount,
    status,
    channel,
    payment_method,
    amount_received,
    tracking_token
  )
  values (
    coalesce(nullif(trim(p_customer_name), ''), 'Walk-in'),
    coalesce(nullif(trim(p_customer_phone), ''), 'walk-in'),
    'Walk-in (now)',
    now(),
    false,
    nullif(trim(coalesce(p_notes, '')), ''),
    p_total_amount,
    'completed',
    'counter',
    nullif(trim(coalesce(p_payment_method, '')), ''),
    p_amount_received,
    v_tracking_token
  )
  returning id, orders.order_number into v_order_id, v_order_number;

  insert into order_items (order_id, item_id, item_name, unit_price, quantity, line_total)
  select v_order_id, item_id, item_name, unit_price, quantity, line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text,
    item_name text,
    unit_price numeric,
    quantity integer,
    line_total numeric
  );

  return query select v_order_id, v_order_number;
end;
$fn$;

revoke all on function place_counter_order(text, text, numeric, text, numeric, text, jsonb) from public;
grant execute on function place_counter_order(text, text, numeric, text, numeric, text, jsonb) to authenticated;
