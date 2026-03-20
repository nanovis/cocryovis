import { useCallback, useEffect, useRef } from "react";

export function useScheduler<K>(update: (updates: K) => void) {
  const frameRequestRef = useRef<number | null>(null);
  const pendingRef = useRef<K | null>(null);

  const flush = useCallback(() => {
    frameRequestRef.current = null;
    if (pendingRef.current === null) {
      return;
    }

    const pendingUpdate = pendingRef.current;
    pendingRef.current = null;
    update(pendingUpdate);
  }, [update]);

  const schedule = useCallback(
    (item: K) => {
      pendingRef.current = item;
      if (frameRequestRef.current !== null) {
        return;
      }
      frameRequestRef.current = window.requestAnimationFrame(flush);
    },
    [flush]
  );

  useEffect(() => {
    return () => {
      if (frameRequestRef.current !== null) {
        window.cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, []);

  return schedule;
}
