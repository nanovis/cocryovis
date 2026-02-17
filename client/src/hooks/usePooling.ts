import { useEffect, useRef } from "react";

interface UsePollingOptions {
  immediate?: boolean;
  onError?: (error: unknown) => void;
}

export function usePolling(
  callback: () => void | Promise<void>,
  delay: number | null,
  options: UsePollingOptions = {}
) {
  const optionsRef = useRef(options);
  const savedCallback = useRef(callback);
  const isRunning = useRef(false);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

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
        if (optionsRef.current.onError) {
          optionsRef.current.onError(error);
        }
      } finally {
        isRunning.current = false;
      }
    };

    if (optionsRef.current.immediate) {
      void tick();
    }

    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}
