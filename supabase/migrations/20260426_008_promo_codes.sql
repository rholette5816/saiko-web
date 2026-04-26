-- Phase 4A: promo codes table + order discount columns + extended place_order RPC

create table if not exists promo_codes (
  code text primary key,
  description text,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  min_order_amount numeric(10,2) default 0 check (min_order_amount >= 0),
  max_discount numeric(10,2) check (max_discount is null or max_discount > 0),
  valid_from timestamptz,
  valid_until timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  times_used integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promo_codes_active_idx on promo_codes(is_active);

create or replace function set_promo_codes_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists promo_codes_set_updated_at on promo_codes;
create trigger promo_codes_set_updated_at
  before update on promo_codes
  for each row execute function set_promo_codes_updated_at();

alter table promo_codes enable row level security;

drop policy if exists "auth manage promos" on promo_codes;
create policy "auth manage promos"
  on promo_codes for all
  to authenticated
  using (true) with check (true);

alter table orders
  add column if not exists promo_code text,
  add column if not exists subtotal numeric(10,2),
  add column if not exists discount_amount numeric(10,2) not null default 0
    check (discount_amount >= 0);

create index if not exists orders_promo_code_idx on orders(promo_code);

create or replace function validate_promo_code(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promo promo_codes%rowtype;
  v_discount numeric;
  v_now timestamptz := now();
  v_normalized text := upper(trim(p_code));
begin
  select * into v_promo from promo_codes where upper(code) = v_normalized limit 1;
  if not found then
    return jsonb_build_object('valid', false, 'error', 'Invalid promo code');
  end if;
  if not v_promo.is_active then
    return jsonb_build_object('valid', false, 'error', 'This promo is no longer active');
  end if;
  if v_promo.valid_from is not null and v_now < v_promo.valid_from then
    return jsonb_build_object('valid', false, 'error', 'This promo is not yet active');
  end if;
  if v_promo.valid_until is not null and v_now > v_promo.valid_until then
    return jsonb_build_object('valid', false, 'error', 'This promo has expired');
  end if;
  if v_promo.usage_limit is not null and v_promo.times_used >= v_promo.usage_limit then
    return jsonb_build_object('valid', false, 'error', 'This promo has reached its limit');
  end if;
  if p_subtotal < coalesce(v_promo.min_order_amount, 0) then
    return jsonb_build_object(
      'valid', false,
      'error', 'Minimum order is PHP ' || trim(to_char(v_promo.min_order_amount, 'FM999G999D00'))
    );
  end if;

  if v_promo.discount_type = 'percent' then
    v_discount := round(p_subtotal * v_promo.discount_value / 100, 2);
    if v_promo.max_discount is not null then
      v_discount := least(v_discount, v_promo.max_discount);
    end if;
  else
    v_discount := v_promo.discount_value;
  end if;

  v_discount := least(v_discount, p_subtotal);

  return jsonb_build_object(
    'valid', true,
    'code', v_promo.code,
    'description', v_promo.description,
    'discount_amount', v_discount,
    'subtotal', p_subtotal,
    'total', greatest(p_subtotal - v_discount, 0)
  );
end;
$$;

revoke all on function validate_promo_code(text, numeric) from public;
grant execute on function validate_promo_code(text, numeric) to anon, authenticated;

drop function if exists place_order_with_items(
  text, text, text, timestamptz, boolean, text, numeric, jsonb
);

create or replace function place_order_with_items(
  p_customer_name text,
  p_customer_phone text,
  p_pickup_label text,
  p_pickup_time timestamptz,
  p_is_pre_order boolean,
  p_notes text,
  p_subtotal numeric,
  p_total_amount numeric,
  p_discount_amount numeric,
  p_promo_code text,
  p_items jsonb
)
returns table (order_id uuid, order_number text, tracking_token text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_order_id uuid;
  v_order_number text;
  v_tracking_token text;
  v_promo_normalized text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Order items are required';
  end if;

  v_tracking_token := replace(gen_random_uuid()::text, '-', '');
  v_promo_normalized := nullif(upper(trim(coalesce(p_promo_code, ''))), '');

  insert into orders (
    customer_name,
    customer_phone,
    pickup_label,
    pickup_time,
    is_pre_order,
    notes,
    subtotal,
    total_amount,
    discount_amount,
    promo_code,
    tracking_token
  )
  values (
    trim(p_customer_name),
    trim(p_customer_phone),
    p_pickup_label,
    p_pickup_time,
    coalesce(p_is_pre_order, false),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_subtotal,
    p_total_amount,
    coalesce(p_discount_amount, 0),
    v_promo_normalized,
    v_tracking_token
  )
  returning id, orders.order_number, orders.tracking_token
  into v_order_id, v_order_number, v_tracking_token;

  insert into order_items (order_id, item_id, item_name, unit_price, quantity, line_total)
  select
    v_order_id,
    item_id,
    item_name,
    unit_price,
    quantity,
    line_total
  from jsonb_to_recordset(p_items) as x(
    item_id text,
    item_name text,
    unit_price numeric,
    quantity integer,
    line_total numeric
  );

  if v_promo_normalized is not null then
    update promo_codes
       set times_used = times_used + 1
     where upper(code) = v_promo_normalized;
  end if;

  return query select v_order_id, v_order_number, v_tracking_token;
end;
$fn$;

revoke all on function place_order_with_items(
  text, text, text, timestamptz, boolean, text, numeric, numeric, numeric, text, jsonb
) from public;

grant execute on function place_order_with_items(
  text, text, text, timestamptz, boolean, text, numeric, numeric, numeric, text, jsonb
) to anon, authenticated;
