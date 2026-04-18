import { useEffect, useState } from "react";

/**
 * Animates a numeric value from 0 up to `target` over `duration` ms, using a
 * cubic ease-out curve. Returns the current interpolated integer. Pass
 * trigger=false to suppress animation (e.g. when data hasn't loaded).
 *
 * Used on Dashboard and the per-app detail page for the overview-card counts.
 */
export function useCountUp(target: number, duration = 700, trigger = true): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const raf = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, duration, trigger]);
  return value;
}
