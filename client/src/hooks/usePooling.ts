import { useEffect, useRef } from "react";

interface UsePollingOptions {
  immediate?: boolean;
  onError?: (error: unknown) => void;
}

export function usePolling(
  callback: () => Promise<void> | undefined,
  delay: number | null,
  options: UsePollingOptions = {}
) {
  const { immediate = false } = options;
  const savedCallback = useRef(callback);
  const isRunning = useRef(false);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const tick = async () => {
      if (isRunning.current) return;
      isRunning.current = true;
      try {
        await savedCallback.current();
      } catch (error) {
        if (options.onError) {
          options.onError(error);
        }
      } finally {
        isRunning.current = false;
      }
    };

    if (immediate) {
      void tick();
    }

    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay, immediate]);
}
