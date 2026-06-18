-- Admin product management: database-backed menu items

create table if not exists menu_categories (
  id text primary key,
  name text not null,
  emoji text not null,
  sort_order integer not null default 0
);

create table if not exists menu_items (
  id text primary key,
  category_id text not null references menu_categories(id),
  name text not null,
  price integer not null,
  description text,
  image text,
  badge text check (badge in ('bestseller', 'chefs-pick', 'new', 'spicy') or badge is null),
  sort_order integer not null default 0,
  is_available boolean not null default true,
  is_best_seller boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_menu_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists menu_items_set_updated_at on menu_items;
create trigger menu_items_set_updated_at
  before update on menu_items
  for each row execute function set_menu_items_updated_at();

alter table menu_categories enable row level security;
alter table menu_items enable row level security;

drop policy if exists "anon read menu categories" on menu_categories;
create policy "anon read menu categories"
  on menu_categories for select
  to anon
  using (true);

drop policy if exists "auth read menu categories" on menu_categories;
create policy "auth read menu categories"
  on menu_categories for select
  to authenticated
  using (true);

drop policy if exists "anon read available menu items" on menu_items;
create policy "anon read available menu items"
  on menu_items for select
  to anon
  using (is_available = true);

drop policy if exists "auth read menu items" on menu_items;
create policy "auth read menu items"
  on menu_items for select
  to authenticated
  using (true);

drop policy if exists "auth insert menu items" on menu_items;
create policy "auth insert menu items"
  on menu_items for insert
  to authenticated
  with check (true);

drop policy if exists "auth update menu items" on menu_items;
create policy "auth update menu items"
  on menu_items for update
  to authenticated
  using (true) with check (true);

drop policy if exists "auth delete menu items" on menu_items;
create policy "auth delete menu items"
  on menu_items for delete
  to authenticated
  using (true);

insert into menu_categories (id, name, emoji, sort_order)
values
  ('featured', 'FEATURED', '⭐', 0),
  ('ramen', 'RAMEN', '🍜', 1),
  ('alacarte', 'ALA CARTE', '🍗', 2),
  ('sushi', 'MAKI & SUSHI', '🍣', 3),
  ('stirfry', 'STIR FRIED NOODLES', '🍜', 4),
  ('salad', 'SALAD', '🥗', 5),
  ('dumplings', 'DUMPLINGS', '🥟', 6),
  ('friedrice', 'FRIED RICE', '🍛', 7),
  ('yakitori', 'YAKI TORI', '🍢', 8),
  ('pizza', 'PIZZA', '🍕', 9),
  ('bento', 'BENTO (with soup & drinks)', '🍱', 10),
  ('doria', 'DORIA MEAL', '🍛', 11),
  ('side', 'SIDE DISH', '🥗', 12),
  ('donburi', 'DONBURI RICE BOWL', '🍚', 13),
  ('teppanyaki', 'TEPPANYAKI', '🍳', 14),
  ('drinks', 'DRINKS & BEVERAGES', '🥤', 15)
on conflict (id) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  sort_order = excluded.sort_order;

insert into menu_items (
  id, category_id, name, price, description, image, badge, sort_order, is_available, is_best_seller
)
values
  ('f1', 'featured', 'Wagyu Teppan', 504, 'Premium wagyu cut, seared teppan-style. Buttery, rich, gone too soon.', 'asset:featured-wagyu-teppan.png', 'chefs-pick', 0, true, false),
  ('f2', 'featured', 'Lava Rice', 359, 'Our house chili sauce over hot fried rice. Anghang na gustong-gusto mo.', 'asset:featured-lava-rice.png', 'spicy', 1, true, false),
  ('f3', 'featured', 'Uramaki Dragon Roll', 325, 'Eight bites, five flavors, one signature roll. Your phone eats first.', 'asset:featured-dragon-roll.png', 'bestseller', 2, true, false),
  ('f4', 'featured', 'Pork Gyoza', 157, 'Crispy bottom, juicy center, dipped in our house vinegar. Starter of champions.', 'asset:featured-gyoza.png', 'new', 3, true, false),
  ('f5', 'featured', 'Salted Egg Ramen', 336, 'Rich salted egg sauce coating every strand. The crowd favorite of Saiko.', '/menu-images/salted%20egg%20ramen.png', 'bestseller', 4, true, false),
  ('f6', 'featured', 'Cheesy Parmesan', 314, 'Creamy parmesan over our signature rice bowl. Comfort food, leveled up.', null, 'chefs-pick', 5, true, false),
  ('r1', 'ramen', 'Wagyu Ramen', 415, null, null, 'bestseller', 0, true, false),
  ('r2', 'ramen', 'Curry Ramen', 381, null, null, null, 1, true, false),
  ('r3', 'ramen', 'Devil Ramen', 359, null, '/menu-images/Devil%20Ramen.png', 'bestseller', 2, true, false),
  ('r4', 'ramen', 'Butao Ramen', 359, null, null, null, 3, true, false),
  ('r5', 'ramen', 'Sukiyaki Ramen', 359, null, null, null, 4, true, false),
  ('r6', 'ramen', 'Karubi Ramen', 488, null, null, null, 5, true, false),
  ('r7', 'ramen', 'Creamy Seafood Ramen', 336, null, null, 'bestseller', 6, true, false),
  ('r8', 'ramen', '3 Cheese Ramen', 336, null, null, null, 7, true, false),
  ('r9', 'ramen', 'Seafood Ramen', 325, null, null, null, 8, true, false),
  ('r10', 'ramen', 'Tantanmen Ramen', 336, null, null, null, 9, true, false),
  ('r11', 'ramen', 'Ebi Tonkotso Ramen', 336, null, null, null, 10, true, false),
  ('r12', 'ramen', 'Chasu Ramen', 325, null, null, null, 11, true, false),
  ('r13', 'ramen', 'Tonkotso Ramen', 336, null, null, null, 12, true, false),
  ('r14', 'ramen', 'Salted Egg Ramen', 336, null, '/menu-images/salted%20egg%20ramen.png', null, 13, true, false),
  ('a1', 'alacarte', 'Mix Fry', 376, null, null, null, 0, true, false),
  ('a2', 'alacarte', 'Shoyo Chicken', 448, null, null, null, 1, true, false),
  ('a3', 'alacarte', 'Ebi Cheesey Tempura', 308, null, '/menu-images/Ebi%20Cheesy%20Tempura.png', 'bestseller', 2, true, false),
  ('a4', 'alacarte', 'Tonkatsu with Cheese', 303, null, null, null, 3, true, false),
  ('a5', 'alacarte', 'Ebi Tempura', 280, null, null, 'bestseller', 4, true, false),
  ('a6', 'alacarte', 'Ebi Furai', 280, null, null, null, 5, true, false),
  ('a7', 'alacarte', 'Karaage', 258, null, null, 'bestseller', 6, true, false),
  ('a8', 'alacarte', 'Tonkatsu', 258, null, null, null, 7, true, false),
  ('a9', 'alacarte', 'Beef Misono (120g)', 308, null, null, null, 8, true, false),
  ('su1', 'sushi', 'Regular Maki - California Maki', 258, null, null, 'bestseller', 0, true, false),
  ('su2', 'sushi', 'Regular Maki - Tuna Futo Maki', 236, null, null, null, 1, true, false),
  ('su3', 'sushi', 'Regular Maki - Maki Roll', 191, null, null, 'bestseller', 2, true, false),
  ('su4', 'sushi', 'Sashimi - Salmon', 432, null, null, null, 3, true, false),
  ('su5', 'sushi', 'Sashimi - Tuna', 336, null, '/menu-images/Tuna%20Sashimi.png', null, 4, true, false),
  ('su6', 'sushi', 'Uramaki - Spicy Cheesy Salmon', 392, null, null, null, 5, true, false),
  ('su7', 'sushi', 'Uramaki - Dragon Roll', 325, null, null, 'bestseller', 6, true, false),
  ('su8', 'sushi', 'Uramaki - Crazy Maki', 325, null, null, null, 7, true, false),
  ('su9', 'sushi', 'Uramaki - Spicy Cheesy Tuna', 348, null, null, null, 8, true, false),
  ('su10', 'sushi', 'Bake Sushi - California Bake', 381, null, null, null, 9, true, false),
  ('su11', 'sushi', 'Bake Sushi - Bake Kaarage', 325, null, null, null, 10, true, false),
  ('su12', 'sushi', 'Bake Sushi - Wasabi Mayo', 314, null, null, null, 11, true, false),
  ('su13', 'sushi', 'Bake Sushi - Spicy Mayo', 325, null, null, null, 12, true, false),
  ('sf1', 'stirfry', 'Gomoko Yakisoba', 370, null, null, null, 0, true, false),
  ('sf2', 'stirfry', 'Katayakisoba', 359, null, null, null, 1, true, false),
  ('sf3', 'stirfry', 'Yakisoba', 359, null, null, 'bestseller', 2, true, false),
  ('sf4', 'stirfry', 'Yaki Udon', 437, null, '/menu-images/Yaki%20Udon.png', 'bestseller', 3, true, false),
  ('sa1', 'salad', 'Kani & Mango', 236, null, null, 'bestseller', 0, true, false),
  ('sa2', 'salad', 'Kani Salad', 224, null, null, null, 1, true, false),
  ('sa3', 'salad', 'Pomelo Salad', 292, null, null, null, 2, true, false),
  ('sa4', 'salad', 'Pokebowl - Tuna & Salmon Poke', 325, null, null, null, 3, true, false),
  ('sa5', 'salad', 'Pokebowl - Poke Salmon', 292, null, null, null, 4, true, false),
  ('sa6', 'salad', 'Pokebowl - Poke Tuna', 280, null, '/menu-images/Tuna%20Poke%20Salad.png', null, 5, true, false),
  ('du1', 'dumplings', 'Jap Bacon Wrap Siomai', 191, null, null, null, 0, true, false),
  ('du2', 'dumplings', 'Takoyaki Bacon', 180, null, null, null, 1, true, false),
  ('du3', 'dumplings', 'Takoyaki Mix', 202, null, null, 'bestseller', 2, true, false),
  ('du4', 'dumplings', 'Takoyaki Shrimp/Squid', 180, null, null, null, 3, true, false),
  ('du5', 'dumplings', 'Pork Gyoza', 157, null, null, 'bestseller', 4, true, false),
  ('du6', 'dumplings', 'Japanese Siomai', 157, null, null, 'bestseller', 5, true, false),
  ('fr1', 'friedrice', 'Lava Rice', 359, null, null, 'bestseller', 0, true, false),
  ('fr2', 'friedrice', 'Umo Rice Seafood', 292, null, null, null, 1, true, false),
  ('fr3', 'friedrice', 'Wagyu', 269, null, null, null, 2, true, false),
  ('fr4', 'friedrice', 'Seafood', 236, null, null, null, 3, true, false),
  ('fr5', 'friedrice', 'Umo Rice Chahan', 185, null, null, 'bestseller', 4, true, false),
  ('fr6', 'friedrice', 'Gyu Yaki Meshe', 180, null, '/menu-images/Gyuniku.png', null, 5, true, false),
  ('fr7', 'friedrice', 'Kimuchi', 180, null, null, null, 6, true, false),
  ('fr8', 'friedrice', 'Chahan', 168, null, null, 'bestseller', 7, true, false),
  ('y1', 'yakitori', 'Wagyu', 437, null, null, 'bestseller', 0, true, false),
  ('y2', 'yakitori', 'Seafood', 292, null, null, null, 1, true, false),
  ('y3', 'yakitori', 'Pork', 280, null, null, 'bestseller', 2, true, false),
  ('y4', 'yakitori', 'Chicken', 280, null, '/menu-images/Chicekn%20Yakitori.png', null, 3, true, false),
  ('p1', 'pizza', 'Creamy Spinach Salmon', 482, null, null, null, 0, true, false),
  ('p2', 'pizza', 'Creamy Wasabe Salmon', 392, null, null, null, 1, true, false),
  ('p3', 'pizza', 'Kane & Tuna', 482, null, null, null, 2, true, false),
  ('p4', 'pizza', 'Beef Misono', 359, null, '/menu-images/Beef%20Misono%20Pizza.png', 'bestseller', 3, true, false),
  ('p5', 'pizza', 'Seafood', 336, null, null, 'bestseller', 4, true, false),
  ('p6', 'pizza', 'Cheesy Bacon Pizza', 336, null, null, null, 5, true, false),
  ('p7', 'pizza', 'Bacon Mushroom Pizza', 336, null, null, null, 6, true, false),
  ('p8', 'pizza', 'Cheesy Cheese Pizza', 292, null, null, null, 7, true, false),
  ('b1', 'bento', 'Bento 1: Tonkatsu', 437, null, null, null, 0, true, false),
  ('b2', 'bento', 'Bento 2: Misono', 471, null, null, 'bestseller', 1, true, false),
  ('b3', 'bento', 'Bento 3: Kaarage', 381, null, null, 'bestseller', 2, true, false),
  ('b4', 'bento', 'Bento 4: Tempura', 426, null, null, null, 3, true, false),
  ('d1', 'doria', 'Chicken or Shrimp', 269, null, null, null, 0, true, false),
  ('d2', 'doria', 'Seafood', 269, null, '/menu-images/Seafood%20Doria.png', null, 1, true, false),
  ('d3', 'doria', 'Beef', 247, null, null, 'bestseller', 2, true, false),
  ('s1', 'side', 'Seafood Yasai', 236, null, null, null, 0, true, false),
  ('s2', 'side', 'Yasaitame', 224, null, null, null, 1, true, false),
  ('s3', 'side', 'Kimuchi', 191, null, null, null, 2, true, false),
  ('do1', 'donburi', 'Ebi Don', 247, null, null, 'bestseller', 0, true, false),
  ('do2', 'donburi', 'Tendon', 236, null, null, null, 1, true, false),
  ('do3', 'donburi', 'Katsudon', 269, null, null, 'bestseller', 2, true, false),
  ('do4', 'donburi', 'Gyodon', 280, null, '/menu-images/GYODON.png', 'bestseller', 3, true, false),
  ('do5', 'donburi', 'Uyakodon', 225, null, null, null, 4, true, false),
  ('do6', 'donburi', 'Toridon', 208, null, '/menu-images/Toridon.png', null, 5, true, false),
  ('do7', 'donburi', 'Katsu Cheesy Curry', 320, null, null, null, 6, true, false),
  ('do8', 'donburi', 'Cheesy Parmesan', 314, null, null, null, 7, true, false),
  ('t1', 'teppanyaki', 'Wagyu Teppan', 504, null, null, 'bestseller', 0, true, false),
  ('t2', 'teppanyaki', 'Seafood Teppan', 325, null, '/menu-images/Seafood%20Teppan.png', null, 1, true, false),
  ('t3', 'teppanyaki', 'Chicken Teppan', 280, null, '/menu-images/Chicken%20Teppan.png', 'bestseller', 2, true, false),
  ('t4', 'teppanyaki', 'Okonomiyaki', 280, null, null, null, 3, true, false),
  ('dr1', 'drinks', 'Smoothies - Cookies & Cream', 146, null, null, 'bestseller', 0, true, false),
  ('dr2', 'drinks', 'Smoothies - Coffee Chocolate', 146, null, null, null, 1, true, false),
  ('dr3', 'drinks', 'Smoothies - Chocolate', 135, null, null, null, 2, true, false),
  ('dr4', 'drinks', 'Smoothies - Vanilla', 135, null, null, null, 3, true, false),
  ('dr5', 'drinks', 'Smoothies - Strawberry', 135, null, null, 'bestseller', 4, true, false),
  ('dr6', 'drinks', 'Fresh Juice - Mango', 124, null, null, null, 5, true, false),
  ('dr7', 'drinks', 'Fresh Juice - Calamansi', 90, null, null, null, 6, true, false),
  ('dr8', 'drinks', 'Fresh Juice - Lemon (Pitcher)', 180, null, null, null, 7, true, false),
  ('dr9', 'drinks', 'Fresh Juice - Lemon (Glass)', 90, null, null, null, 8, true, false),
  ('dr10', 'drinks', 'Mango Shake', 135, null, null, 'bestseller', 9, true, false),
  ('dr11', 'drinks', 'Durian Shake', 245, null, null, null, 10, true, false),
  ('dr12', 'drinks', 'Yakult Shake', 135, null, null, null, 11, true, false),
  ('dr13', 'drinks', 'Japanese Ice Tea (Pitcher)', 213, null, null, null, 12, true, false),
  ('dr14', 'drinks', 'Japanese Ice Tea (Glass)', 90, null, null, null, 13, true, false),
  ('dr15', 'drinks', 'Cucumber Lemonade (Pitcher)', 180, null, null, null, 14, true, false),
  ('dr16', 'drinks', 'Cucumber Lemonade (Glass)', 90, null, null, null, 15, true, false),
  ('dr17', 'drinks', 'Softdrinks (Can)', 96, null, null, null, 16, true, false),
  ('dr18', 'drinks', 'Bottled Water', 34, null, null, null, 17, true, false),
  ('dr19', 'drinks', 'San Miguel Lights', 101, null, null, null, 18, true, false),
  ('dr20', 'drinks', 'San Miguel Pilsen', 101, null, null, null, 19, true, false),
  ('dr21', 'drinks', 'Kirin/Ichiban', 146, null, null, null, 20, true, false),
  ('dr22', 'drinks', 'Sapporo', 146, null, null, null, 21, true, false),
  ('dr23', 'drinks', 'Halo-Halo', 180, null, null, null, 22, true, false),
  ('dr24', 'drinks', 'Mais Con Yelo', 124, null, null, null, 23, true, false)
on conflict (id) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  price = excluded.price,
  description = excluded.description,
  image = excluded.image,
  badge = excluded.badge,
  sort_order = excluded.sort_order;

update menu_items mi
   set is_available = io.is_available,
       is_best_seller = io.is_best_seller
  from item_overrides io
 where io.item_id = mi.id;

create index if not exists menu_items_category_sort_idx on menu_items(category_id, sort_order);
create index if not exists menu_items_available_idx on menu_items(is_available);
