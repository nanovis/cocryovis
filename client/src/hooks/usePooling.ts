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
  const savedCallbackRef = useRef(callback);
  const isRunningRef = useRef(false);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    savedCallbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const tick = async () => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;
      try {
        await savedCallbackRef.current();
      } catch (error) {
        if (optionsRef.current.onError) {
          optionsRef.current.onError(error);
        }
      } finally {
        isRunningRef.current = false;
      }
    };

    if (optionsRef.current.immediate) {
      void tick();
    }

    const id = setInterval(() => {
      void tick();
    }, delay);
    return () => clearInterval(id);
  }, [delay]);
}
