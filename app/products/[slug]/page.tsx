import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Leaf, TreePine } from "lucide-react";
import { AddToCartButton } from "@/components/cart";
import { PageTransition } from "@/components/motion";
import { ProductImage } from "@/components/product-image";
import { createClient } from "@/lib/supabase/server";
import { formatIDR, formatKg, treesEquivalent } from "@/lib/utils";

export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <PageTransition>
      <main className="mx-auto w-full max-w-6xl px-4 py-10">
        <Link
          href="/"
          transitionTypes={["nav-back"]}
          className="group inline-flex items-center gap-1 text-sm text-stone-600 hover:text-emerald-800"
        >
          <ArrowLeft className="size-4 transition-transform duration-300 ease-(--ease-grow) motion-safe:group-hover:-translate-x-1" aria-hidden />
          Kembali ke katalog
        </Link>
        <Suspense fallback={<DetailSkeleton />}>
          <ProductDetail params={params} />
        </Suspense>
      </main>
    </PageTransition>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-6 grid gap-10 md:grid-cols-2" aria-busy="true" aria-label="Memuat produk">
      <div className="skeleton aspect-square animate-shimmer rounded-2xl" />
      <div>
        <div className="skeleton h-4 w-24 animate-shimmer rounded" />
        <div className="skeleton mt-3 h-9 w-3/4 animate-shimmer rounded" />
        <div className="skeleton mt-5 h-7 w-32 animate-shimmer rounded" />
        <div className="skeleton mt-6 h-20 animate-shimmer rounded" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="skeleton h-24 animate-shimmer rounded-xl" />
          <div className="skeleton h-24 animate-shimmer rounded-xl" />
        </div>
      </div>
    </div>
  );
}

async function ProductDetail({ params }: { params: PageProps<"/products/[slug]">["params"] }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("*").eq("slug", slug).maybeSingle();
  if (!product) notFound();

  return (
    <div className="mt-6 grid animate-rise gap-10 md:grid-cols-2">
      <ProductImage src={product.image_url} alt={product.title} sizes="(min-width: 768px) 50vw, 100vw" preload />
      <div>
        <p className="text-sm text-stone-600">{product.category}</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-[-0.03em] text-balance text-emerald-950 sm:text-5xl">{product.title}</h1>
        <p className="mt-4 text-2xl font-semibold">{formatIDR(product.price)}</p>
        <p className="mt-4 leading-7 text-stone-700">{product.description}</p>

        <dl className="mt-6 grid grid-cols-2 gap-3">
          <div className="animate-rise rounded-xl bg-emerald-50 p-4 [animation-delay:120ms]">
            <dt className="flex items-center gap-1 text-sm text-emerald-900">
              <Leaf className="size-4" aria-hidden /> CO2 dihemat
            </dt>
            <dd className="mt-1 text-xl font-semibold text-emerald-950">{formatKg(product.co2_savings_kg)}</dd>
          </div>
          <div className="animate-rise rounded-xl bg-emerald-50 p-4 [animation-delay:200ms]">
            <dt className="flex items-center gap-1 text-sm text-emerald-900">
              <TreePine className="size-4" aria-hidden /> Setara pohon/tahun
            </dt>
            <dd className="mt-1 text-xl font-semibold text-emerald-950">{treesEquivalent(product.co2_savings_kg).toLocaleString("id-ID")}</dd>
          </div>
        </dl>

        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Target SDG">
          {product.sdg_target.map((sdg, i) => (
            <li
              key={sdg}
              className="origin-bottom animate-sprout rounded-full border border-emerald-700 px-3 py-1 text-xs font-medium text-emerald-800"
              style={{ animationDelay: `${250 + i * 80}ms` }}
            >
              {sdg}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-stone-600">Stok: {product.stock}</p>
        <div className="mt-3">
          <AddToCartButton
            product={{
              id: product.id,
              slug: product.slug,
              title: product.title,
              price: product.price,
              co2_savings_kg: product.co2_savings_kg,
              stock: product.stock,
            }}
          />
        </div>
      </div>
    </div>
  );
}
