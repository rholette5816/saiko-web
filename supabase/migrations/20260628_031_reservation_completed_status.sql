alter table table_reservations drop constraint if exists table_reservations_status_check;
alter table table_reservations
  add constraint table_reservations_status_check
  check (status in ('pending', 'confirmed', 'completed', 'declined', 'cancelled'));
