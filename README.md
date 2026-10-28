# TerraVerde Market

E-commerce produk ramah lingkungan: Next.js 16 (App Router, Cache Components), Supabase, Paymentku.

## Setup

1. `pnpm install`
2. Salin `.env.example` ke `.env.local` dan isi nilainya.
3. Database: jalankan `supabase/migrations/20261028000000_init.sql` lewat `supabase db push` atau SQL editor Supabase. Isinya tabel, RLS, fungsi `create_order`/`settle_order`, dan 8 produk contoh.
4. Di dashboard Paymenku, daftarkan URL webhook `<NEXT_PUBLIC_BASE_URL>/api/paymenku-webhook` dan salin webhook secret ke `PAYMENTKU_SECRET_KEY`. API key `sk_test_...` untuk sandbox, `sk_live_...` untuk produksi.
5. `pnpm dev`

## Alur pembayaran

1. `POST /api/checkout`: validasi input, lalu `create_order` membuat order `PENDING` dengan harga dan CO2 dari DB (harga dari client diabaikan). Setelah itu transaksi dibuat lewat Paymenku `POST /transaction/create` (`reference_id` = id order, kanal `PAYMENTKU_CHANNEL`, default `qris`), `trx_id` dan `pay_url` disimpan di `payments`, lalu `pay_url` dikembalikan. Jika langkah ini gagal, order ditandai `CANCELLED`.
2. `POST /api/paymenku-webhook`: verifikasi `X-PaymenKu-Signature` = HMAC-SHA256(`X-PaymenKu-Timestamp` + "." + raw body), lalu `settle_order` mengubah status order dan payment serta mengurangi stok, dalam satu transaksi. Fungsi ini idempoten, jadi retry webhook aman. Webhook sandbox tidak bisa melunasi order live, dan sebaliknya.
3. `/orders/[id]`: status pesanan dan ringkasan dampak CO2. Selama `PENDING`, halaman ini juga menanyakan status ke Paymenku (`GET /check-status/{order_id}`) dan melunasi order lewat `settle_order` yang sama, jadi status tetap berubah walau webhook tidak sampai (misalnya key sandbox milik merchant lain). Auto-refresh tiap 10 detik.

## Tes

```bash
pnpm test                                                         # signature & parsing webhook
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/orders.test.sql   # create_order / settle_order (di-rollback)
```
