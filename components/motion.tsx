import { ViewTransition, type ReactNode } from "react";

const NAV = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

// Slides page content left/right for Links tagged with transitionTypes={["nav-forward" | "nav-back"]}.
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={NAV} exit={NAV} default="none">
      {children}
    </ViewTransition>
  );
}

// The TerraVerde leaf mark drawing itself; strokes use pathLength=1 so the draw keyframe is size-independent.
export function LeafDrawing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" className={className} aria-hidden>
      <path
        pathLength={1}
        className="animate-draw [stroke-dasharray:1]"
        d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
      />
      <path
        pathLength={1}
        className="animate-draw [stroke-dasharray:1] [animation-delay:700ms]"
        d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
      />
    </svg>
  );
}
