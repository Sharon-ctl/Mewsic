import { useEffect, useRef } from "react";
import { useStore } from "../store";

export function useSmoothScroll(
  ref: React.RefObject<HTMLElement | null>,
  lerpFactor: number = 0.18
) {
  const enabled = useStore((s) => s.smoothScrollEnabled ?? true);
  const intensity = 0.35;

  const targetScrollTopRef = useRef<number | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const element = ref.current;
    if (!element) return;

    const onWheel = (e: WheelEvent) => {
      // Allow natural scrolling for horizontal swipes or touchpads
      if (e.deltaX !== 0) return;
      
      // Touchpads usually emit small deltaY values per event
      // If deltaY is small and not a multiple of typical mouse wheel clicks,
      // let the browser handle it natively.
      const isTouchpad = Math.abs(e.deltaY) < 25 && e.deltaMode === 0;
      if (isTouchpad) return;

      e.preventDefault();

      // Normalize delta based on deltaMode
      const normalizedDelta = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1);

      if (targetScrollTopRef.current === null) {
        targetScrollTopRef.current = element.scrollTop;
      }

      // Reset the tracking ref since a new wheel event has occurred
      lastScrollTopRef.current = null;

      const maxScroll = element.scrollHeight - element.clientHeight;
      // Accumulate target scroll offset with a capped boost to keep it responsive
      targetScrollTopRef.current = Math.max(
        0,
        minScrollLimit(maxScroll, targetScrollTopRef.current + normalizedDelta * intensity)
      );

      const step = () => {
        if (targetScrollTopRef.current === null) {
          frameIdRef.current = null;
          return;
        }
        const current = element.scrollTop;

        // If the scroll position didn't change at all compared to the last frame,
        // we've hit the physical scroll bounds (or the container is hidden/unscrollable).
        // Terminate the animation frame loop to save CPU.
        if (lastScrollTopRef.current !== null && current === lastScrollTopRef.current) {
          targetScrollTopRef.current = null;
          frameIdRef.current = null;
          return;
        }

        lastScrollTopRef.current = current;
        const diff = targetScrollTopRef.current - current;

        // Snapping threshold
        if (Math.abs(diff) < 0.5) {
          element.scrollTop = targetScrollTopRef.current;
          targetScrollTopRef.current = null;
          frameIdRef.current = null;
        } else {
          element.scrollTop = current + diff * lerpFactor;
          frameIdRef.current = requestAnimationFrame(step);
        }
      };

      if (frameIdRef.current === null) {
        frameIdRef.current = requestAnimationFrame(step);
      }
    };

    // Helper helper function to bound scrolling
    function minScrollLimit(max: number, target: number) {
      return Math.min(max, target);
    }

    element.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", onWheel);
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      targetScrollTopRef.current = null;
      lastScrollTopRef.current = null;
    };
  }, [ref, enabled, intensity, lerpFactor]);
}
