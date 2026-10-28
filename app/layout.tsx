import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Leaf } from "lucide-react";
import { CartBadge } from "@/components/cart";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TerraVerde Market",
  description: "Produk ramah lingkungan dengan dampak CO2 yang terukur.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 border-b border-stone-200 bg-white" style={{ viewTransitionName: "site-header" }}>
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" transitionTypes={["nav-back"]} className="group flex items-center gap-2 text-lg font-semibold text-emerald-900">
              <Leaf className="size-5 text-emerald-700 transition-transform duration-500 ease-(--ease-grow) motion-safe:group-hover:-rotate-12" aria-hidden />
              TerraVerde Market
            </Link>
            <CartBadge />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
