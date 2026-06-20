alter table menu_items add column if not exists is_public boolean not null default true;
alter table menu_items add column if not exists requires_spice_level boolean not null default false;

insert into menu_categories (id, name, emoji, sort_order)
values
  ('beer', 'BEER', '🍺', 16),
  ('charge', 'CHARGE', '🧾', 17),
  ('takeoutcharge', 'TAKE OUT CHARGE', '📦', 18),
  ('bentoextras', 'BENTO', '🍱', 19),
  ('addon', 'ADD ON', '➕', 20)
on conflict (id) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  sort_order = excluded.sort_order;

insert into menu_items (
  id, category_id, name, price, sort_order, is_available, is_public
)
values
  ('be1', 'beer', 'Asahi', 46, 0, true, false),
  ('dr25', 'drinks', 'Black Coffee', 40, 24, true, false),
  ('dr26', 'drinks', 'Hot Calamansi Juice', 90, 25, true, false),
  ('dr27', 'drinks', 'Warm Calamansi Juice', 90, 26, true, false),
  ('du7', 'dumplings', 'Pork Gyoza (S/F)', 157, 6, true, false),
  ('ch1', 'charge', 'Service Water Glass', 56, 0, true, false),
  ('ch2', 'charge', 'Smoothie Glass', 55, 1, true, false),
  ('ch3', 'charge', 'Soup Bowl', 52, 2, true, false),
  ('ch4', 'charge', 'Soup Spoon', 31, 3, true, false),
  ('to1', 'takeoutcharge', 'Bento Box', 34, 0, true, false),
  ('to2', 'takeoutcharge', 'Cake Sushi Micro', 20, 1, true, false),
  ('to3', 'takeoutcharge', 'Micro', 12, 2, true, false),
  ('to4', 'takeoutcharge', 'Pizza Box', 23, 3, true, false),
  ('to5', 'takeoutcharge', 'Ramen Micro', 28, 4, true, false),
  ('to6', 'takeoutcharge', 'Styro', 6, 5, true, false),
  ('to7', 'takeoutcharge', 'Plastic Cups', 12, 6, true, false),
  ('bx1', 'bentoextras', 'Miso Soup', 40, 0, true, false),
  ('ad1', 'addon', 'Extra Egg', 20, 0, true, false),
  ('ad2', 'addon', 'Extra Black Fungus', 34, 1, true, false),
  ('ad3', 'addon', 'Extra Sprout', 17, 2, true, false),
  ('ad4', 'addon', 'Oreo', 15, 3, true, false),
  ('ad5', 'addon', 'Beef Misono', 157, 4, true, false),
  ('ad6', 'addon', 'Extra Chasu', 51, 5, true, false),
  ('ad7', 'addon', 'Extra Noodles', 34, 6, true, false),
  ('ad8', 'addon', 'Extra Soup', 40, 7, true, false),
  ('ad9', 'addon', 'Extra Nori Dake', 68, 8, true, false),
  ('ad10', 'addon', 'Plain Rice', 34, 9, true, false)
on conflict (id) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  price = excluded.price,
  sort_order = excluded.sort_order,
  is_available = excluded.is_available,
  is_public = excluded.is_public;

update menu_items set requires_spice_level = true where id = 'r3';
