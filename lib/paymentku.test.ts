// node --test lib/paymentku.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { checkPaymentStatus, parseEvent, verifySignature } from "./paymentku.ts";

process.env.PAYMENTKU_SECRET_KEY = "test-secret";
process.env.PAYMENTKU_API_KEY = "sk_test_abc";
const sign = (ts: string, body: string) => createHmac("sha256", "test-secret").update(`${ts}.${body}`).digest("hex");

test("verifySignature binds the timestamp and the exact body", () => {
  const body = JSON.stringify({ reference_id: "x", status: "paid" });
  assert.equal(verifySignature(body, "1700000000", sign("1700000000", body)), true);
  assert.equal(verifySignature(body, "1700000000", sign("1700000000", body).toUpperCase()), true);
  assert.equal(verifySignature(body, "1700000001", sign("1700000000", body)), false);
  assert.equal(verifySignature(body + " ", "1700000000", sign("1700000000", body)), false);
  assert.equal(verifySignature(body, null, sign("1700000000", body)), false);
  assert.equal(verifySignature(body, "1700000000", null), false);
});

test("parseEvent maps payment.status_updated statuses", () => {
  const event = (extra: object) =>
    parseEvent(JSON.stringify({ event: "payment.status_updated", reference_id: "a", trx_id: "T1", ...extra }));
  assert.deepEqual(event({ status: "paid", payment_channel: "qris" }), {
    orderId: "a",
    reference: "T1",
    status: "PAID",
    paymentMethod: "qris",
  });
  assert.equal(event({ status: "EXPIRED" })?.status, "EXPIRED");
  assert.equal(event({ status: "failed" })?.status, "CANCELLED");
  assert.equal(event({ status: "refunded" })?.status, null);
  assert.equal(event({ status: "constructor" })?.status, null);
  assert.equal(event({ status: "paid", is_sandbox: false })?.status, null, "live webhook vs sandbox key");
  assert.equal(event({ status: "paid", is_sandbox: true })?.status, "PAID");
  assert.equal(parseEvent(JSON.stringify({ event: "other", reference_id: "a", status: "paid" }))?.status, null);
  assert.equal(parseEvent(JSON.stringify({ status: "paid" })), null);
  assert.equal(parseEvent("not json"), null);
});

test("checkPaymentStatus reads the transaction for our order id", async () => {
  const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
  const trx = { trx_id: "SBOX1", reference_id: "order-1", status: "paid", is_sandbox: true, payment_channel: { code: "qris", name: "QRIS" } };

  globalThis.fetch = reply(200, { status: "success", data: trx });
  assert.deepEqual(await checkPaymentStatus("order-1"), { orderId: "order-1", reference: "SBOX1", status: "PAID", paymentMethod: "QRIS" });
  assert.equal(await checkPaymentStatus("order-2"), null, "a transaction for another order is ignored");

  globalThis.fetch = reply(200, { status: "success", data: { ...trx, status: "pending" } });
  assert.equal((await checkPaymentStatus("order-1"))?.status, null);

  globalThis.fetch = reply(404, { status: "error" });
  assert.equal(await checkPaymentStatus("order-1"), null);

  globalThis.fetch = reply(429, { status: "error", message: "Rate limit exceeded" });
  await assert.rejects(checkPaymentStatus("order-1"));
});
