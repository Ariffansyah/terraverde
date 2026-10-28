import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CircleX, Clock } from "lucide-react";
import { AutoRefresh } from "@/components/auto-refresh";
import { ImpactPanel } from "@/components/impact";
import type { OrderStatus } from "@/lib/database.types";
import { checkPaymentStatus } from "@/lib/paymentku";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatIDR, isUuid } from "@/lib/utils";

const STATUS: Record<OrderStatus, { label: string; className: string }> = {
  PENDING: { label: "Menunggu pembayaran", className: "bg-amber-50 text-amber-900" },
  PAID: { label: "Pembayaran berhasil", className: "bg-emerald-50 text-emerald-900" },
  EXPIRED: { label: "Tagihan kedaluwarsa", className: "bg-stone-100 text-stone-800" },
  CANCELLED: { label: "Pesanan dibatalkan", className: "bg-red-50 text-red-900" },
};

function StatusIcon({ status }: { status: OrderStatus }) {
  if (status === "PAID") {
    // Circle, then tick, draw themselves; re-mounts (and replays) when polling flips PENDING to PAID.
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-8 shrink-0" aria-hidden>
        <circle cx="12" cy="12" r="10" pathLength={1} className="animate-draw [stroke-dasharray:1] [animation-duration:0.8s]" />
        <path d="m8 12.5 2.5 2.5 5.5-5.5" pathLength={1} className="animate-draw [stroke-dasharray:1] [animation-delay:450ms] [animation-duration:0.6s]" />
      </svg>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="relative flex size-8 shrink-0 items-center justify-center" aria-hidden>
        <span className="absolute inset-0 animate-breathe rounded-full bg-amber-400/50" />
        <Clock className="relative size-7" />
      </span>
    );
  }
  return <CircleX className="size-8 shrink-0" aria-hidden />;
}

function OrderSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat pesanan">
      <div className="skeleton h-4 w-32 animate-shimmer rounded" />
      <div className="skeleton mt-3 h-10 w-2/3 animate-shimmer rounded" />
      <div className="skeleton mt-6 h-20 animate-shimmer rounded-2xl" />
      <div className="skeleton mt-6 h-56 animate-shimmer rounded-3xl" />
    </div>
  );
}

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Suspense fallback={<OrderSkeleton />}>
        <Order params={params} />
      </Suspense>
    </main>
  );
}

// Settles a PENDING order from Paymenku's own record, for when the webhook hasn't reached us.
// Returns true when Paymenku reports a final status, even if a concurrent render or the webhook
// settled it first, so the caller reloads. Failures (rate limit, network) just leave it PENDING.
async function reconcile(orderId: string): Promise<boolean> {
  try {
    const event = await checkPaymentStatus(orderId);
    if (!event?.status) return false;
    const { error } = await createAdminClient().rpc("settle_order", {
      p_order_id: orderId,
      p_status: event.status,
      p_reference: event.reference,
      p_payment_method: event.paymentMethod,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error(`paymenku reconcile failed for order ${orderId}`, err);
    return false;
  }
}

async function Order({ params }: { params: PageProps<"/orders/[id]">["params"] }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  // The order UUID acts as the access key (guest checkout), so only non-sensitive fields are shown.
  const loadOrder = () =>
    createAdminClient()
      .from("orders")
      .select("id, customer_name, status, total_amount, total_co2_saved, created_at, order_items(id, quantity, price, products(title)), payments(checkout_url, payment_method)")
      .eq("id", id)
      .maybeSingle();
  let { data: order, error } = await loadOrder();
  if (order?.status === "PENDING" && order.payments && (await reconcile(id))) {
    ({ data: order, error } = await loadOrder());
  }
  if (error) {
    return <p role="alert" className="text-red-700">Gagal memuat pesanan. Coba muat ulang halaman.</p>;
  }
  if (!order) notFound();

  const status = STATUS[order.status];

  return (
    <>
      {/* Each refresh re-checks Paymenku (quota: 120 req/min per merchant), so poll gently. */}
      {order.status === "PENDING" && <AutoRefresh intervalMs={10_000} />}
      <p className="text-sm text-stone-600">Pesanan #{order.id.slice(0, 8)}</p>
      <h1 className="mt-1 animate-rise text-4xl font-semibold tracking-[-0.03em] text-balance text-emerald-950">
        Terima kasih, {order.customer_name}
      </h1>

      <div
        key={order.status}
        className={`mt-6 flex animate-rise flex-wrap items-center gap-4 rounded-2xl p-5 transition-colors duration-500 [animation-delay:100ms] ${status.className}`}
        role="status"
      >
        <StatusIcon status={order.status} />
        <div className="flex-1">
          <p className="font-medium">{status.label}</p>
          {order.status === "PENDING" && <p className="text-sm">Halaman ini diperbarui otomatis setelah pembayaran diterima.</p>}
          {order.payments?.payment_method && <p className="text-sm">Metode: {order.payments.payment_method}</p>}
        </div>
        {order.status === "PENDING" && order.payments?.checkout_url && (
          <a
            href={order.payments.checkout_url}
            className="rounded-full bg-amber-900 px-5 py-2.5 text-sm font-medium text-white transition duration-150 hover:bg-amber-950 active:scale-[0.97]"
          >
            Lanjutkan bayar
          </a>
        )}
      </div>

      <div className="mt-6 animate-rise [animation-delay:200ms]">
        <ImpactPanel
          co2Kg={order.total_co2_saved}
          heading={order.status === "PAID" ? "Dampak yang Anda hasilkan" : "Dampak setelah pembayaran"}
          treesLabel="pohon diselamatkan (setara serapan per tahun)"
        />
      </div>

      <section className="mt-6 animate-rise rounded-2xl border border-stone-200 bg-white [animation-delay:300ms]">
        <h2 className="border-b border-stone-200 p-4 font-semibold">Ringkasan pesanan</h2>
        <ul className="divide-y divide-stone-200">
          {order.order_items.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 p-4">
              <span>
                {item.products?.title ?? "Produk"} × {item.quantity}
              </span>
              <span className="tabular-nums">{formatIDR(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between border-t border-stone-200 p-4 text-lg font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatIDR(order.total_amount)}</span>
        </p>
      </section>

      <Link href="/" transitionTypes={["nav-back"]} className="mt-6 inline-block font-medium text-emerald-800 underline underline-offset-4">
        Lanjut belanja
      </Link>
    </>
  );
}
