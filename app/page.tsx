import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { Leaf, Search } from "lucide-react";
import { QuickAddButton } from "@/components/cart";
import { LeafDrawing, PageTransition } from "@/components/motion";
import { ProductImage } from "@/components/product-image";
import { createClient } from "@/lib/supabase/server";
import { SDG_TARGETS, formatIDR, formatKg } from "@/lib/utils";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <PageTransition>
      <section className="relative isolate overflow-hidden bg-emerald-950 text-white">
        <LeafDrawing className="absolute top-1/2 -right-20 -z-10 h-[88%] -translate-y-1/2 stroke-[0.4] text-emerald-800 sm:right-[6%]" />
        <HeroCollage />
        <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <h1 className="max-w-3xl text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-7xl">
            <MaskedLine delay={0}>Belanja yang bisa</MaskedLine>
            <MaskedLine delay={110}>diukur dampaknya</MaskedLine>
          </h1>
          <p className="mt-6 max-w-xl animate-rise text-lg text-emerald-100 [animation-delay:450ms]">
            Setiap produk mencantumkan estimasi CO2 yang dihemat dan target SDG yang didukung.
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16">
        <Suspense fallback={<CatalogSkeleton />}>
          <Catalog searchParams={searchParams} />
        </Suspense>
      </main>
    </PageTransition>
  );
}

// Three product photos grow up out of the hero floor and settle into a fan (large screens only).
const COLLAGE = [
  { slug: "bibit-pohon-mahoni", className: "left-0 top-10 -rotate-[7deg]", delay: 520 },
  { slug: "botol-minum-stainless", className: "left-[31%] top-0 z-10 rotate-[2deg]", delay: 640 },
  { slug: "tas-belanja-kanvas", className: "right-0 top-14 rotate-[8deg]", delay: 760 },
];

function HeroCollage() {
  return (
    <div className="pointer-events-none absolute top-1/2 right-[5%] hidden h-[74%] w-[36%] max-w-lg -translate-y-1/2 lg:block" aria-hidden>
      {COLLAGE.map(({ slug, className, delay }) => (
        <div
          key={slug}
          className={`absolute aspect-[4/5] w-[40%] origin-bottom animate-sprout overflow-hidden rounded-2xl shadow-[0_28px_50px_-22px_rgb(0_0_0/0.75)] ring-1 ring-white/10 ${className}`}
          style={{ animationDelay: `${delay}ms` }}
        >
          <Image src={`/products/${slug}.jpg`} alt="" fill sizes="16vw" preload className="object-cover" />
        </div>
      ))}
    </div>
  );
}

function MaskedLine({ delay, children }: { delay: number; children: string }) {
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <span className="block animate-unmask" style={{ animationDelay: `${delay}ms` }}>
        {children}
      </span>
    </span>
  );
}

function CatalogSkeleton() {
  return (
    <div aria-busy="true" aria-label="Memuat produk">
      <div className="skeleton -mt-8 h-24 animate-shimmer rounded-2xl" />
      <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="rounded-3xl border border-stone-200 bg-white p-3">
            <div className="skeleton aspect-square animate-shimmer rounded-2xl" />
            <div className="skeleton mt-3 h-4 w-3/4 animate-shimmer rounded" />
            <div className="skeleton mt-2 h-4 w-1/3 animate-shimmer rounded" />
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Catalog({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";
  const sdg = typeof params.sdg === "string" && SDG_TARGETS.includes(params.sdg) ? params.sdg : "";

  const supabase = await createClient();
  let query = supabase.from("products").select("*").order("created_at", { ascending: false });
  if (q) {
    // Quoted PostgREST filter value; strip characters that would break quoting or act as wildcards.
    const term = q.replace(/[%_"\\]/g, "");
    query = query.or(`title.ilike."%${term}%",description.ilike."%${term}%"`);
  }
  if (category) query = query.eq("category", category);
  if (sdg) query = query.contains("sdg_target", [sdg]);

  const [{ data: products, error }, { data: categoryRows }] = await Promise.all([
    query,
    supabase.from("products").select("category"),
  ]);
  const categories = [...new Set(categoryRows?.map((row) => row.category))].sort();

  return (
    <>
      {/* next/form keeps filtering a client navigation, so the results below can crossfade. */}
      <Form
        action="/"
        className="relative -mt-8 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_18px_40px_-24px_rgb(2_44_34/0.45)] sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
          Cari
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Botol, bambu, kompos…"
            className="rounded-lg border border-stone-300 px-3 py-2 font-normal transition-colors focus:border-emerald-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Kategori
          <select name="category" defaultValue={category} className="rounded-lg border border-stone-300 px-3 py-2 font-normal">
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Target SDG
          <select name="sdg" defaultValue={sdg} className="rounded-lg border border-stone-300 px-3 py-2 font-normal">
            <option value="">Semua SDG</option>
            {SDG_TARGETS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white transition duration-150 hover:bg-emerald-800 active:scale-[0.97]">
          <Search className="size-4" aria-hidden />
          Terapkan
        </button>
        {(q || category || sdg) && (
          <Link href="/" className="py-2 text-center text-sm text-stone-600 underline underline-offset-4">
            Reset
          </Link>
        )}
      </Form>

      <ViewTransition key={`${q}|${category}|${sdg}`} name="catalog-results" share="auto" default="none">
        <div>
          {error ? (
            <p role="alert" className="mt-10 text-red-700">Gagal memuat produk. Coba muat ulang halaman.</p>
          ) : products.length === 0 ? (
            <p className="mt-10 animate-rise text-stone-600">Tidak ada produk yang cocok dengan filter ini.</p>
          ) : (
            <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p, i) => (
                <li key={p.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                  <div
                    className="group scroll-reveal relative h-full transition duration-300 ease-(--ease-grow) motion-safe:hover:-translate-y-1"
                    style={{ animationRange: "entry 0% entry 75%" }}
                  >
                    <Link
                      href={`/products/${p.slug}`}
                      transitionTypes={["nav-forward"]}
                      className="block h-full rounded-3xl border border-stone-200 bg-white p-3 transition duration-300 ease-(--ease-grow) group-hover:border-emerald-600 group-hover:shadow-[0_16px_32px_-18px_rgb(6_78_59/0.45)]"
                    >
                      <ProductImage src={p.image_url} alt={p.title} sizes="(min-width: 1024px) 25vw, 50vw" />
                      <h2 className="mt-3 font-medium transition-colors group-hover:text-emerald-800">{p.title}</h2>
                      <p className="text-sm text-stone-600">{p.category}</p>
                      <p className="mt-1 font-semibold tabular-nums">{formatIDR(p.price)}</p>
                      <p className="mt-2 flex items-center gap-1 text-sm text-emerald-800">
                        <Leaf className="size-4 transition-transform duration-500 ease-(--ease-grow) motion-safe:group-hover:-rotate-12" aria-hidden />
                        Hemat {formatKg(p.co2_savings_kg)} CO2
                      </p>
                      {p.stock === 0 && <p className="mt-1 text-sm font-medium text-red-700">Stok habis</p>}
                    </Link>
                    {p.stock > 0 && (
                      <QuickAddButton
                        product={{ id: p.id, slug: p.slug, title: p.title, price: p.price, co2_savings_kg: p.co2_savings_kg, stock: p.stock }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ViewTransition>
    </>
  );
}
