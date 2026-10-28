"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Plus, ShoppingBag } from "lucide-react";
import { cartLanded, flyToCart, leafBurst } from "@/components/cart-effects";
import type { Product } from "@/lib/database.types";

export type CartProduct = Pick<Product, "id" | "slug" | "title" | "price" | "co2_savings_kg" | "stock">;
export type CartItem = CartProduct & { quantity: number };

// Cart lives in localStorage; prices here are for display only, checkout re-prices from the DB.
const KEY = "terraverde-cart";
const EMPTY: CartItem[] = [];
const listeners = new Set<() => void>();
let snapshot: CartItem[] | null = null;

function getSnapshot(): CartItem[] {
  if (snapshot === null) {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      snapshot = Array.isArray(parsed) ? parsed : [];
    } catch {
      snapshot = [];
    }
  }
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

function save(items: CartItem[]) {
  snapshot = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage blocked (private mode): the cart still works for this tab.
  }
  listeners.forEach((listener) => listener());
}

const noopSubscribe = () => () => {};

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return {
    items,
    hydrated,
    count: items.reduce((sum, i) => sum + i.quantity, 0),
    totalAmount: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    totalCo2: items.reduce((sum, i) => sum + i.co2_savings_kg * i.quantity, 0),
    // Mutations read the live snapshot: an add can land after an animation, when this render's `items` is stale.
    add(product: CartProduct) {
      const current = getSnapshot();
      if (!current.some((i) => i.id === product.id)) return save([...current, { ...product, quantity: 1 }]);
      save(current.map((i) => (i.id === product.id ? { ...product, quantity: Math.min(i.quantity + 1, product.stock) } : i)));
    },
    setQuantity(id: string, quantity: number) {
      const current = getSnapshot();
      save(
        quantity <= 0
          ? current.filter((i) => i.id !== id)
          : current.map((i) => (i.id === id ? { ...i, quantity: Math.min(quantity, i.stock) } : i)),
      );
    },
    clear: () => save([]),
  };
}

export function CartBadge() {
  const { count, hydrated } = useCart();
  const icon = useRef<SVGSVGElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
  const previous = useRef<number | null>(null);

  // Celebrate increases only; skips the jump from the empty server render to the stored cart.
  useEffect(() => {
    if (!hydrated) return;
    if (previous.current !== null && count > previous.current) cartLanded(icon.current, badge.current);
    previous.current = count;
  }, [count, hydrated]);

  return (
    <Link
      href="/cart"
      transitionTypes={["nav-forward"]}
      data-cart-target
      className="relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-emerald-50"
      aria-label={`Keranjang, ${count} item`}
    >
      <ShoppingBag ref={icon} className="size-5" aria-hidden />
      <span className="hidden sm:inline">Keranjang</span>
      {count > 0 && (
        <span ref={badge} className="min-w-5 rounded-full bg-emerald-700 px-1.5 text-center text-xs leading-5 text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

export function AddToCartButton({ product }: { product: CartProduct }) {
  const { items, add } = useCart();
  const inCart = items.find((i) => i.id === product.id)?.quantity ?? 0;
  const soldOut = product.stock <= 0;
  const maxed = inCart >= product.stock;
  const [justAdded, setJustAdded] = useState(0);

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(0), 1400);
    return () => clearTimeout(timer);
  }, [justAdded]);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        onClick={(event) => {
          leafBurst(event.currentTarget);
          setJustAdded((n) => n + 1);
          flyToCart(document.querySelector("[data-product-image]"), () => add(product));
        }}
        disabled={soldOut || maxed}
        className="btn-shine rounded-full bg-emerald-700 px-7 py-3.5 font-medium text-white transition duration-150 hover:bg-emerald-800 active:scale-[0.95] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600"
      >
        {justAdded ? (
          <span key={justAdded} className="flex animate-tick items-center gap-2">
            <Check className="size-5" aria-hidden /> Ditambahkan
          </span>
        ) : soldOut ? (
          "Stok habis"
        ) : maxed ? (
          "Batas stok tercapai"
        ) : (
          "Tambah ke keranjang"
        )}
      </button>
      {inCart > 0 && (
        <Link
          href="/cart"
          transitionTypes={["nav-forward"]}
          className="animate-rise text-sm font-medium text-emerald-800 underline underline-offset-4"
        >
          {inCart} di keranjang, lihat keranjang
        </Link>
      )}
    </div>
  );
}

// Round "+" over a catalog card photo; hidden until hover on pointer devices, always shown on touch.
export function QuickAddButton({ product }: { product: CartProduct }) {
  const { add } = useCart();
  const [added, setAdded] = useState(0);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(0), 1200);
    return () => clearTimeout(timer);
  }, [added]);

  return (
    <button
      type="button"
      aria-label={`Tambah ${product.title} ke keranjang`}
      onClick={(event) => {
        leafBurst(event.currentTarget);
        setAdded((n) => n + 1);
        flyToCart(event.currentTarget.closest("li")?.querySelector("[data-product-image]"), () => add(product));
      }}
      className="absolute top-5 right-5 grid size-11 place-items-center rounded-full bg-emerald-700 text-white shadow-[0_10px_24px_-10px_rgb(2_44_34/0.7)] transition duration-300 ease-(--ease-grow) group-hover:translate-y-0 group-hover:opacity-100 hover:bg-emerald-800 focus-visible:translate-y-0 focus-visible:opacity-100 active:scale-90 [@media(hover:hover)]:translate-y-2 [@media(hover:hover)]:opacity-0"
    >
      {added ? (
        <Check key={added} className="size-5 animate-tick" aria-hidden />
      ) : (
        <Plus className="size-5 transition-transform duration-300 group-hover:rotate-90" aria-hidden />
      )}
    </button>
  );
}
