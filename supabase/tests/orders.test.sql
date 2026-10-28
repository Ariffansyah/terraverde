-- Self-check for create_order / settle_order. Safe on any database: everything rolls back.
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/orders.test.sql
begin;

do $$
declare
  v_bottle uuid := (select id from products where slug = 'botol-minum-stainless');
  v_brush uuid := (select id from products where slug = 'sikat-gigi-bambu');
  v_stock int := (select stock from products where id = v_bottle);
  v_order orders;
begin
  -- duplicate lines are merged, totals come from DB prices
  v_order := create_order(null, 'Budi', 'budi@example.com', 'Jl. Hijau 1', jsonb_build_array(
    jsonb_build_object('product_id', v_bottle, 'quantity', 1),
    jsonb_build_object('product_id', v_bottle, 'quantity', 1),
    jsonb_build_object('product_id', v_brush, 'quantity', 1)));
  assert v_order.status = 'PENDING';
  assert v_order.total_amount = 129000 * 2 + 45000, 'total';
  assert v_order.total_co2_saved = 8.2 * 2 + 1.1, 'co2';
  assert (select count(*) from order_items where order_id = v_order.id) = 2, 'merged items';

  insert into payments (order_id, paymentku_reference) values (v_order.id, 'REF-1');

  assert settle_order(v_order.id, 'PAID', 'REF-1', 'QRIS'), 'first PAID applies';
  assert (select stock from products where id = v_bottle) = v_stock - 2, 'stock deducted';
  assert (select status from payments where order_id = v_order.id) = 'PAID';
  assert (select payment_method from payments where order_id = v_order.id) = 'QRIS';

  assert not settle_order(v_order.id, 'PAID', 'REF-1', 'QRIS'), 'retry is a no-op';
  assert not settle_order(v_order.id, 'EXPIRED', 'REF-1', null), 'cannot expire a paid order';
  assert (select stock from products where id = v_bottle) = v_stock - 2, 'stock deducted once';

  -- a late PAID after EXPIRED still counts
  v_order := create_order(null, 'Sari', 'sari@example.com', 'Jl. Hijau 2',
    jsonb_build_array(jsonb_build_object('product_id', v_brush, 'quantity', 1)));
  assert settle_order(v_order.id, 'EXPIRED', null, null);
  assert settle_order(v_order.id, 'PAID', null, null), 'PAID overrides EXPIRED';
  assert (select status from orders where id = v_order.id) = 'PAID';

  begin
    perform create_order(null, 'X', 'x@example.com', 'Jl. X',
      jsonb_build_array(jsonb_build_object('product_id', v_bottle, 'quantity', 100000)));
    raise exception 'expected INSUFFICIENT_STOCK';
  exception when raise_exception then
    assert sqlerrm = 'INSUFFICIENT_STOCK', sqlerrm;
  end;

  begin
    perform create_order(null, 'X', 'x@example.com', 'Jl. X', '[]');
    raise exception 'expected EMPTY_CART';
  exception when raise_exception then
    assert sqlerrm = 'EMPTY_CART', sqlerrm;
  end;

  raise notice 'orders.test.sql: all checks passed';
end;
$$;

rollback;
