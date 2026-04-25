-- Phase 2.2: store Messenger contact link and ready notification timestamp

alter table orders
  add column if not exists messenger_psid text,
  add column if not exists ready_notified_at timestamptz;

create index if not exists orders_messenger_psid_idx on orders(messenger_psid);
create index if not exists orders_ready_notified_at_idx on orders(ready_notified_at);
