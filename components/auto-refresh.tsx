"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renders the server page on an interval, so the order status updates once the webhook lands.
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
