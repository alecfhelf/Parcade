-- New Pro Shop gear: women's styles and Halloween. The Pleated skort is Bogey (free) and needs no row.
insert into public.shop_items (id, slot, rarity, price) values
  ('sleevepolo', 'shirt', 'par',       10),
  ('sunhat',     'hat',   'birdie',    20),
  ('holoskirt',  'pants', 'eagle',     50),
  ('gown',       'shirt', 'albatross', 100),
  ('witchhat',   'hat',   'par',       10),
  ('skullmask',  'hat',   'birdie',    20),
  ('candypail',  'item',  'birdie',    20),
  ('pumpkin',    'hat',   'eagle',     50)
on conflict (id) do update set slot = excluded.slot, rarity = excluded.rarity, price = excluded.price;
