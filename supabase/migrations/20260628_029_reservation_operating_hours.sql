-- Enforce Saiko's operating hours on reservation requests server-side
-- (defense in depth alongside the client-side time picker restriction).
-- Mon-Thu: 10:00-21:00. Fri-Sun: 10:00-22:00. Signature unchanged, additive.

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
  v_dow integer;
  v_open time;
  v_close time;
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

  v_dow := extract(dow from p_reservation_date);
  if v_dow in (0, 5, 6) then
    v_open := time '10:00';
    v_close := time '22:00';
  else
    v_open := time '10:00';
    v_close := time '21:00';
  end if;

  if p_reservation_time < v_open or p_reservation_time > v_close then
    raise exception 'Reservation time must be between % and % on that day',
      to_char(v_open, 'FMHH12:MI AM'), to_char(v_close, 'FMHH12:MI AM');
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
