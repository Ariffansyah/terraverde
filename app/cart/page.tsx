"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { LoaderCircle, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart";
import { ImpactPanel } from "@/components/impact";
import { LeafDrawing, PageTransition } from "@/components/motion";
import { formatIDR, formatKg } from "@/lib/utils";

export default function CartPage() {
  const cart = useCart();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string[]>([]);

  // Slide the row out first, then drop it from the cart.
  function remove(id: string) {
    setLeaving((ids) => [...ids, id]);
    setTimeout(() => {
      cart.setQuantity(id, 0);
      setLeaving((ids) => ids.filter((x) => x !== id));
    }, 240);
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.get("name"),
          customer_email: form.get("email"),
          shipping_address: form.get("address"),
          items: cart.items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; checkout_url?: string };
      if (!res.ok || !data.checkout_url) throw new Error(data.error ?? "Checkout gagal, silakan coba lagi");
      cart.clear();
      window.location.assign(data.checkout_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout gagal, silakan coba lagi");
      setPending(false);
    }
  }

  // localStorage is unknown during SSR; render nothing rather than flash the empty state.
  if (!cart.hydrated) return <main className="min-h-[60vh]" />;

  if (cart.items.length === 0) {
    return (
      <PageTransition>
        <main className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-20 text-center">
          <LeafDrawing className="size-28 stroke-[1.2] text-emerald-600" />
          <h1 className="mt-6 animate-rise text-3xl font-semibold tracking-tight text-emerald-950 [animation-delay:300ms]">
            Keranjang masih kosong
          </h1>
          <Link
            href="/"
            transitionTypes={["nav-back"]}
            className="mt-4 inline-block animate-rise font-medium text-emerald-800 underline underline-offset-4 [animation-delay:420ms]"
          >
            Lihat katalog
          </Link>
        </main>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_380px]">
        <section>
          <h1 className="animate-rise text-3xl font-semibold tracking-tight text-emerald-950">Keranjang</h1>
          <ul className="mt-6 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {cart.items.map((item, i) => (
              <li
                key={item.id}
                className={`flex flex-wrap items-center gap-4 p-4 ${leaving.includes(item.id) ? "animate-leave" : "animate-rise"}`}
                style={{ animationDelay: leaving.includes(item.id) ? undefined : `${80 + Math.min(i, 8) * 60}ms` }}
              >
                <div className="min-w-40 flex-1">
                  <Link href={`/products/${item.slug}`} transitionTypes={["nav-forward"]} className="font-medium hover:text-emerald-800">
                    {item.title}
                  </Link>
                  <p className="text-sm text-stone-600">
                    {formatIDR(item.price)} · hemat {formatKg(item.co2_savings_kg)} CO2/item
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => (item.quantity > 1 ? cart.setQuantity(item.id, item.quantity - 1) : remove(item.id))}
                    className="rounded-full p-2 transition hover:bg-stone-100 active:scale-90"
                    aria-label={`Kurangi ${item.title}`}
                  >
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <span className="w-8 overflow-hidden text-center tabular-nums" aria-live="polite">
                    <span key={item.quantity} className="inline-block animate-tick">{item.quantity}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => cart.setQuantity(item.id, item.quantity + 1)}
                    disabled={item.quantity >= item.stock}
                    className="rounded-full p-2 transition hover:bg-stone-100 active:scale-90 disabled:opacity-40"
                    aria-label={`Tambah ${item.title}`}
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
                <p key={item.quantity} className="ml-auto w-28 animate-tick text-right font-medium tabular-nums">{formatIDR(item.price * item.quantity)}</p>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-red-700 active:scale-90"
                  aria-label={`Hapus ${item.title}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 animate-rise [animation-delay:200ms]">
            <ImpactPanel co2Kg={cart.totalCo2} heading="Dampak lingkungan pesanan ini" treesLabel="setara serapan pohon per tahun" />
          </div>
        </section>

        <form onSubmit={checkout} className="h-fit animate-rise rounded-2xl border border-stone-200 bg-white p-6 [animation-delay:120ms] lg:sticky lg:top-20">
          <h2 className="text-lg font-semibold">Pengiriman</h2>
          <label className="mt-4 flex flex-col gap-1 text-sm font-medium">
            Nama lengkap
            <input name="name" required maxLength={100} autoComplete="name" className="rounded-lg border border-stone-300 px-3 py-2 font-normal" />
          </label>
          <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
            Email
            <input name="email" type="email" required maxLength={254} autoComplete="email" className="rounded-lg border border-stone-300 px-3 py-2 font-normal" />
          </label>
          <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
            Alamat pengiriman
            <textarea name="address" required maxLength={500} rows={3} autoComplete="street-address" className="rounded-lg border border-stone-300 px-3 py-2 font-normal" />
          </label>

          <div className="mt-6 flex justify-between border-t border-stone-200 pt-4 text-lg font-semibold">
            <span>Total</span>
            <span key={cart.totalAmount} className="animate-tick tabular-nums">{formatIDR(cart.totalAmount)}</span>
          </div>

          {error && (
            <p role="alert" className="mt-3 animate-rise text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            disabled={pending}
            className="btn-shine mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-3.5 font-medium text-white transition duration-150 hover:bg-emerald-800 active:scale-[0.97] disabled:opacity-60"
          >
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            {pending ? "Membuat tagihan…" : "Bayar dengan Paymentku"}
          </button>
        </form>
      </main>
    </PageTransition>
  );
}
