// Shared motion policy for the hero art and the dust effects.
//
// Everything animates unless the visitor has paused it. When the operating system asks for
// reduced motion, the effects run in a calmer form (slower, fewer particles, no flying tile
// bursts) instead of stopping, because some systems (Windows with animations switched off for
// performance, remote desktops, battery saver) report that setting without the visitor having
// chosen it. A visible Pause/Play button lets anyone stop the motion, and the choice is kept.
const KEY = "cronoverse-motion";

const listeners = new Set<() => void>();

function saved(): boolean {
  try {
    return localStorage.getItem(KEY) === "paused";
  } catch {
    return false;
  }
}

// Read once when the browser loads this module, before any effect starts. Storage can be
// blocked, in which case the choice simply applies to the current page.
let paused = typeof window !== "undefined" ? saved() : false;

export const isMotionPaused = () => paused;

/** True when the system asks for reduced motion; effects then run gently. */
export const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function setMotionPaused(next: boolean, remember = false) {
  if (remember) {
    try {
      localStorage.setItem(KEY, next ? "paused" : "playing");
    } catch {
      // The choice still applies to this page.
    }
  }
  if (next === paused) return;
  paused = next;
  for (const listener of listeners) listener();
}

export function onMotionChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
