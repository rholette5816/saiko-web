-- Admin order-detail item editing inserts order_items directly (delete + insert),
-- not through a security definer RPC, so authenticated needs an insert policy too.

drop policy if exists "auth insert order items" on order_items;
create policy "auth insert order items"
  on order_items for insert
  to authenticated
  with check (true);
