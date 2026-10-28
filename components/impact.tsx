"use client";

import { useEffect, useRef, useState } from "react";
import { Leaf, TreePine } from "lucide-react";
import { formatKg, treesEquivalent } from "@/lib/utils";

const MAX_TREES = 12;

// Eases the displayed number from its previous value to `target` whenever target changes.
function useCountUp(target: number, durationMs = 1100) {
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : durationMs;
    const origin = current.current;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = duration ? Math.min((now - start) / duration, 1) : 1;
      current.current = origin + (target - origin) * (1 - (1 - t) ** 4);
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

export function ImpactPanel({ co2Kg, heading, treesLabel }: { co2Kg: number; heading: string; treesLabel: string }) {
  const kg = useCountUp(co2Kg);
  const trees = treesEquivalent(co2Kg);
  const shownTrees = Math.min(Math.ceil(trees), MAX_TREES);

  return (
    <section className="overflow-hidden rounded-3xl bg-emerald-950 p-6 text-white sm:p-8">
      <h2 className="font-medium text-emerald-200">{heading}</h2>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <p>
          <Leaf className="mb-2 size-5 text-emerald-400" aria-hidden />
          <span className="block text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl" aria-hidden>
            {formatKg(kg)}
          </span>
          <span className="sr-only">{formatKg(co2Kg)}</span>
          <span className="text-sm text-emerald-200">CO2 dihemat</span>
        </p>
        <p>
          <TreePine className="mb-2 size-5 text-emerald-400" aria-hidden />
          <span className="block text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl" aria-hidden>
            {treesEquivalent(kg).toLocaleString("id-ID")}
          </span>
          <span className="sr-only">{trees.toLocaleString("id-ID")}</span>
          <span className="text-sm text-emerald-200">{treesLabel}</span>
        </p>
      </div>

      {/* Trees sprout on a ground line, one per (rounded-up) tree of absorption. */}
      <div className="mt-6 flex h-12 items-end gap-1 border-b-2 border-emerald-700" aria-hidden>
        {Array.from({ length: shownTrees }, (_, i) => (
          <TreePine
            key={i}
            className="size-10 origin-bottom animate-sprout text-emerald-400"
            style={{ animationDelay: `${300 + i * 90}ms` }}
          />
        ))}
        {Math.ceil(trees) > MAX_TREES && (
          <span className="mb-2 ml-2 animate-rise text-sm font-medium text-emerald-200">
            +{Math.ceil(trees) - MAX_TREES}
          </span>
        )}
      </div>
    </section>
  );
}
