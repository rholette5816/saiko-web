-- Rename the former card payment bucket to Bank Transfer BPI while preserving old card records.

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
  coalesce(sum(case when regexp_replace(lower(coalesce(o.payment_method, '')), '[^a-z0-9]+', '_', 'g') in ('card', 'bpi', 'bank_transfer', 'bank_transfer_bpi') then o.total_amount else 0 end), 0)::numeric as card_total,
  coalesce(sum(case when regexp_replace(lower(coalesce(o.payment_method, '')), '[^a-z0-9]+', '_', 'g') not in ('cash', 'gcash', 'card', 'bpi', 'bank_transfer', 'bank_transfer_bpi') then o.total_amount else 0 end), 0)::numeric as online_total,
  min(o.or_number) filter (where o.or_number is not null) as first_or,
  max(o.or_number) filter (where o.or_number is not null) as last_or
from orders o
group by
  (o.created_at at time zone 'Asia/Manila')::date,
  coalesce(o.channel, 'counter'),
  o.status;

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
  coalesce(sum(case when regexp_replace(lower(coalesce(o.payment_method, '')), '[^a-z0-9]+', '_', 'g') in ('card', 'bpi', 'bank_transfer', 'bank_transfer_bpi') then o.total_amount else 0 end), 0)::numeric as card_total,
  coalesce(sum(case when regexp_replace(lower(coalesce(o.payment_method, '')), '[^a-z0-9]+', '_', 'g') not in ('cash', 'gcash', 'card', 'bpi', 'bank_transfer', 'bank_transfer_bpi') then o.total_amount else 0 end), 0)::numeric as online_total,
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
        when regexp_replace(lower(coalesce(o.payment_method, '')), '[^a-z0-9]+', '_', 'g') in ('card', 'bpi', 'bank_transfer', 'bank_transfer_bpi') then 'Bank Transfer BPI'
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
    when 'Bank Transfer BPI' then 3
    else 4
  end;
$fn$;

revoke all on function get_payment_mix(date, date, text) from public;
grant execute on function get_payment_mix(date, date, text) to authenticated;