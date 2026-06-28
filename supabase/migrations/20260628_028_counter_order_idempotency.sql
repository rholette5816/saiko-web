-- Offline POS support: a sync retry after a dropped response must never
-- create a duplicate paid counter order. Client generates one uuid per
-- order attempt and resends the same one if it has to retry after reconnecting.

alter table orders add column if not exists client_request_id uuid;
create unique index if not exists orders_client_request_id_idx on orders(client_request_id) where client_request_id is not null;

drop function if exists place_counter_order(text, text, numeric, numeric, text, numeric, text, boolean, text, text, text, numeric, jsonb);

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
  p_service_type text,
  p_takeout_charge numeric,
  p_items jsonb,
  p_client_request_id uuid default null
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
  v_existing orders%rowtype;
begin
  if p_client_request_id is not null then
    select * into v_existing from orders where client_request_id = p_client_request_id;
    if found then
      return query select
        v_existing.id,
        v_existing.order_number,
        v_existing.or_number,
        v_existing.vatable_sales,
        v_existing.vat_amount,
        v_existing.vat_exempt_sales,
        v_existing.senior_pwd_discount;
      return;
    end if;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  if p_service_type is not null and p_service_type not in ('dine-in', 'takeout') then
    raise exception 'Invalid service type';
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
    service_type,
    takeout_charge,
    tracking_token,
    client_request_id
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
    p_service_type,
    coalesce(p_takeout_charge, 0),
    v_tracking_token,
    p_client_request_id
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

revoke all on function place_counter_order(text, text, numeric, numeric, text, numeric, text, boolean, text, text, text, numeric, jsonb, uuid) from public;
grant execute on function place_counter_order(text, text, numeric, numeric, text, numeric, text, boolean, text, text, text, numeric, jsonb, uuid) to authenticated;
