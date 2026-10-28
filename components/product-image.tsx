import Image from "next/image";
import { Leaf } from "lucide-react";

// Inside a `group` link, the image slowly zooms and the placeholder leaf sways on hover.
export function ProductImage({ src, alt, sizes, preload }: { src: string | null; alt: string; sizes: string; preload?: boolean }) {
  return (
    <div data-product-image className="relative aspect-square overflow-hidden rounded-2xl bg-emerald-50">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          preload={preload}
          className="object-cover transition-transform duration-700 ease-(--ease-grow) motion-safe:group-hover:scale-105"
        />
      ) : (
        <Leaf
          className="absolute inset-0 m-auto size-1/4 text-emerald-300 transition duration-700 ease-(--ease-grow) group-hover:text-emerald-500 motion-safe:group-hover:-rotate-12 motion-safe:group-hover:scale-110"
          aria-hidden
        />
      )}
    </div>
  );
}
