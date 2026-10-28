// Visual-only cart effects on the Web Animations API. Under reduced motion they skip straight to the result.
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const LEAF = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/></svg>';

function overlay(rect: { left: number; top: number; width: number; height: number }, node: HTMLElement) {
  Object.assign(node.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    zIndex: "60",
    pointerEvents: "none",
  });
  document.body.append(node);
  return node;
}

// Arcs a copy of `source` (the product photo) into the header cart, then calls onLand exactly once.
export function flyToCart(source: Element | null | undefined, onLand: () => void) {
  const target = document.querySelector("[data-cart-target]");
  if (!source || !target || reduced()) return onLand();

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const ghost = overlay(from, source.cloneNode(true) as HTMLElement);
  ghost.style.borderRadius = "1rem";
  ghost.style.overflow = "hidden";
  ghost.style.boxShadow = "0 18px 40px -12px rgb(2 44 34 / 0.45)";

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const end = Math.max(28 / from.width, 0.04);
  const land = () => {
    ghost.remove();
    onLand();
  };
  ghost
    .animate(
      [
        { transform: "translate(0, 0) scale(1)", borderRadius: "1rem" },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(${(1 + end) / 2})`, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(${end})`, opacity: 0.5, borderRadius: "50%" },
      ],
      { duration: 800, easing: "cubic-bezier(0.45, 0, 0.55, 1)" },
    )
    .finished.then(land, land);
}

// A handful of small leaves scatter out of the clicked element.
export function leafBurst(origin: Element) {
  if (reduced()) return;
  const r = origin.getBoundingClientRect();
  const count = 9;
  for (let i = 0; i < count; i++) {
    const leaf = document.createElement("span");
    leaf.innerHTML = LEAF;
    leaf.style.color = i % 3 ? "var(--color-emerald-500)" : "var(--color-lime-400)";
    overlay({ left: r.left + r.width / 2 - 7, top: r.top + r.height / 2 - 7, width: 14, height: 14 }, leaf);

    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const distance = 46 + Math.random() * 34;
    const remove = () => leaf.remove();
    leaf
      .animate(
        [
          { transform: "translate(0, 0) rotate(0deg) scale(0.4)", opacity: 1 },
          {
            transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance + 18}px) rotate(${(Math.random() - 0.5) * 300}deg) scale(1)`,
            opacity: 0,
          },
        ],
        { duration: 700 + Math.random() * 200, easing: EASE },
      )
      .finished.then(remove, remove);
  }
}

// Cart icon wiggle + badge bump, played when a product lands.
export function cartLanded(icon: Element | null, badge: Element | null) {
  if (reduced()) return;
  icon?.animate(
    [{ rotate: "0deg" }, { rotate: "-14deg", scale: "1.15" }, { rotate: "10deg" }, { rotate: "-4deg" }, { rotate: "0deg" }],
    { duration: 550, easing: "ease-out" },
  );
  badge?.animate([{ scale: "1" }, { scale: "1.45" }, { scale: "1" }], { duration: 380, easing: EASE });
}
