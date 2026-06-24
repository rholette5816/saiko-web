-- Order backlog: backfill historical / missed orders without touching real OR numbers.

set search_path = public, pg_catalog;

alter table orders
  add column if not exists is_backlogged boolean not null default false,
  add column if not exists backlogged_by uuid,
  add column if not exists backlogged_at timestamptz,
  add column if not exists backlog_reason text;

create index if not exists idx_orders_is_backlogged on orders (is_backlogged) where is_backlogged = true;

create or replace function record_backlog_order(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_business_date date := (p_payload ->> 'business_date')::date;
  v_payment_method text := lower(coalesce(p_payload ->> 'payment_method', 'cash'));
  v_channel text := coalesce(p_payload ->> 'channel', 'counter');
  v_total numeric := coalesce((p_payload ->> 'total_amount')::numeric, 0);
  v_subtotal numeric := coalesce((p_payload ->> 'subtotal')::numeric, v_total);
  v_vatable numeric := coalesce((p_payload ->> 'vatable_sales')::numeric, 0);
  v_vat numeric := coalesce((p_payload ->> 'vat_amount')::numeric, 0);
  v_vat_exempt numeric := coalesce((p_payload ->> 'vat_exempt_sales')::numeric, 0);
  v_sr_disc numeric := coalesce((p_payload ->> 'senior_pwd_discount')::numeric, 0);
  v_sr_name text := nullif(p_payload ->> 'senior_pwd_name', '');
  v_sr_id text := nullif(p_payload ->> 'senior_pwd_id', '');
  v_reason text := nullif(p_payload ->> 'reason', '');
  v_notes text := nullif(p_payload ->> 'notes', '');
  v_items jsonb := coalesce(p_payload -> 'items', '[]'::jsonb);
  v_customer_name text := coalesce(nullif(p_payload ->> 'customer_name', ''), 'Backlog');
  v_customer_phone text := coalesce(nullif(p_payload ->> 'customer_phone', ''), 'N/A');
  v_table text := nullif(p_payload ->> 'table_number', '');
  v_created_at timestamptz;
  v_order_number text;
  v_order_id uuid;
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_closing_status text;
  v_item jsonb;
begin
  if v_business_date is null then
    raise exception 'business_date is required';
  end if;
  if v_reason is null then
    raise exception 'reason is required for backlog entries';
  end if;
  if v_business_date > v_today then
    raise exception 'Cannot backlog into the future';
  end if;
  if v_business_date < v_today - interval '30 days' then
    raise exception 'Cannot backlog more than 30 days in the past';
  end if;

  select status into v_closing_status
  from cash_drawer_closings
  where business_date = v_business_date and channel = v_channel;
  if v_closing_status = 'approved' then
    raise exception 'Drawer for % on % is approved. Reopen the closing before backlogging.', v_channel, v_business_date;
  end if;

  v_created_at := ((v_business_date::text || ' 12:00:00')::timestamp at time zone 'Asia/Manila');
  v_order_number := 'BL-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substring(gen_random_uuid()::text, 1, 4);

  insert into orders (
    order_number,
    customer_name,
    customer_phone,
    pickup_label,
    pickup_time,
    is_pre_order,
    notes,
    status,
    total_amount,
    subtotal,
    channel,
    table_number,
    payment_method,
    or_number,
    vat_amount,
    vatable_sales,
    vat_exempt_sales,
    senior_pwd_discount,
    senior_pwd_id,
    senior_pwd_name,
    is_backlogged,
    backlogged_by,
    backlogged_at,
    backlog_reason,
    created_at,
    updated_at
  ) values (
    v_order_number,
    v_customer_name,
    v_customer_phone,
    'Backlog',
    v_created_at,
    false,
    v_notes,
    'completed',
    v_total,
    v_subtotal,
    v_channel,
    v_table,
    v_payment_method,
    null,
    v_vat,
    v_vatable,
    v_vat_exempt,
    v_sr_disc,
    v_sr_id,
    v_sr_name,
    true,
    auth.uid(),
    now(),
    v_reason,
    v_created_at,
    now()
  )
  returning id into v_order_id;

  if jsonb_array_length(v_items) > 0 then
    for v_item in select * from jsonb_array_elements(v_items)
    loop
      insert into order_items (order_id, item_id, item_name, unit_price, quantity, line_total)
      values (
        v_order_id,
        coalesce(v_item ->> 'item_id', 'backlog'),
        coalesce(v_item ->> 'item_name', 'Backlog line'),
        coalesce((v_item ->> 'unit_price')::numeric, 0),
        coalesce((v_item ->> 'quantity')::numeric, 1),
        coalesce((v_item ->> 'line_total')::numeric, coalesce((v_item ->> 'unit_price')::numeric, 0) * coalesce((v_item ->> 'quantity')::numeric, 1))
      );
    end loop;
  end if;

  return v_order_id;
end;
$fn$;

revoke all on function record_backlog_order(jsonb) from public;
grant execute on function record_backlog_order(jsonb) to authenticated;

create or replace function delete_backlog_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row orders;
  v_closing_status text;
begin
  select * into v_row from orders where id = p_order_id;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;
  if not coalesce(v_row.is_backlogged, false) then
    raise exception 'Order % is not a backlogged entry', p_order_id;
  end if;
  if v_row.backlogged_at is null or v_row.backlogged_at < now() - interval '1 hour' then
    raise exception 'Backlog undo window has expired. Edit through the regular admin instead.';
  end if;

  select status into v_closing_status
  from cash_drawer_closings
  where business_date = (v_row.created_at at time zone 'Asia/Manila')::date
    and channel = coalesce(v_row.channel, 'counter');
  if v_closing_status = 'approved' then
    raise exception 'Drawer is approved for that day, cannot remove the entry.';
  end if;

  delete from orders where id = p_order_id;
end;
$fn$;

revoke all on function delete_backlog_order(uuid) from public;
grant execute on function delete_backlog_order(uuid) to authenticated;

create or replace function list_recent_backlog(p_limit int default 20)
returns table (
  id uuid,
  order_number text,
  business_date date,
  channel text,
  payment_method text,
  total_amount numeric,
  item_count bigint,
  backlogged_by uuid,
  backlogged_at timestamptz,
  backlog_reason text,
  is_undoable boolean
)
language sql
security definer
set search_path = public
as $fn$
  select
    o.id,
    o.order_number,
    (o.created_at at time zone 'Asia/Manila')::date as business_date,
    coalesce(o.channel, 'counter') as channel,
    coalesce(o.payment_method, 'cash') as payment_method,
    coalesce(o.total_amount, 0) as total_amount,
    (select count(*) from order_items oi where oi.order_id = o.id) as item_count,
    o.backlogged_by,
    o.backlogged_at,
    o.backlog_reason,
    (o.backlogged_at is not null and o.backlogged_at >= now() - interval '1 hour') as is_undoable
  from orders o
  where o.is_backlogged = true
  order by o.backlogged_at desc nulls last
  limit greatest(coalesce(p_limit, 20), 1);
$fn$;

revoke all on function list_recent_backlog(int) from public;
grant execute on function list_recent_backlog(int) to authenticated;
