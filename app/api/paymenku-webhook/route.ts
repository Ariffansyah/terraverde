import { NextResponse } from "next/server";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, parseEvent, verifySignature } from "@/lib/paymentku";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/utils";

// Paymentku retries on non-2xx, so only answer 2xx once the update is stored (or safely ignorable).
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!verifySignature(rawBody, request.headers.get(TIMESTAMP_HEADER), request.headers.get(SIGNATURE_HEADER))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = parseEvent(rawBody);
    if (!event || !isUuid(event.orderId)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if (!event.status) return NextResponse.json({ ok: true, ignored: true });

    const { data: changed, error } = await createAdminClient().rpc("settle_order", {
      p_order_id: event.orderId,
      p_status: event.status,
      p_reference: event.reference,
      p_payment_method: event.paymentMethod,
    });
    if (error) {
      if (error.message.includes("ORDER_NOT_FOUND")) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, changed });
  } catch (err) {
    console.error("paymentku webhook failed", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
