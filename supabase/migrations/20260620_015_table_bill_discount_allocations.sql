-- Item-level Senior and PWD discount allocations for table bills.

alter table orders
  add column if not exists bill_group_id uuid;

create table if not exists table_bill_discounts (
  id uuid primary key default gen_random_uuid(),
  bill_group_id uuid not null,
  order_id uuid not null references orders(id) on delete cascade,
  order_item_id uuid references order_items(id) on delete set null,
  holder_type text not null check (holder_type in ('senior','pwd')),
  holder_name text not null,
  holder_id_number text not null,
  discount_rate numeric(5,2) not null check (discount_rate >= 0 and discount_rate <= 100),
  item_id text,
  item_name text not null,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  gross_amount numeric(10,2) not null check (gross_amount >= 0),
  vat_removed_amount numeric(10,2) not null default 0 check (vat_removed_amount >= 0),
  vat_exempt_sales numeric(10,2) not null default 0 check (vat_exempt_sales >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  net_amount numeric(10,2) not null default 0 check (net_amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_bill_group_id_idx on orders(bill_group_id);
create index if not exists table_bill_discounts_bill_group_idx on table_bill_discounts(bill_group_id);
create index if not exists table_bill_discounts_order_idx on table_bill_discounts(order_id);

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

  select coalesce(sum(subtotal), 0), min(or_number), max(or_number), count(*)
    into v_subtotal, v_or_first, v_or_last, v_round_count
    from orders
   where table_number = v_table_number
     and status in ('preparing','ready');

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
      left join orders o on o.id = oi.order_id
     where oi.id is null
        or o.table_number <> v_table_number
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
         net_amount = greatest(vat_exempt_sales - round(vat_exempt_sales * discount_rate / 100, 2), 0);

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

  update orders o
     set status = 'completed',
         bill_group_id = v_bill_group_id,
         payment_method = nullif(trim(coalesce(p_payment_method, '')), ''),
         amount_received = p_amount_received,
         total_amount = round(greatest(coalesce(o.subtotal, 0) - coalesce(d.discount_gross, 0), 0) + coalesce(d.discount_net, 0), 2),
         senior_pwd_discount = coalesce(d.discount_amount, 0),
         senior_pwd_id = case when coalesce(d.discount_amount, 0) > 0 then v_holder_ids else null end,
         senior_pwd_name = case when coalesce(d.discount_amount, 0) > 0 then v_holder_names else null end,
         vat_exempt_sales = coalesce(d.vat_exempt_sales, 0),
         vat_amount = case when coalesce(v_settings.vat_registered, false)
           then round(greatest(coalesce(o.subtotal, 0) - coalesce(d.discount_gross, 0), 0) * v_settings.vat_rate / (100 + v_settings.vat_rate), 2)
           else 0
         end,
         vatable_sales = case when coalesce(v_settings.vat_registered, false)
           then greatest(coalesce(o.subtotal, 0) - coalesce(d.discount_gross, 0), 0)
             - round(greatest(coalesce(o.subtotal, 0) - coalesce(d.discount_gross, 0), 0) * v_settings.vat_rate / (100 + v_settings.vat_rate), 2)
           else 0
         end
    from (
      select
        order_id,
        coalesce(sum(gross_amount), 0) as discount_gross,
        coalesce(sum(discount_amount), 0) as discount_amount,
        coalesce(sum(vat_exempt_sales), 0) as vat_exempt_sales,
        coalesce(sum(net_amount), 0) as discount_net
      from tmp_table_bill_discount_lines
      group by order_id
    ) d
   where o.id = d.order_id
     and o.table_number = v_table_number
     and o.status in ('preparing','ready');

  update orders o
     set status = 'completed',
         bill_group_id = v_bill_group_id,
         payment_method = nullif(trim(coalesce(p_payment_method, '')), ''),
         amount_received = p_amount_received,
         senior_pwd_discount = 0,
         senior_pwd_id = null,
         senior_pwd_name = null,
         vat_exempt_sales = 0,
         vat_amount = case when coalesce(v_settings.vat_registered, false)
           then round(coalesce(o.subtotal, 0) * v_settings.vat_rate / (100 + v_settings.vat_rate), 2)
           else 0
         end,
         vatable_sales = case when coalesce(v_settings.vat_registered, false)
           then coalesce(o.subtotal, 0) - round(coalesce(o.subtotal, 0) * v_settings.vat_rate / (100 + v_settings.vat_rate), 2)
           else 0
         end,
         total_amount = coalesce(o.subtotal, o.total_amount, 0)
   where o.table_number = v_table_number
     and o.status in ('preparing','ready');

  select jsonb_agg(jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'or_number', o.or_number,
    'created_at', o.created_at,
    'subtotal', o.subtotal,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'item_id', oi.item_id,
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
  where o.bill_group_id = v_bill_group_id;

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
