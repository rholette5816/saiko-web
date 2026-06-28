-- Offline POS support for Tables: queuing "add a round to an already-open
-- table" while offline must never create a duplicate round if the sync
-- retries after a dropped response.

alter table order_rounds add column if not exists client_request_id uuid;
create unique index if not exists order_rounds_client_request_id_idx on order_rounds(client_request_id) where client_request_id is not null;

drop function if exists place_table_round(text, numeric, text, jsonb);

create or replace function place_table_round(
  p_table_number text,
  p_subtotal numeric,
  p_notes text,
  p_items jsonb,
  p_client_request_id uuid default null
)
returns table (
  order_id uuid,
  order_number text,
  or_number text,
  round_id uuid,
  vatable_sales numeric,
  vat_amount numeric
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_table_number text;
  v_order orders%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_or_number text;
  v_tracking_token text;
  v_settings business_settings%rowtype;
  v_round_id uuid;
  v_round_no integer;
  v_parent_subtotal numeric := 0;
  v_vatable numeric := 0;
  v_vat numeric := 0;
  v_existing_round order_rounds%rowtype;
begin
  if p_client_request_id is not null then
    select * into v_existing_round from order_rounds where client_request_id = p_client_request_id;
    if found then
      select * into v_order from orders where id = v_existing_round.order_id;
      return query select v_order.id, v_order.order_number, v_order.or_number, v_existing_round.id, v_order.vatable_sales, v_order.vat_amount;
      return;
    end if;
  end if;

  v_table_number := trim(coalesce(p_table_number, ''));
  if v_table_number = '' then
    raise exception 'Table number is required';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  select * into v_settings from business_settings limit 1;

  select * into v_order
    from orders
   where (table_number = v_table_number or v_table_number = any(linked_tables))
     and status in ('preparing','ready')
   order by created_at
   limit 1
   for update;

  if found then
    v_order_id := v_order.id;
    v_order_number := v_order.order_number;
    v_or_number := v_order.or_number;
  else
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
      'Table ' || v_table_number, 'dine-in', 'Dine-in (now)', now(),
      false, nullif(trim(coalesce(p_notes, '')), ''),
      p_subtotal, p_subtotal, 'preparing', 'counter',
      v_table_number, v_or_number, v_vatable, v_vat, v_tracking_token
    )
    returning id, orders.order_number, orders.or_number into v_order_id, v_order_number, v_or_number;
  end if;

  select coalesce(max(round_no), 0) + 1
    into v_round_no
    from order_rounds
   where order_rounds.order_id = v_order_id;

  insert into order_rounds (order_id, round_no, notes, subtotal, client_request_id)
  values (v_order_id, v_round_no, nullif(trim(coalesce(p_notes, '')), ''), p_subtotal, p_client_request_id)
  returning id into v_round_id;

  insert into order_items (order_id, round_id, item_id, item_name, unit_price, quantity, line_total)
  select v_order_id, v_round_id, item_id, item_name, unit_price, quantity, line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text,
    item_name text,
    unit_price numeric,
    quantity integer,
    line_total numeric
  );

  select coalesce(sum(subtotal), 0)
    into v_parent_subtotal
    from order_rounds
   where order_rounds.order_id = v_order_id
     and status = 'active';

  v_vat := 0;
  v_vatable := 0;
  if coalesce(v_settings.vat_registered, false) then
    v_vat := round(v_parent_subtotal * v_settings.vat_rate / (100 + v_settings.vat_rate), 2);
    v_vatable := v_parent_subtotal - v_vat;
  end if;

  update orders
     set subtotal = v_parent_subtotal,
         total_amount = v_parent_subtotal,
         vatable_sales = v_vatable,
         vat_amount = v_vat,
         billed_out_at = null
   where id = v_order_id
   returning orders.order_number, orders.or_number into v_order_number, v_or_number;

  return query select v_order_id, v_order_number, v_or_number, v_round_id, v_vatable, v_vat;
end;
$fn$;

revoke all on function place_table_round(text, numeric, text, jsonb, uuid) from public;
grant execute on function place_table_round(text, numeric, text, jsonb, uuid) to authenticated;
