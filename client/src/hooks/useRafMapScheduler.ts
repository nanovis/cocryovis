import { useCallback, useEffect, useRef } from "react";

export function useRafMapScheduler<K, V>(
  applyUpdates: (updates: Map<K, V>) => void
) {
  const frameRequestRef = useRef<number | null>(null);
  const pendingRef = useRef(new Map<K, V>());

  const flush = useCallback(() => {
    frameRequestRef.current = null;
    if (pendingRef.current.size === 0) {
      return;
    }

    const updates = pendingRef.current;
    pendingRef.current = new Map();
    applyUpdates(updates);
  }, [applyUpdates]);

  const schedule = useCallback(
    (key: K, value: V) => {
      pendingRef.current.set(key, value);
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
