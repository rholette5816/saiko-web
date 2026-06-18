-- Persist kitchen and bar ticket print status for dine-in table rounds.

alter table orders
  add column if not exists kitchen_ticket_printed_at timestamptz,
  add column if not exists kitchen_ticket_print_count integer not null default 0,
  add column if not exists bar_ticket_printed_at timestamptz,
  add column if not exists bar_ticket_print_count integer not null default 0;

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
    update orders
       set kitchen_ticket_printed_at = now(),
           kitchen_ticket_print_count = coalesce(kitchen_ticket_print_count, 0) + 1
     where id = p_order_id;
  elsif p_kind = 'bar' then
    update orders
       set bar_ticket_printed_at = now(),
           bar_ticket_print_count = coalesce(bar_ticket_print_count, 0) + 1
     where id = p_order_id;
  else
    raise exception 'Ticket kind must be kitchen or bar';
  end if;

  if not found then
    raise exception 'Order % was not found', p_order_id;
  end if;
end;
$fn$;

revoke all on function mark_table_ticket_printed(uuid, text) from public;
grant execute on function mark_table_ticket_printed(uuid, text) to authenticated;
