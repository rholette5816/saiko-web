-- Cash drawer reconciliation: closings, payouts, discrepancy view, and supporting RPCs.

set search_path = public, pg_catalog;

create table if not exists cash_drawer_closings (
  id uuid primary key default gen_random_uuid(),
  business_date date not null,
  channel text not null default 'counter',
  cashier_label text,
  opening_float numeric not null default 0,
  expected_cash numeric not null default 0,
  counted_cash numeric not null default 0,
  cash_variance numeric generated always as (counted_cash - expected_cash) stored,
  expected_gcash numeric not null default 0,
  actual_gcash numeric not null default 0,
  gcash_variance numeric generated always as (actual_gcash - expected_gcash) stored,
  expected_card numeric not null default 0,
  actual_card numeric not null default 0,
  card_variance numeric generated always as (actual_card - expected_card) stored,
  payouts_total numeric not null default 0,
  notes text,
  status text not null default 'draft',
  submitted_at timestamptz,
  submitted_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_drawer_closings_status_check check (status in ('draft', 'submitted', 'approved')),
  constraint cash_drawer_closings_unique unique (business_date, channel)
);

create table if not exists cash_drawer_payouts (
  id uuid primary key default gen_random_uuid(),
  closing_id uuid not null references cash_drawer_closings(id) on delete cascade,
  label text not null,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

create or replace function touch_cash_drawer_closing()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists trg_cash_drawer_closings_touch on cash_drawer_closings;
create trigger trg_cash_drawer_closings_touch
  before update on cash_drawer_closings
  for each row
  execute function touch_cash_drawer_closing();

alter table cash_drawer_closings enable row level security;
alter table cash_drawer_payouts enable row level security;

drop policy if exists "auth read closings" on cash_drawer_closings;
create policy "auth read closings"
  on cash_drawer_closings for select
  to authenticated
  using (true);

drop policy if exists "auth insert closings" on cash_drawer_closings;
create policy "auth insert closings"
  on cash_drawer_closings for insert
  to authenticated
  with check (true);

drop policy if exists "auth update closings" on cash_drawer_closings;
create policy "auth update closings"
  on cash_drawer_closings for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "auth read payouts" on cash_drawer_payouts;
create policy "auth read payouts"
  on cash_drawer_payouts for select
  to authenticated
  using (true);

drop policy if exists "auth insert payouts" on cash_drawer_payouts;
create policy "auth insert payouts"
  on cash_drawer_payouts for insert
  to authenticated
  with check (true);

drop policy if exists "auth update payouts" on cash_drawer_payouts;
create policy "auth update payouts"
  on cash_drawer_payouts for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "auth delete payouts" on cash_drawer_payouts;
create policy "auth delete payouts"
  on cash_drawer_payouts for delete
  to authenticated
  using (true);

create or replace function start_shift_close(
  p_business_date date,
  p_channel text default 'counter'
)
returns cash_drawer_closings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row cash_drawer_closings;
  v_expected_cash numeric;
  v_expected_gcash numeric;
  v_expected_card numeric;
begin
  select * into v_row
  from cash_drawer_closings
  where business_date = p_business_date and channel = p_channel;

  if found then
    return v_row;
  end if;

  select
    coalesce(sum(cash_total), 0),
    coalesce(sum(gcash_total), 0),
    coalesce(sum(card_total), 0)
  into v_expected_cash, v_expected_gcash, v_expected_card
  from daily_sales_summary_v1
  where business_date = p_business_date
    and channel = p_channel
    and status = 'completed';

  insert into cash_drawer_closings (
    business_date,
    channel,
    expected_cash,
    expected_gcash,
    expected_card
  ) values (
    p_business_date,
    p_channel,
    coalesce(v_expected_cash, 0),
    coalesce(v_expected_gcash, 0),
    coalesce(v_expected_card, 0)
  )
  returning * into v_row;

  return v_row;
end;
$fn$;

revoke all on function start_shift_close(date, text) from public;
grant execute on function start_shift_close(date, text) to authenticated;

create or replace function submit_shift_close(
  p_id uuid,
  p_opening_float numeric,
  p_counted_cash numeric,
  p_actual_gcash numeric,
  p_actual_card numeric,
  p_payouts_total numeric,
  p_notes text
)
returns cash_drawer_closings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row cash_drawer_closings;
begin
  select * into v_row from cash_drawer_closings where id = p_id;
  if not found then
    raise exception 'Closing % not found', p_id;
  end if;
  if v_row.status = 'approved' then
    raise exception 'Closing % is already approved', p_id;
  end if;

  update cash_drawer_closings
     set opening_float = coalesce(p_opening_float, 0),
         counted_cash = coalesce(p_counted_cash, 0),
         actual_gcash = coalesce(p_actual_gcash, 0),
         actual_card = coalesce(p_actual_card, 0),
         payouts_total = coalesce(p_payouts_total, 0),
         notes = p_notes,
         status = 'submitted',
         submitted_at = now(),
         submitted_by = auth.uid()
   where id = p_id
   returning * into v_row;

  return v_row;
end;
$fn$;

revoke all on function submit_shift_close(uuid, numeric, numeric, numeric, numeric, numeric, text) from public;
grant execute on function submit_shift_close(uuid, numeric, numeric, numeric, numeric, numeric, text) to authenticated;

create or replace function approve_shift_close(p_id uuid)
returns cash_drawer_closings
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row cash_drawer_closings;
begin
  select * into v_row from cash_drawer_closings where id = p_id;
  if not found then
    raise exception 'Closing % not found', p_id;
  end if;
  if v_row.status <> 'submitted' then
    raise exception 'Closing % must be submitted before approval', p_id;
  end if;

  update cash_drawer_closings
     set status = 'approved',
         approved_at = now(),
         approved_by = auth.uid()
   where id = p_id
   returning * into v_row;

  return v_row;
end;
$fn$;

revoke all on function approve_shift_close(uuid) from public;
grant execute on function approve_shift_close(uuid) to authenticated;

create or replace function add_payout(
  p_closing_id uuid,
  p_label text,
  p_amount numeric
)
returns cash_drawer_payouts
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row cash_drawer_payouts;
begin
  insert into cash_drawer_payouts (closing_id, label, amount)
  values (p_closing_id, coalesce(p_label, 'Payout'), coalesce(p_amount, 0))
  returning * into v_row;

  update cash_drawer_closings
     set payouts_total = (
       select coalesce(sum(amount), 0)
       from cash_drawer_payouts
       where closing_id = p_closing_id
     )
   where id = p_closing_id;

  return v_row;
end;
$fn$;

revoke all on function add_payout(uuid, text, numeric) from public;
grant execute on function add_payout(uuid, text, numeric) to authenticated;

create or replace function remove_payout(p_payout_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_closing_id uuid;
begin
  select closing_id into v_closing_id from cash_drawer_payouts where id = p_payout_id;
  if not found then
    return;
  end if;

  delete from cash_drawer_payouts where id = p_payout_id;

  update cash_drawer_closings
     set payouts_total = (
       select coalesce(sum(amount), 0)
       from cash_drawer_payouts
       where closing_id = v_closing_id
     )
   where id = v_closing_id;
end;
$fn$;

revoke all on function remove_payout(uuid) from public;
grant execute on function remove_payout(uuid) to authenticated;

create or replace function list_recent_closings(p_limit int default 14)
returns setof cash_drawer_closings
language sql
security definer
set search_path = public
as $fn$
  select *
  from cash_drawer_closings
  order by business_date desc
  limit greatest(coalesce(p_limit, 14), 1);
$fn$;

revoke all on function list_recent_closings(int) from public;
grant execute on function list_recent_closings(int) to authenticated;

create or replace view discrepancy_findings_v1 as
with completed as (
  select
    (o.created_at at time zone 'Asia/Manila')::date as business_date,
    o.*
  from public.orders o
  where o.status = 'completed'
)
select
  c.business_date,
  c.id as order_id,
  c.order_number,
  c.or_number,
  c.total_amount,
  'missing_or'::text as finding_type,
  'Completed order has no OR number.'::text as details
from completed c
where c.or_number is null
union all
select
  c.business_date,
  c.id,
  c.order_number,
  c.or_number,
  c.total_amount,
  'vat_total_mismatch',
  'VATable + VAT exempt + senior/PWD discount does not match total within PHP 1.'
from completed c
where abs(
    coalesce(c.vatable_sales, 0)
    + coalesce(c.vat_exempt_sales, 0)
    + coalesce(c.senior_pwd_discount, 0)
    - coalesce(c.total_amount, 0)
  ) > 1
union all
select
  c.business_date,
  c.id,
  c.order_number,
  c.or_number,
  c.total_amount,
  'senior_pwd_missing_holder',
  'Senior/PWD discount applied without a holder name or ID.'
from completed c
where coalesce(c.senior_pwd_discount, 0) > 0
  and (c.senior_pwd_name is null or c.senior_pwd_id is null);

-- The billed_not_settled finding requires kitchen_ticket_printed_at on orders
-- (added by 20260619_013_table_ticket_print_status.sql). Apply that migration
-- first and then re-run a follow up to recreate this view with the extra
-- union branch.

create or replace function get_discrepancies(
  p_start date,
  p_end date,
  p_type text default null
)
returns setof public.discrepancy_findings_v1
language sql
security definer
set search_path = public
as $fn$
  select *
  from public.discrepancy_findings_v1
  where business_date between p_start and p_end
    and (p_type is null or finding_type = p_type)
  order by business_date desc, finding_type, order_number;
$fn$;

revoke all on function get_discrepancies(date, date, text) from public;
grant execute on function get_discrepancies(date, date, text) to authenticated;
