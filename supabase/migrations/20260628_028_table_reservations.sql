-- Public "Reserve a Table" feature: customers submit a reservation request
-- from the website; staff confirm/decline and assign the actual table in admin.
-- Anon writes only go through the validated create_table_reservation RPC,
-- never a raw insert, mirroring the promo_codes / validate_promo_code pattern.

create table if not exists table_reservations (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  guest_phone text not null,
  party_size integer not null check (party_size > 0 and party_size <= 50),
  reservation_date date not null,
  reservation_time time not null,
  preferred_table_id text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  assigned_table_id text,
  staff_notes text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists table_reservations_status_idx on table_reservations(status);
create index if not exists table_reservations_date_idx on table_reservations(reservation_date);

alter table table_reservations enable row level security;

drop policy if exists "auth manage reservations" on table_reservations;
create policy "auth manage reservations"
  on table_reservations for all
  to authenticated
  using (true) with check (true);

create or replace function create_table_reservation(
  p_guest_name text,
  p_guest_phone text,
  p_party_size integer,
  p_reservation_date date,
  p_reservation_time time,
  p_preferred_table_id text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_name text := trim(coalesce(p_guest_name, ''));
  v_guest_phone text := trim(coalesce(p_guest_phone, ''));
  v_preferred_table_id text := nullif(trim(coalesce(p_preferred_table_id, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_id uuid;
begin
  if v_guest_name = '' then
    raise exception 'Name is required';
  end if;
  if v_guest_phone = '' then
    raise exception 'Phone number is required';
  end if;
  if p_party_size is null or p_party_size <= 0 or p_party_size > 50 then
    raise exception 'Party size must be between 1 and 50';
  end if;
  if p_reservation_date is null or p_reservation_date < current_date then
    raise exception 'Reservation date must be today or later';
  end if;
  if p_reservation_time is null then
    raise exception 'Reservation time is required';
  end if;

  insert into table_reservations (
    guest_name, guest_phone, party_size, reservation_date, reservation_time,
    preferred_table_id, notes
  )
  values (
    v_guest_name, v_guest_phone, p_party_size, p_reservation_date, p_reservation_time,
    v_preferred_table_id, v_notes
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'guest_name', v_guest_name,
    'reservation_date', p_reservation_date,
    'reservation_time', p_reservation_time,
    'party_size', p_party_size,
    'status', 'pending'
  );
end;
$$;

revoke all on function create_table_reservation(text, text, integer, date, time, text, text) from public;
grant execute on function create_table_reservation(text, text, integer, date, time, text, text) to anon, authenticated;
