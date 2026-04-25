-- Phase 1 hotfix: atomic order placement RPC for anon checkout
-- Avoids anon SELECT requirements when returning order_number.

create or replace function place_order_with_items(
  p_customer_name text,
  p_customer_phone text,
  p_pickup_label text,
  p_pickup_time timestamptz,
  p_is_pre_order boolean,
  p_notes text,
  p_total_amount numeric,
  p_items jsonb
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  insert into orders (
    customer_name,
    customer_phone,
    pickup_label,
    pickup_time,
    is_pre_order,
    notes,
    total_amount
  )
  values (
    trim(p_customer_name),
    trim(p_customer_phone),
    p_pickup_label,
    p_pickup_time,
    coalesce(p_is_pre_order, false),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_total_amount
  )
  returning id, orders.order_number into v_order_id, v_order_number;

  insert into order_items (order_id, item_id, item_name, unit_price, quantity, line_total)
  select
    v_order_id,
    item_id,
    item_name,
    unit_price,
    quantity,
    line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text,
    item_name text,
    unit_price numeric,
    quantity integer,
    line_total numeric
  );

  return query select v_order_id, v_order_number;
end;
$$;

revoke all on function place_order_with_items(
  text,
  text,
  text,
  timestamptz,
  boolean,
  text,
  numeric,
  jsonb
) from public;

grant execute on function place_order_with_items(
  text,
  text,
  text,
  timestamptz,
  boolean,
  text,
  numeric,
  jsonb
) to anon, authenticated;
