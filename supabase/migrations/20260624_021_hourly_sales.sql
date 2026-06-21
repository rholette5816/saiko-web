create or replace function get_hourly_sales(
  p_start date,
  p_end date,
  p_channel text default null
)
returns table(hour_of_day int, order_count bigint, net_sales numeric)
language sql
security definer
set search_path = public
as $fn$
  with completed_orders as (
    select
      extract(hour from (o.created_at at time zone 'Asia/Manila'))::int as hour_of_day,
      o.total_amount
    from orders o
    where o.status = 'completed'
      and (o.created_at at time zone 'Asia/Manila')::date between p_start and p_end
      and (p_channel is null or coalesce(o.channel, 'counter') = p_channel)
  )
  select
    hours.hour_of_day,
    coalesce(count(completed_orders.hour_of_day), 0)::bigint as order_count,
    coalesce(sum(completed_orders.total_amount), 0)::numeric as net_sales
  from generate_series(0, 23) as hours(hour_of_day)
  left join completed_orders on completed_orders.hour_of_day = hours.hour_of_day
  group by hours.hour_of_day
  order by hours.hour_of_day;
$fn$;

revoke all on function get_hourly_sales(date, date, text) from public;
grant execute on function get_hourly_sales(date, date, text) to authenticated;
