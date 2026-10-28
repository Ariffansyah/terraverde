-- TerraVerde Market schema. Apply with `supabase db push` or paste into the Supabase SQL editor.

create table products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  stock int not null default 0 check (stock >= 0),
  image_url text,
  category text not null,
  co2_savings_kg numeric(10, 2) not null default 0 check (co2_savings_kg >= 0),
  sdg_target text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index products_category_idx on products (category);
create index products_sdg_target_idx on products using gin (sdg_target);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  total_co2_saved numeric(10, 2) not null default 0,
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED')),
  shipping_address text not null,
  created_at timestamptz not null default now()
);
create index orders_user_id_idx on orders (user_id);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references products (id),
  quantity int not null check (quantity > 0),
  price numeric(12, 2) not null check (price >= 0)
);
create index order_items_order_id_idx on order_items (order_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders (id) on delete cascade,
  paymentku_reference text unique,
  payment_method text,
  status text not null default 'PENDING',
  checkout_url text,
  created_at timestamptz not null default now()
);

-- Catalog is public; orders and payments are only touched by the server with the service role key.
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
create policy "products are public" on products for select using (true);

-- Creates a PENDING order with prices and CO2 taken from the products table, never from the client.
create function create_order(
  p_user_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_shipping_address text,
  p_items jsonb -- [{"product_id": uuid, "quantity": int}]
) returns orders
language plpgsql
set search_path = public
as $$
declare
  v_order orders;
  v_item record;
  v_total numeric := 0;
  v_co2 numeric := 0;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  insert into orders (user_id, customer_name, customer_email, shipping_address, total_amount)
  values (p_user_id, p_customer_name, p_customer_email, p_shipping_address, 0)
  returning * into v_order;

  for v_item in
    select r.product_id, r.quantity, p.id, p.price, p.stock, p.co2_savings_kg
    from (
      select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::int) as quantity
      from jsonb_array_elements(p_items) e
      group by 1
    ) r
    left join products p on p.id = r.product_id
  loop
    if v_item.id is null then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;
    if v_item.quantity <= 0 or v_item.stock < v_item.quantity then
      raise exception 'INSUFFICIENT_STOCK';
    end if;

    insert into order_items (order_id, product_id, quantity, price)
    values (v_order.id, v_item.id, v_item.quantity, v_item.price);

    v_total := v_total + v_item.price * v_item.quantity;
    v_co2 := v_co2 + v_item.co2_savings_kg * v_item.quantity;
  end loop;

  update orders set total_amount = v_total, total_co2_saved = v_co2
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

-- Applies a payment result. Returns false when nothing changed (webhook retry or replay).
-- PAID wins over EXPIRED/CANCELLED because money was actually received; stock is deducted exactly once.
create function settle_order(
  p_order_id uuid,
  p_status text,
  p_reference text,
  p_payment_method text
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_current text;
begin
  if p_status not in ('PAID', 'EXPIRED', 'CANCELLED') then
    raise exception 'INVALID_STATUS';
  end if;

  select status into v_current from orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_current = 'PAID' or (p_status <> 'PAID' and v_current <> 'PENDING') then
    return false;
  end if;

  update orders set status = p_status where id = p_order_id;

  if p_status = 'PAID' then
    -- ponytail: stock is checked at checkout but only deducted here, so concurrent buyers can oversell
    -- (clamped at 0); reserve stock in create_order if that matters.
    update products p set stock = greatest(p.stock - oi.quantity, 0)
    from order_items oi
    where oi.order_id = p_order_id and p.id = oi.product_id;
  end if;

  update payments
  set status = p_status,
      payment_method = coalesce(p_payment_method, payment_method),
      paymentku_reference = coalesce(paymentku_reference, p_reference)
  where order_id = p_order_id;

  return true;
end;
$$;

-- Supabase grants EXECUTE on new functions to anon/authenticated; these must only run server-side.
revoke execute on function create_order from public, anon, authenticated;
revoke execute on function settle_order from public, anon, authenticated;
grant execute on function create_order to service_role;
grant execute on function settle_order to service_role;

insert into products (title, slug, description, price, stock, category, co2_savings_kg, sdg_target) values
  ('Botol Minum Stainless 750ml', 'botol-minum-stainless', 'Pengganti ratusan botol plastik sekali pakai per tahun.', 129000, 50, 'Rumah Tangga', 8.2, '{SDG 12,SDG 13}'),
  ('Sikat Gigi Bambu (isi 4)', 'sikat-gigi-bambu', 'Gagang bambu yang dapat terurai, bulu sikat bebas BPA.', 45000, 120, 'Perawatan Diri', 1.1, '{SDG 12,SDG 15}'),
  ('Tas Belanja Kanvas Organik', 'tas-belanja-kanvas', 'Katun organik tanpa pewarna sintetis, kuat menahan 15 kg.', 79000, 80, 'Fashion', 5.4, '{SDG 12}'),
  ('Sabun Batang Zero Waste', 'sabun-batang-zero-waste', 'Tanpa kemasan plastik, bahan nabati lokal.', 35000, 200, 'Perawatan Diri', 0.6, '{SDG 12}'),
  ('Lampu Tenaga Surya Taman', 'lampu-tenaga-surya', 'Menyala 10 jam dari pengisian matahari, tanpa listrik PLN.', 189000, 30, 'Energi', 24.5, '{SDG 13}'),
  ('Bibit Pohon Mahoni', 'bibit-pohon-mahoni', 'Bibit setinggi 40 cm, siap tanam untuk penghijauan.', 25000, 300, 'Kebun', 21.0, '{SDG 13,SDG 15}'),
  ('Komposter Rumah 20L', 'komposter-rumah', 'Ubah sisa dapur menjadi pupuk dan kurangi emisi metana TPA.', 249000, 25, 'Kebun', 48.0, '{SDG 12,SDG 13,SDG 15}'),
  ('Sedotan Stainless (set 4)', 'sedotan-stainless', 'Lengkap dengan sikat pembersih dan kantong kain.', 39000, 150, 'Rumah Tangga', 0.9, '{SDG 12,SDG 15}');
