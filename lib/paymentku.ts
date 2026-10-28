import { createHmac, timingSafeEqual } from "node:crypto";

// Paymenku API as used by the official WooCommerce plugin (github.com/paymenku/plugin-woocommerce).
// `||` rather than `??`: an empty `PAYMENTKU_BASE_URL=` line in .env must still fall back. Trailing
// slashes are trimmed: "…/api/v1/" would produce "…/v1//transaction/create", which Paymenku 404s.
const BASE_URL = (process.env.PAYMENTKU_BASE_URL || "https://paymenku.com/api/v1").replace(/\/+$/, "");
// ponytail: one fixed channel for every checkout; let the customer pick via GET /payment-channels if needed.
const CHANNEL = process.env.PAYMENTKU_CHANNEL || "qris";
export const SIGNATURE_HEADER = "x-paymenku-signature";
export const TIMESTAMP_HEADER = "x-paymenku-timestamp";

export type SettledStatus = "PAID" | "EXPIRED" | "CANCELLED";

export type PaymentEvent = {
  orderId: string;
  reference: string | null;
  status: SettledStatus | null; // null = nothing to do (pending, refunded, other events)
  paymentMethod: string | null;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function createInvoice(input: {
  orderId: string;
  amount: number;
  customer: { name: string; email: string };
  returnUrl: string;
}): Promise<{ reference: string; checkoutUrl: string }> {
  const url = `${BASE_URL}/transaction/create`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("PAYMENTKU_API_KEY")}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": input.orderId,
    },
    body: JSON.stringify({
      channel_code: CHANNEL,
      amount: Math.round(input.amount),
      reference_id: input.orderId,
      customer_name: input.customer.name,
      customer_email: input.customer.email,
      return_url: input.returnUrl,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  // Errors come back as HTTP >= 400, or 200 with {status: "error"} / {success: false}.
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body || body.status === "error" || body.success === false) {
    const message = typeof body?.message === "string" ? body.message : "";
    throw new Error(`Paymenku POST ${url} failed: HTTP ${res.status} ${message}`.trim());
  }

  const data = (body.data ?? body) as Record<string, unknown>;
  if (typeof data.trx_id !== "string" || typeof data.pay_url !== "string") {
    throw new Error("Paymenku response is missing trx_id or pay_url");
  }
  return { reference: data.trx_id, checkoutUrl: data.pay_url };
}

// X-PaymenKu-Signature = hex HMAC-SHA256(timestamp + "." + raw body, webhook secret).
export function verifySignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  if (!timestamp || !signature) return false;
  const expected = Buffer.from(
    createHmac("sha256", env("PAYMENTKU_SECRET_KEY")).update(`${timestamp}.${rawBody}`).digest("hex"),
  );
  const given = Buffer.from(signature.trim().toLowerCase());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// A Map, not an object literal: lookups like "constructor" must not hit Object.prototype.
const STATUS_MAP = new Map<string, SettledStatus>([
  ["paid", "PAID"],
  ["expired", "EXPIRED"],
  ["failed", "CANCELLED"],
  ["cancelled", "CANCELLED"],
]);

// Shared by the webhook and check-status: both describe a transaction with the same fields,
// except payment_channel, which is a code string in webhooks and {code, name} in check-status.
function toEvent(t: Record<string, unknown>): PaymentEvent | null {
  if (typeof t.reference_id !== "string") return null;
  // A sandbox transaction must never settle a live order (and vice versa).
  const sandboxKey = (process.env.PAYMENTKU_API_KEY ?? "").startsWith("sk_test_");
  const wrongMode = typeof t.is_sandbox === "boolean" && t.is_sandbox !== sandboxKey;
  const channel = t.payment_channel as { name?: unknown } | string | null | undefined;

  return {
    orderId: t.reference_id,
    reference: typeof t.trx_id === "string" ? t.trx_id : null,
    status: wrongMode || typeof t.status !== "string" ? null : (STATUS_MAP.get(t.status.toLowerCase()) ?? null),
    paymentMethod: typeof channel === "string" ? channel : typeof channel?.name === "string" ? channel.name : null,
  };
}

export function parseEvent(rawBody: string): PaymentEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;
  const event = toEvent(body as Record<string, unknown>);
  if (event && (body as Record<string, unknown>).event !== "payment.status_updated") event.status = null;
  return event;
}

// check-status shares a 120 req/min quota per merchant, and order pages are public, so cap our share:
// one check per order per 30s and 20 per minute overall.
// ponytail: in-memory, per server process; move to a DB timestamp if this runs on many instances.
const lastChecked = new Map<string, number>();
let windowStart = 0;
let windowCount = 0;

export function mayCheckStatus(orderId: string, now: number): boolean {
  if (now - (lastChecked.get(orderId) ?? -Infinity) < 30_000) return false;
  if (now - windowStart >= 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  if (windowCount >= 20) return false;
  windowCount++;
  if (lastChecked.size >= 1_000) lastChecked.clear();
  lastChecked.set(orderId, now);
  return true;
}

// Asks Paymenku for the transaction behind one of our orders. Used when the customer returns, so the
// order settles even if the webhook never reaches us (e.g. the API key belongs to another merchant
// whose webhook URL points elsewhere). Returns null if Paymenku has no such transaction.
export async function checkPaymentStatus(orderId: string): Promise<PaymentEvent | null> {
  const url = `${BASE_URL}/check-status/${encodeURIComponent(orderId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env("PAYMENTKU_API_KEY")}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (res.status === 404) return null;
  const body = (await res.json().catch(() => null)) as { data?: Record<string, unknown> } | null;
  if (!res.ok || !body?.data) throw new Error(`Paymenku GET ${url} failed: HTTP ${res.status}`);
  const event = toEvent(body.data);
  return event?.orderId === orderId ? event : null;
}
