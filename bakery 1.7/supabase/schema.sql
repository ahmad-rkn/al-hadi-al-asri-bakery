-- =============================================================================
-- Al Hadi Al Asri Bakery — Supabase schema
-- =============================================================================
-- Safe to run once on a fresh Supabase project. Paste this whole file into
-- Supabase Dashboard → SQL Editor → New query → Run.
--
-- What this creates:
--   1. products table          (your menu — what the admin panel manages)
--   2. special_offers table    (the homepage poster — what the admin panel manages)
--   3. Row Level Security (RLS) on both, with policies so:
--        - anyone (customers) can READ products and ACTIVE special offers
--        - only logged-in admins can create/edit/delete anything
--   4. auto-updating "updated_at" columns
--   5. storage policies for an image bucket (create the bucket itself in the
--      dashboard first — see SUPABASE_SETUP.md, step 3)
--
-- No orders table is created on purpose — orders continue to go through
-- WhatsApp exactly as before.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PRODUCTS
-- Mirrors the existing js/config.js PRODUCTS shape 1:1 (id/name/category/
-- price/description/image/icon/available) plus sort_order so the admin can
-- control display order, and created_at/updated_at for record-keeping.
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(trim(name)) > 0),
  category     text not null check (category in ('croissants', 'donuts', 'crepes', 'pancakes', 'buns')),
  price        numeric(10, 2) not null check (price >= 0),
  description  text not null default '',
  image        text not null default '',   -- public URL (e.g. from Supabase Storage) or ""
  icon         text not null default '🥐', -- emoji fallback shown when image is empty/broken
  available    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.products is 'The bakery menu. Read by everyone; written only by authenticated admins.';

create index if not exists products_category_idx on public.products (category);
create index if not exists products_sort_order_idx on public.products (sort_order);

-- -----------------------------------------------------------------------------
-- 2. SPECIAL OFFERS
-- Mirrors the existing "special-offer" poster (title/description/price/image/
-- icon). Multiple rows are allowed so the admin can prepare offers ahead of
-- time, but the public site only ever displays the most recently updated
-- ACTIVE row in the single poster slot that already exists on the homepage.
-- -----------------------------------------------------------------------------
create table if not exists public.special_offers (
  id           uuid primary key default gen_random_uuid(),
  title        text not null default 'Special Offer',
  description  text not null check (char_length(trim(description)) > 0),
  price        numeric(10, 2) not null check (price >= 0),
  image        text not null default '',
  icon         text not null default '🎉',
  is_active    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.special_offers is 'Homepage promo poster. Only the newest active row is shown on the site.';

create index if not exists special_offers_active_idx on public.special_offers (is_active) where is_active = true;

-- -----------------------------------------------------------------------------
-- 3. Auto-update "updated_at" on every UPDATE (both tables)
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.special_offers;
create trigger set_updated_at
  before update on public.special_offers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.special_offers enable row level security;

-- Products: everyone (including logged-out customers) can read every product,
-- including sold-out ones — the storefront needs that to show the "Sold Out"
-- badge instead of just hiding the item.
drop policy if exists "Public can read products" on public.products;
create policy "Public can read products"
  on public.products
  for select
  to anon, authenticated
  using (true);

-- Products: only logged-in admins can create/edit/delete.
drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
  on public.products
  for insert
  to authenticated
  with check (true);

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
  on public.products
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
  on public.products
  for delete
  to authenticated
  using (true);

-- Special offers: logged-out customers can only read ACTIVE offers (an
-- inactive/draft offer being prepared by the admin is never exposed to the
-- public API). Admins can read all of them (active + inactive) to manage them.
drop policy if exists "Public can read active offers" on public.special_offers;
create policy "Public can read active offers"
  on public.special_offers
  for select
  to anon
  using (is_active = true);

drop policy if exists "Admins can read all offers" on public.special_offers;
create policy "Admins can read all offers"
  on public.special_offers
  for select
  to authenticated
  using (true);

-- Special offers: only logged-in admins can create/edit/delete.
drop policy if exists "Admins can insert offers" on public.special_offers;
create policy "Admins can insert offers"
  on public.special_offers
  for insert
  to authenticated
  with check (true);

drop policy if exists "Admins can update offers" on public.special_offers;
create policy "Admins can update offers"
  on public.special_offers
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Admins can delete offers" on public.special_offers;
create policy "Admins can delete offers"
  on public.special_offers
  for delete
  to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- 5. STORAGE — run AFTER creating the "product-images" bucket in the
--    dashboard (Storage → New bucket → name it exactly "product-images",
--    toggle "Public bucket" ON). See SUPABASE_SETUP.md step 3 for why this
--    one step can't be done from SQL.
-- -----------------------------------------------------------------------------
drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'product-images');

-- Public read of files in this bucket is already granted by turning on
-- "Public bucket" when you create it — no SELECT policy needed for that.

-- -----------------------------------------------------------------------------
-- 6. SEED DATA (optional) — copies your current js/config.js menu into the
--    database so the admin panel has something to show on first login.
--    Safe to skip or delete this section if you'd rather add products by
--    hand from the admin panel instead.
-- -----------------------------------------------------------------------------
insert into public.products (name, category, price, description, icon, sort_order) values
  ('Chocolate Croissant', 'croissants', 2.50, 'Buttery, flaky croissant filled with rich dark chocolate.', '🥐', 1),
  ('Kinder Croissant',    'croissants', 3.00, 'Warm croissant stuffed with creamy Kinder chocolate.',      '🥐', 2),
  ('Lotus Croissant',     'croissants', 3.00, 'Flaky croissant filled with caramelized Lotus spread.',     '🥐', 3),
  ('Oreo Croissant',      'croissants', 3.00, 'Golden croissant packed with crushed Oreo cream.',          '🥐', 4),
  ('Chocolate Donut',     'donuts',     2.00, 'Soft donut glazed with smooth chocolate ganache.',          '🍩', 5),
  ('Kinder Donut',        'donuts',     2.75, 'Fluffy donut topped and filled with Kinder chocolate.',     '🍩', 6),
  ('Lotus Donut',         'donuts',     2.75, 'Pillowy donut layered with Lotus biscuit crumble.',         '🍩', 7),
  ('Oreo Donut',          'donuts',     2.75, 'Classic donut dressed with Oreo cream and crumbs.',         '🍩', 8),
  ('Kinder Crepe',        'crepes',     4.50, 'Thin, warm crepe rolled with melted Kinder chocolate.',     '🥞', 9),
  ('Lotus Crepe',         'crepes',     4.50, 'Soft crepe drizzled with Lotus caramel sauce.',             '🥞', 10),
  ('Oreo Crepe',          'crepes',     4.50, 'Folded crepe filled with cream and crushed Oreo.',          '🥞', 11),
  ('Classic Pancakes',    'pancakes',   4.00, 'A stack of fluffy pancakes with maple syrup.',               '🥞', 12),
  ('Nutella Pancakes',    'pancakes',   4.75, 'Fluffy pancake stack layered with Nutella.',                 '🥞', 13),
  ('Cinnamon Bun',        'buns',       3.25, 'Soft swirled bun with cinnamon sugar and glaze.',            '🥖', 14),
  ('Cheese Bun',          'buns',       2.50, 'Warm, soft bun baked with a savory cheese filling.',         '🥖', 15)
on conflict do nothing;

insert into public.special_offers (title, description, price, icon, is_active) values
  ('Special Offer', '1 Lotus Crepe + 1 Kinder Crepe + 18 Pancakes', 10, '🎉', true)
on conflict do nothing;
