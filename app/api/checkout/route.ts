import { NextResponse } from "next/server";
import { createInvoice } from "@/lib/paymentku";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

type CheckoutInput = {
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  items: { product_id: string; quantity: number }[];
};

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

// Returns the validated input, or an error message for the customer.
function parseInput(body: unknown): CheckoutInput | string {
  if (typeof body !== "object" || body === null) return "Permintaan tidak valid";
  const b = body as Record<string, unknown>;

  const name = text(b.customer_name, 100);
  const email = text(b.customer_email, 254);
  const address = text(b.shipping_address, 500);
  if (!name) return "Nama wajib diisi";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email tidak valid";
  if (!address) return "Alamat pengiriman wajib diisi";
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 50) return "Keranjang kosong";

  const items: CheckoutInput["items"] = [];
  for (const raw of b.items) {
    const { product_id, quantity } = (raw ?? {}) as Record<string, unknown>;
    if (typeof product_id !== "string" || !isUuid(product_id)) return "Produk tidak valid";
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return "Jumlah produk tidak valid";
    }
    items.push({ product_id, quantity });
  }
  return { customer_name: name, customer_email: email, shipping_address: address, items };
}

export async function POST(request: Request) {
  const input = parseInput(await request.json().catch(() => null));
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) throw new Error("NEXT_PUBLIC_BASE_URL is not set");

    // Guest checkout is allowed; link the order when the visitor is signed in.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const admin = createAdminClient();
    const { data: order, error } = await admin.rpc("create_order", {
      p_user_id: user?.id ?? null,
      p_customer_name: input.customer_name,
      p_customer_email: input.customer_email,
      p_shipping_address: input.shipping_address,
      p_items: input.items,
    });
    if (error) {
      if (error.message.includes("INSUFFICIENT_STOCK")) {
        return NextResponse.json({ error: "Stok salah satu produk tidak mencukupi" }, { status: 409 });
      }
      if (error.message.includes("PRODUCT_NOT_FOUND")) {
        return NextResponse.json({ error: "Salah satu produk sudah tidak tersedia" }, { status: 409 });
      }
      throw error;
    }

    try {
      const invoice = await createInvoice({
        orderId: order.id,
        amount: order.total_amount,
        customer: { name: order.customer_name, email: order.customer_email },
        returnUrl: `${baseUrl}/orders/${order.id}`,
      });

      const { error: paymentError } = await admin.from("payments").insert({
        order_id: order.id,
        paymentku_reference: invoice.reference,
        checkout_url: invoice.checkoutUrl,
      });
      if (paymentError) throw paymentError;

      return NextResponse.json({ order_id: order.id, checkout_url: invoice.checkoutUrl });
    } catch (err) {
      // Don't leave an order nobody can pay for stuck in PENDING.
      console.error(`checkout: invoice step failed for order ${order.id}`, err);
      await admin.from("orders").update({ status: "CANCELLED" }).eq("id", order.id).eq("status", "PENDING");
      return NextResponse.json({ error: "Gagal membuat tagihan pembayaran, silakan coba lagi" }, { status: 502 });
    }
  } catch (err) {
    console.error("checkout failed", err);
    return NextResponse.json({ error: "Terjadi kesalahan, silakan coba lagi" }, { status: 500 });
  }
}
