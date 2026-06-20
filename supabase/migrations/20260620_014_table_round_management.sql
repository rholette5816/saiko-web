-- Manage open dine-in table rounds before billing.

create or replace function update_table_round_items(
  p_order_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order orders%rowtype;
  v_updated orders%rowtype;
  v_settings business_settings%rowtype;
  v_subtotal numeric := 0;
  v_vatable numeric := 0;
  v_vat numeric := 0;
begin
  select * into v_order
    from orders
   where id = p_order_id
     and status in ('preparing','ready');

  if not found then
    raise exception 'Order is not open';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  delete from order_items
   where order_id = p_order_id;

  insert into order_items (order_id, item_id, item_name, unit_price, quantity, line_total)
  select p_order_id, item_id, item_name, unit_price, quantity, line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text,
    item_name text,
    unit_price numeric,
    quantity integer,
    line_total numeric
  );

  select coalesce(sum(line_total), 0)
    into v_subtotal
    from order_items
   where order_id = p_order_id;

  select * into v_settings from business_settings limit 1;

  if coalesce(v_settings.vat_registered, false) then
    v_vat := round(v_subtotal * v_settings.vat_rate / (100 + v_settings.vat_rate), 2);
    v_vatable := v_subtotal - v_vat;
  end if;

  update orders
     set subtotal = v_subtotal,
         total_amount = v_subtotal,
         vatable_sales = v_vatable,
         vat_amount = v_vat,
         kitchen_ticket_printed_at = null,
         kitchen_ticket_print_count = 0,
         bar_ticket_printed_at = null,
         bar_ticket_print_count = 0,
         notes = (
           select nullif(string_agg(note_line, E'\n' order by ord), '')
             from regexp_split_to_table(coalesce(v_order.notes, ''), E'\\r?\\n') with ordinality as note(note_line, ord)
            where not (
              lower(trim(note_line)) like '[printed:kitchen|%]'
              or lower(trim(note_line)) like '[printed:bar|%]'
            )
         )
   where id = p_order_id
   returning * into v_updated;

  return to_jsonb(v_updated);
end;
$fn$;

revoke all on function update_table_round_items(uuid, jsonb) from public;
grant execute on function update_table_round_items(uuid, jsonb) to authenticated;

create or replace function cancel_table_round(
  p_order_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order orders%rowtype;
  v_reason text;
  v_cancel_tag text;
begin
  select * into v_order
    from orders
   where id = p_order_id
     and status in ('preparing','ready');

  if not found then
    raise exception 'Order is not open';
  end if;

  v_reason := nullif(
    trim(replace(replace(replace(coalesce(p_reason, ''), ']', ''), E'\r', ' '), E'\n', ' ')),
    ''
  );
  if v_reason is null then
    v_reason := 'Cancelled by staff';
  end if;
  v_cancel_tag := '[cancelled:' || v_reason || '|' || now()::text || ']';

  update orders
     set status = 'cancelled',
         notes = concat_ws(E'\n', nullif(trim(coalesce(notes, '')), ''), v_cancel_tag)
   where id = p_order_id
     and status in ('preparing','ready');

  return true;
end;
$fn$;

revoke all on function cancel_table_round(uuid, text) from public;
grant execute on function cancel_table_round(uuid, text) to authenticated;

create or replace function transfer_table_round(
  p_order_id uuid,
  p_new_table_number text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order orders%rowtype;
  v_updated orders%rowtype;
  v_new_table_number text;
begin
  select * into v_order
    from orders
   where id = p_order_id
     and status in ('preparing','ready');

  if not found then
    raise exception 'Order is not open';
  end if;

  v_new_table_number := trim(coalesce(p_new_table_number, ''));
  if v_new_table_number = '' then
    raise exception 'New table number is required';
  end if;

  if v_new_table_number = coalesce(v_order.table_number, '') then
    raise exception 'New table must differ from current table';
  end if;

  update orders
     set table_number = v_new_table_number
   where id = p_order_id
   returning * into v_updated;

  return to_jsonb(v_updated);
end;
$fn$;

revoke all on function transfer_table_round(uuid, text) from public;
grant execute on function transfer_table_round(uuid, text) to authenticated;
