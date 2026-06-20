-- Consolidate dine-in table rounds under one parent order.

create table if not exists order_rounds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  round_no integer not null,
  notes text,
  subtotal numeric not null default 0,
  status text not null default 'active' check (status in ('active','cancelled')),
  kitchen_ticket_printed_at timestamptz,
  kitchen_ticket_print_count integer not null default 0,
  bar_ticket_printed_at timestamptz,
  bar_ticket_print_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (order_id, round_no)
);

alter table order_rounds enable row level security;

drop policy if exists "auth read order rounds" on order_rounds;
create policy "auth read order rounds"
  on order_rounds for select
  to authenticated
  using (true);

drop policy if exists "auth insert order rounds" on order_rounds;
create policy "auth insert order rounds"
  on order_rounds for insert
  to authenticated
  with check (true);

drop policy if exists "auth update order rounds" on order_rounds;
create policy "auth update order rounds"
  on order_rounds for update
  to authenticated
  using (true) with check (true);

alter table order_items
  add column if not exists round_id uuid references order_rounds(id);

drop function if exists place_table_round(text, numeric, text, jsonb);

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
begin
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
   where table_number = v_table_number
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
   where order_id = v_order_id;

  insert into order_rounds (order_id, round_no, notes, subtotal)
  values (v_order_id, v_round_no, nullif(trim(coalesce(p_notes, '')), ''), p_subtotal)
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
   where order_id = v_order_id
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
         vat_amount = v_vat
   where id = v_order_id
   returning orders.order_number, orders.or_number into v_order_number, v_or_number;

  return query select v_order_id, v_order_number, v_or_number, v_round_id, v_vatable, v_vat;
end;
$fn$;

revoke all on function place_table_round(text, numeric, text, jsonb) from public;
grant execute on function place_table_round(text, numeric, text, jsonb) to authenticated;

drop function if exists update_table_round_items(uuid, jsonb);

create or replace function update_table_round_items(
  p_round_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_round order_rounds%rowtype;
  v_updated order_rounds%rowtype;
  v_settings business_settings%rowtype;
  v_round_subtotal numeric := 0;
  v_parent_subtotal numeric := 0;
  v_vatable numeric := 0;
  v_vat numeric := 0;
begin
  select r.* into v_round
    from order_rounds r
    join orders o on o.id = r.order_id
   where r.id = p_round_id
     and r.status = 'active'
     and o.status in ('preparing','ready')
   for update of r;

  if not found then
    raise exception 'Order is not open';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  perform 1
    from orders
   where id = v_round.order_id
   for update;

  delete from order_items
   where round_id = p_round_id;

  insert into order_items (order_id, round_id, item_id, item_name, unit_price, quantity, line_total)
  select v_round.order_id, p_round_id, item_id, item_name, unit_price, quantity, line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text,
    item_name text,
    unit_price numeric,
    quantity integer,
    line_total numeric
  );

  select coalesce(sum(line_total), 0)
    into v_round_subtotal
    from order_items
   where round_id = p_round_id;

  update order_rounds
     set subtotal = v_round_subtotal,
         kitchen_ticket_printed_at = null,
         kitchen_ticket_print_count = 0,
         bar_ticket_printed_at = null,
         bar_ticket_print_count = 0,
         notes = (
           select nullif(string_agg(note_line, E'\n' order by ord), '')
             from regexp_split_to_table(coalesce(v_round.notes, ''), E'\\r?\\n') with ordinality as note(note_line, ord)
            where not (
              lower(trim(note_line)) like '[printed:kitchen|%]'
              or lower(trim(note_line)) like '[printed:bar|%]'
            )
         )
   where id = p_round_id
   returning * into v_updated;

  select coalesce(sum(subtotal), 0)
    into v_parent_subtotal
    from order_rounds
   where order_id = v_round.order_id
     and status = 'active';

  select * into v_settings from business_settings limit 1;

  if coalesce(v_settings.vat_registered, false) then
    v_vat := round(v_parent_subtotal * v_settings.vat_rate / (100 + v_settings.vat_rate), 2);
    v_vatable := v_parent_subtotal - v_vat;
  end if;

  update orders
     set subtotal = v_parent_subtotal,
         total_amount = v_parent_subtotal,
         vatable_sales = v_vatable,
         vat_amount = v_vat
   where id = v_round.order_id;

  return to_jsonb(v_updated);
end;
$fn$;

revoke all on function update_table_round_items(uuid, jsonb) from public;
grant execute on function update_table_round_items(uuid, jsonb) to authenticated;

drop function if exists cancel_table_round(uuid, text);

create or replace function cancel_table_round(
  p_round_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_round order_rounds%rowtype;
  v_settings business_settings%rowtype;
  v_reason text;
  v_cancel_tag text;
  v_parent_subtotal numeric := 0;
  v_vatable numeric := 0;
  v_vat numeric := 0;
begin
  select r.* into v_round
    from order_rounds r
    join orders o on o.id = r.order_id
   where r.id = p_round_id
     and r.status = 'active'
     and o.status in ('preparing','ready')
   for update of r;

  if not found then
    raise exception 'Order is not open';
  end if;

  perform 1
    from orders
   where id = v_round.order_id
   for update;

  v_reason := nullif(
    trim(replace(replace(replace(coalesce(p_reason, ''), ']', ''), E'\r', ' '), E'\n', ' ')),
    ''
  );
  if v_reason is null then
    v_reason := 'Cancelled by staff';
  end if;
  v_cancel_tag := '[cancelled:' || v_reason || '|' || now()::text || ']';

  update order_rounds
     set status = 'cancelled',
         notes = concat_ws(E'\n', nullif(trim(coalesce(notes, '')), ''), v_cancel_tag)
   where id = p_round_id
     and status = 'active';

  select coalesce(sum(subtotal), 0)
    into v_parent_subtotal
    from order_rounds
   where order_id = v_round.order_id
     and status = 'active';

  select * into v_settings from business_settings limit 1;

  if coalesce(v_settings.vat_registered, false) then
    v_vat := round(v_parent_subtotal * v_settings.vat_rate / (100 + v_settings.vat_rate), 2);
    v_vatable := v_parent_subtotal - v_vat;
  end if;

  update orders
     set subtotal = v_parent_subtotal,
         total_amount = v_parent_subtotal,
         vatable_sales = v_vatable,
         vat_amount = v_vat
   where id = v_round.order_id;

  return true;
end;
$fn$;

revoke all on function cancel_table_round(uuid, text) from public;
grant execute on function cancel_table_round(uuid, text) to authenticated;

drop function if exists transfer_table_round(uuid, text);

create or replace function transfer_table_round(
  p_round_id uuid,
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
  select o.* into v_order
    from order_rounds r
    join orders o on o.id = r.order_id
   where r.id = p_round_id
     and o.status in ('preparing','ready')
   for update of o;

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

  if exists (
    select 1
      from orders
     where table_number = v_new_table_number
       and status in ('preparing','ready')
       and id <> v_order.id
  ) then
    raise exception 'Table % already has an open order', v_new_table_number;
  end if;

  update orders
     set table_number = v_new_table_number
   where id = v_order.id
   returning * into v_updated;

  return to_jsonb(v_updated);
end;
$fn$;

revoke all on function transfer_table_round(uuid, text) from public;
grant execute on function transfer_table_round(uuid, text) to authenticated;

create or replace function mark_table_ticket_printed(
  p_order_id uuid,
  p_kind text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_order_id is null then
    raise exception 'Order ID is required';
  end if;

  if p_kind = 'kitchen' then
    update order_rounds r
       set kitchen_ticket_printed_at = now(),
           kitchen_ticket_print_count = coalesce(kitchen_ticket_print_count, 0) + 1
     where r.id = p_order_id
       and r.status = 'active'
       and exists (
         select 1
           from orders o
          where o.id = r.order_id
            and o.status in ('preparing','ready')
       );
  elsif p_kind = 'bar' then
    update order_rounds r
       set bar_ticket_printed_at = now(),
           bar_ticket_print_count = coalesce(bar_ticket_print_count, 0) + 1
     where r.id = p_order_id
       and r.status = 'active'
       and exists (
         select 1
           from orders o
          where o.id = r.order_id
            and o.status in ('preparing','ready')
       );
  else
    raise exception 'Ticket kind must be kitchen or bar';
  end if;

  if not found then
    raise exception 'Round % was not found', p_order_id;
  end if;
end;
$fn$;

revoke all on function mark_table_ticket_printed(uuid, text) from public;
grant execute on function mark_table_ticket_printed(uuid, text) to authenticated;

drop function if exists close_table_bill(text, text, numeric, boolean, text, text);
drop function if exists close_table_bill(text, text, numeric, jsonb);

create or replace function close_table_bill(
  p_table_number text,
  p_payment_method text,
  p_amount_received numeric,
  p_discount_allocations jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_settings business_settings%rowtype;
  v_order orders%rowtype;
  v_table_number text;
  v_bill_group_id uuid := gen_random_uuid();
  v_subtotal numeric := 0;
  v_discount_gross numeric := 0;
  v_discount_total numeric := 0;
  v_discount_vat_removed numeric := 0;
  v_vat_exempt numeric := 0;
  v_discount_net numeric := 0;
  v_regular_gross numeric := 0;
  v_vatable numeric := 0;
  v_vat numeric := 0;
  v_total numeric := 0;
  v_or_first text;
  v_or_last text;
  v_round_count integer;
  v_rounds jsonb;
  v_discounts jsonb;
  v_holder_ids text;
  v_holder_names text;
  v_allocations jsonb := coalesce(p_discount_allocations, '[]'::jsonb);
begin
  v_table_number := trim(coalesce(p_table_number, ''));
  if v_table_number = '' then
    raise exception 'Table number is required';
  end if;

  if jsonb_typeof(v_allocations) <> 'array' then
    raise exception 'Discount allocations must be an array';
  end if;

  select * into v_settings from business_settings limit 1;

  select * into v_order
    from orders
   where table_number = v_table_number
     and status in ('preparing','ready')
   order by created_at
   limit 1
   for update;

  if not found then
    raise exception 'No open rounds for table %', v_table_number;
  end if;

  select coalesce(sum(subtotal), 0), count(*)
    into v_subtotal, v_round_count
    from order_rounds
   where order_id = v_order.id
     and status = 'active';

  v_or_first := v_order.or_number;
  v_or_last := v_order.or_number;

  if v_round_count = 0 then
    raise exception 'No open rounds for table %', v_table_number;
  end if;

  create temporary table if not exists tmp_table_bill_allocations (
    holder_ref text,
    holder_type text,
    holder_name text,
    holder_id_number text,
    discount_rate numeric,
    order_item_id uuid,
    quantity integer
  ) on commit drop;
  truncate tmp_table_bill_allocations;

  insert into tmp_table_bill_allocations (
    holder_ref,
    holder_type,
    holder_name,
    holder_id_number,
    discount_rate,
    order_item_id,
    quantity
  )
  select
    nullif(trim(coalesce(holder_ref, '')), ''),
    lower(trim(coalesce(holder_type, ''))),
    nullif(trim(coalesce(holder_name, '')), ''),
    nullif(trim(coalesce(holder_id_number, '')), ''),
    discount_rate,
    order_item_id,
    quantity
  from jsonb_to_recordset(v_allocations) as x(
    holder_ref text,
    holder_type text,
    holder_name text,
    holder_id_number text,
    discount_rate numeric,
    order_item_id uuid,
    quantity integer
  );

  delete from tmp_table_bill_allocations
   where coalesce(quantity, 0) <= 0;

  if exists (
    select 1
      from tmp_table_bill_allocations
     where holder_type not in ('senior','pwd')
        or holder_name is null
        or holder_id_number is null
        or discount_rate is null
        or discount_rate < 0
        or discount_rate > 100
        or order_item_id is null
  ) then
    raise exception 'Discount holder, ID, rate, and item quantity are required';
  end if;

  if exists (
    select 1
      from tmp_table_bill_allocations a
      left join order_items oi on oi.id = a.order_item_id
      left join order_rounds r on r.id = oi.round_id
      left join orders o on o.id = oi.order_id
     where oi.id is null
        or oi.order_id <> v_order.id
        or r.id is null
        or r.order_id <> v_order.id
        or r.status <> 'active'
        or o.status not in ('preparing','ready')
  ) then
    raise exception 'Discount item does not belong to an open round on this table';
  end if;

  if exists (
    select 1
      from tmp_table_bill_allocations a
      join order_items oi on oi.id = a.order_item_id
     group by a.order_item_id, oi.quantity
    having sum(a.quantity) > max(oi.quantity)
  ) then
    raise exception 'Discounted quantity cannot exceed ordered quantity';
  end if;

  create temporary table if not exists tmp_table_bill_discount_lines (
    holder_ref text,
    holder_type text,
    holder_name text,
    holder_id_number text,
    discount_rate numeric,
    order_id uuid,
    order_item_id uuid,
    item_id text,
    item_name text,
    unit_price numeric,
    quantity integer,
    gross_amount numeric,
    vat_removed_amount numeric,
    vat_exempt_sales numeric,
    discount_amount numeric,
    net_amount numeric
  ) on commit drop;
  truncate tmp_table_bill_discount_lines;

  insert into tmp_table_bill_discount_lines (
    holder_ref,
    holder_type,
    holder_name,
    holder_id_number,
    discount_rate,
    order_id,
    order_item_id,
    item_id,
    item_name,
    unit_price,
    quantity,
    gross_amount,
    vat_removed_amount,
    vat_exempt_sales,
    discount_amount,
    net_amount
  )
  select
    coalesce(a.holder_ref, a.holder_type || ':' || a.holder_id_number),
    a.holder_type,
    a.holder_name,
    a.holder_id_number,
    round(a.discount_rate, 2),
    oi.order_id,
    oi.id,
    oi.item_id,
    oi.item_name,
    oi.unit_price,
    a.quantity,
    round(oi.unit_price * a.quantity, 2),
    case when coalesce(v_settings.vat_registered, false)
      then round((oi.unit_price * a.quantity) - ((oi.unit_price * a.quantity) / (1 + (v_settings.vat_rate / 100))), 2)
      else 0
    end,
    case when coalesce(v_settings.vat_registered, false)
      then round((oi.unit_price * a.quantity) / (1 + (v_settings.vat_rate / 100)), 2)
      else round(oi.unit_price * a.quantity, 2)
    end,
    0,
    0
  from tmp_table_bill_allocations a
  join order_items oi on oi.id = a.order_item_id;

  update tmp_table_bill_discount_lines
     set discount_amount = round(vat_exempt_sales * discount_rate / 100, 2),
         net_amount = greatest(vat_exempt_sales - round(vat_exempt_sales * discount_rate / 100, 2), 0)
   where true;

  select
    coalesce(sum(gross_amount), 0),
    coalesce(sum(vat_removed_amount), 0),
    coalesce(sum(vat_exempt_sales), 0),
    coalesce(sum(discount_amount), 0),
    coalesce(sum(net_amount), 0)
    into v_discount_gross, v_discount_vat_removed, v_vat_exempt, v_discount_total, v_discount_net
    from tmp_table_bill_discount_lines;

  v_regular_gross := greatest(v_subtotal - v_discount_gross, 0);
  if coalesce(v_settings.vat_registered, false) then
    v_vat := round(v_regular_gross * v_settings.vat_rate / (100 + v_settings.vat_rate), 2);
    v_vatable := v_regular_gross - v_vat;
  else
    v_vat := 0;
    v_vatable := 0;
  end if;
  v_total := round(v_regular_gross + v_discount_net, 2);

  select string_agg(distinct holder_id_number, ', '), string_agg(distinct holder_name, ', ')
    into v_holder_ids, v_holder_names
    from tmp_table_bill_discount_lines;

  insert into table_bill_discounts (
    bill_group_id,
    order_id,
    order_item_id,
    holder_type,
    holder_name,
    holder_id_number,
    discount_rate,
    item_id,
    item_name,
    unit_price,
    quantity,
    gross_amount,
    vat_removed_amount,
    vat_exempt_sales,
    discount_amount,
    net_amount
  )
  select
    v_bill_group_id,
    order_id,
    order_item_id,
    holder_type,
    holder_name,
    holder_id_number,
    discount_rate,
    item_id,
    item_name,
    unit_price,
    quantity,
    gross_amount,
    vat_removed_amount,
    vat_exempt_sales,
    discount_amount,
    net_amount
  from tmp_table_bill_discount_lines;

  update orders
     set status = 'completed',
         bill_group_id = v_bill_group_id,
         payment_method = nullif(trim(coalesce(p_payment_method, '')), ''),
         amount_received = p_amount_received,
         subtotal = v_subtotal,
         total_amount = v_total,
         senior_pwd_discount = v_discount_total,
         senior_pwd_id = case when v_discount_total > 0 then v_holder_ids else null end,
         senior_pwd_name = case when v_discount_total > 0 then v_holder_names else null end,
         vat_exempt_sales = v_vat_exempt,
         vat_amount = v_vat,
         vatable_sales = v_vatable
   where id = v_order.id;

  select jsonb_agg(jsonb_build_object(
    'round_id', r.id,
    'round_no', r.round_no,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'or_number', v_order.or_number,
    'created_at', r.created_at,
    'subtotal', r.subtotal,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'item_id', oi.item_id,
        'item_name', oi.item_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'line_total', oi.line_total
      ) order by oi.id)
      from order_items oi where oi.round_id = r.id
    )
  ) order by r.round_no)
  into v_rounds
  from order_rounds r
  where r.order_id = v_order.id
    and r.status = 'active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'holder_ref', holder_ref,
    'holder_type', holder_type,
    'holder_name', holder_name,
    'holder_id_number', holder_id_number,
    'discount_rate', discount_rate,
    'order_id', order_id,
    'order_item_id', order_item_id,
    'item_id', item_id,
    'item_name', item_name,
    'unit_price', unit_price,
    'quantity', quantity,
    'gross_amount', gross_amount,
    'vat_removed_amount', vat_removed_amount,
    'vat_exempt_sales', vat_exempt_sales,
    'discount_amount', discount_amount,
    'net_amount', net_amount
  ) order by holder_name, item_name), '[]'::jsonb)
  into v_discounts
  from tmp_table_bill_discount_lines;

  return jsonb_build_object(
    'bill_group_id', v_bill_group_id,
    'table_number', v_table_number,
    'rounds', v_rounds,
    'round_count', v_round_count,
    'or_first', v_or_first,
    'or_last', v_or_last,
    'subtotal', v_subtotal,
    'discount_gross', v_discount_gross,
    'vat_removed_amount', v_discount_vat_removed,
    'senior_discount', v_discount_total,
    'vatable_sales', v_vatable,
    'vat_amount', v_vat,
    'vat_exempt_sales', v_vat_exempt,
    'total', v_total,
    'payment_method', nullif(trim(coalesce(p_payment_method, '')), ''),
    'amount_received', p_amount_received,
    'change', greatest(coalesce(p_amount_received, 0) - v_total, 0),
    'senior_pwd', v_discount_total > 0,
    'senior_pwd_id', v_holder_ids,
    'senior_pwd_name', v_holder_names,
    'discounts', v_discounts
  );
end;
$fn$;

revoke all on function close_table_bill(text, text, numeric, jsonb) from public;
grant execute on function close_table_bill(text, text, numeric, jsonb) to authenticated;
