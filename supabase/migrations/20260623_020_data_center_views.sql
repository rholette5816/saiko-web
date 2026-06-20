create or replace view daily_sales_summary_v1 as
select
  (o.created_at at time zone 'Asia/Manila')::date as business_date,
  coalesce(o.channel, 'counter') as channel,
  o.status,
  count(*)::bigint as order_count,
  coalesce(sum(o.total_amount), 0)::numeric as gross_sales,
  coalesce(sum(coalesce(o.subtotal, o.total_amount)), 0)::numeric as subtotal_total,
  coalesce(sum(case when o.promo_code is not null then coalesce(o.discount_amount, 0) else 0 end), 0)::numeric as promo_discount,
  coalesce(sum(coalesce(o.senior_pwd_discount, 0)), 0)::numeric as senior_pwd_discount,
  (
    coalesce(sum(o.total_amount), 0)
    - coalesce(sum(case when o.promo_code is not null then coalesce(o.discount_amount, 0) else 0 end), 0)
    - coalesce(sum(coalesce(o.senior_pwd_discount, 0)), 0)
  )::numeric as net_sales,
  coalesce(sum(coalesce(o.vatable_sales, 0)), 0)::numeric as vatable_sales,
  coalesce(sum(coalesce(o.vat_amount, 0)), 0)::numeric as vat_amount,
  coalesce(sum(coalesce(o.vat_exempt_sales, 0)), 0)::numeric as vat_exempt_sales,
  coalesce(sum(case when lower(coalesce(o.payment_method, '')) = 'cash' then o.total_amount else 0 end), 0)::numeric as cash_total,
  coalesce(sum(case when lower(coalesce(o.payment_method, '')) = 'gcash' then o.total_amount else 0 end), 0)::numeric as gcash_total,
  coalesce(sum(case when lower(coalesce(o.payment_method, '')) = 'card' then o.total_amount else 0 end), 0)::numeric as card_total,
  coalesce(sum(case when o.payment_method is null or lower(o.payment_method) not in ('cash', 'gcash', 'card') then o.total_amount else 0 end), 0)::numeric as online_total,
  min(o.or_number) filter (where o.or_number is not null) as first_or,
  max(o.or_number) filter (where o.or_number is not null) as last_or
from orders o
group by
  (o.created_at at time zone 'Asia/Manila')::date,
  coalesce(o.channel, 'counter'),
  o.status;

create or replace view daily_product_sales_v1 as
select
  (o.created_at at time zone 'Asia/Manila')::date as business_date,
  coalesce(o.channel, 'counter') as channel,
  oi.item_id,
  oi.item_name,
  coalesce(sum(oi.quantity), 0)::numeric as qty_sold,
  coalesce(sum(oi.line_total), 0)::numeric as revenue,
  count(distinct o.id)::bigint as order_count
from orders o
join order_items oi on oi.order_id = o.id
where o.status = 'completed'
group by
  (o.created_at at time zone 'Asia/Manila')::date,
  coalesce(o.channel, 'counter'),
  oi.item_id,
  oi.item_name;

create or replace view daily_table_sales_v1 as
with item_counts as (
  select
    oi.order_id,
    coalesce(sum(oi.quantity), 0)::numeric as item_count
  from order_items oi
  group by oi.order_id
)
select
  (o.created_at at time zone 'Asia/Manila')::date as business_date,
  coalesce(o.channel, 'counter') as channel,
  coalesce(
    nullif(trim(o.table_number), ''),
    case when coalesce(o.channel, 'counter') = 'web' then 'Web' else 'Counter' end
  ) as table_label,
  count(*)::bigint as order_count,
  coalesce(sum(coalesce(ic.item_count, 0)), 0)::numeric as item_count,
  coalesce(sum(o.total_amount), 0)::numeric as revenue,
  coalesce(sum(case when lower(coalesce(o.payment_method, '')) = 'cash' then o.total_amount else 0 end), 0)::numeric as cash_total,
  coalesce(sum(case when lower(coalesce(o.payment_method, '')) = 'gcash' then o.total_amount else 0 end), 0)::numeric as gcash_total,
  coalesce(sum(case when lower(coalesce(o.payment_method, '')) = 'card' then o.total_amount else 0 end), 0)::numeric as card_total,
  coalesce(sum(case when o.payment_method is null or lower(o.payment_method) not in ('cash', 'gcash', 'card') then o.total_amount else 0 end), 0)::numeric as online_total,
  min(o.or_number) filter (where o.or_number is not null) as first_or,
  max(o.or_number) filter (where o.or_number is not null) as last_or
from orders o
left join item_counts ic on ic.order_id = o.id
where o.status = 'completed'
group by
  (o.created_at at time zone 'Asia/Manila')::date,
  coalesce(o.channel, 'counter'),
  coalesce(
    nullif(trim(o.table_number), ''),
    case when coalesce(o.channel, 'counter') = 'web' then 'Web' else 'Counter' end
  );

create or replace function get_daily_summary(
  p_start date,
  p_end date,
  p_channel text default null,
  p_status text default null
)
returns setof daily_sales_summary_v1
language sql
security definer
set search_path = public
as $fn$
  select *
  from daily_sales_summary_v1
  where business_date between p_start and p_end
    and (p_channel is null or channel = p_channel)
    and (p_status is null or status = p_status)
  order by business_date, channel, status;
$fn$;

revoke all on function get_daily_summary(date, date, text, text) from public;
grant execute on function get_daily_summary(date, date, text, text) to authenticated;

create or replace function get_product_sales(
  p_start date,
  p_end date,
  p_channel text default null
)
returns setof daily_product_sales_v1
language sql
security definer
set search_path = public
as $fn$
  select *
  from daily_product_sales_v1
  where business_date between p_start and p_end
    and (p_channel is null or channel = p_channel)
  order by business_date, revenue desc, item_name;
$fn$;

revoke all on function get_product_sales(date, date, text) from public;
grant execute on function get_product_sales(date, date, text) to authenticated;

create or replace function get_table_sales(
  p_start date,
  p_end date,
  p_channel text default null
)
returns setof daily_table_sales_v1
language sql
security definer
set search_path = public
as $fn$
  select *
  from daily_table_sales_v1
  where business_date between p_start and p_end
    and (p_channel is null or channel = p_channel)
  order by business_date, table_label;
$fn$;

revoke all on function get_table_sales(date, date, text) from public;
grant execute on function get_table_sales(date, date, text) to authenticated;

create or replace function get_or_gaps(
  p_start date,
  p_end date
)
returns table(or_number text, prev_or text, next_or text)
language sql
security definer
set search_path = public
as $fn$
  with numeric_orders as (
    select
      o.or_number,
      o.or_number::bigint as or_int,
      length(o.or_number) as or_width
    from orders o
    where o.status = 'completed'
      and o.or_number ~ '^[0-9]+$'
      and (o.created_at at time zone 'Asia/Manila')::date between p_start and p_end
  ),
  adjacent_orders as (
    select
      lag(or_number) over (order by or_int) as prev_or,
      or_number as next_or,
      lag(or_int) over (order by or_int) as prev_int,
      or_int as next_int,
      lag(or_width) over (order by or_int) as prev_width,
      or_width as next_width
    from numeric_orders
  ),
  missing_orders as (
    select
      gap_value.missing_int,
      adjacent_orders.prev_or,
      adjacent_orders.next_or,
      case
        when adjacent_orders.prev_width = adjacent_orders.next_width then adjacent_orders.prev_width
        else null
      end as pad_width
    from adjacent_orders
    cross join lateral generate_series(adjacent_orders.prev_int + 1, adjacent_orders.next_int - 1) as gap_value(missing_int)
    where adjacent_orders.prev_int is not null
      and adjacent_orders.next_int - adjacent_orders.prev_int > 1
  )
  select
    case
      when pad_width is not null then lpad(missing_int::text, pad_width, '0')
      else missing_int::text
    end as or_number,
    prev_or,
    next_or
  from missing_orders
  order by missing_int;
$fn$;

revoke all on function get_or_gaps(date, date) from public;
grant execute on function get_or_gaps(date, date) to authenticated;

create or replace function get_payment_mix(
  p_start date,
  p_end date,
  p_channel text default null
)
returns table(payment_label text, order_count bigint, total_amount numeric)
language sql
security definer
set search_path = public
as $fn$
  with completed_orders as (
    select
      case
        when lower(coalesce(o.payment_method, '')) = 'cash' then 'Cash'
        when lower(coalesce(o.payment_method, '')) = 'gcash' then 'GCash'
        when lower(coalesce(o.payment_method, '')) = 'card' then 'Card'
        else 'Online'
      end as payment_label,
      o.total_amount
    from orders o
    where o.status = 'completed'
      and (o.created_at at time zone 'Asia/Manila')::date between p_start and p_end
      and (p_channel is null or coalesce(o.channel, 'counter') = p_channel)
  )
  select
    completed_orders.payment_label,
    count(*)::bigint as order_count,
    coalesce(sum(completed_orders.total_amount), 0)::numeric as total_amount
  from completed_orders
  group by completed_orders.payment_label
  order by case completed_orders.payment_label
    when 'Cash' then 1
    when 'GCash' then 2
    when 'Card' then 3
    else 4
  end;
$fn$;

revoke all on function get_payment_mix(date, date, text) from public;
grant execute on function get_payment_mix(date, date, text) to authenticated;
