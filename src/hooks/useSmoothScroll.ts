import { useEffect, useRef } from "react";
import { useStore } from "../store";

export function useSmoothScroll(
  ref: React.RefObject<HTMLElement | null>,
  lerpFactor: number = 0.18
) {
  const enabled = useStore(s => s.smoothScrollEnabled ?? true);
  const intensity = 0.35;

  const targetScrollTopRef = useRef<number | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const element = ref.current;
    if (!element) return;

    const onWheel = (e: WheelEvent) => {
      // Pass through horizontal swipes and touchpad events
      if (e.deltaX !== 0) return;
      const isTouchpad = Math.abs(e.deltaY) < 5 && e.deltaMode === 0;
      if (isTouchpad) return;

      e.preventDefault();

      const normalizedDelta = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1);

      if (targetScrollTopRef.current === null) {
        targetScrollTopRef.current = element.scrollTop;
      }

      lastScrollTopRef.current = null;

      const maxScroll = element.scrollHeight - element.clientHeight;
      targetScrollTopRef.current = Math.max(
        0,
        Math.min(maxScroll, targetScrollTopRef.current + normalizedDelta * intensity)
      );

      const step = () => {
        if (targetScrollTopRef.current === null) {
          frameIdRef.current = null;
          return;
        }
        const current = element.scrollTop;

        // Bail out if we've hit the scroll boundary
        if (lastScrollTopRef.current !== null && current === lastScrollTopRef.current) {
          targetScrollTopRef.current = null;
          frameIdRef.current = null;
          return;
        }

        lastScrollTopRef.current = current;
        const diff = targetScrollTopRef.current - current;

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
