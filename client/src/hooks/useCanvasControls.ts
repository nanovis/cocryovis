import {
  useCallback,
  useRef,
  type WheelEvent,
  type MouseEvent,
  type RefObject,
} from "react";

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onDrag: (normalizedX: number, normalizedY: number) => void;
  onWheel?: (direction: number, event: WheelEvent<HTMLCanvasElement>) => void;
  syncToFrame?: boolean;
}

export function useCanvasControls({
  canvasRef,
  onDrag,
  onWheel,
  syncToFrame = true,
}: Props) {
  const isPrimaryDown = useRef(false);
  const frameRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return;
      isPrimaryDown.current = true;
    },
    []
  );

  const handleMouseUp = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    isPrimaryDown.current = false;
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (!isPrimaryDown.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const { offsetX, offsetY } = event.nativeEvent;

      if (!syncToFrame)
        return onDrag(offsetX / canvas.width, offsetY / canvas.height);

      lastPosRef.current = {
        x: offsetX / canvas.width,
        y: offsetY / canvas.height,
      };

      if (frameRef.current == null) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = null;

          const pos = lastPosRef.current;
          if (!pos) return;

          onDrag(pos.x, pos.y);
        });
      }
    },
    [canvasRef, onDrag, syncToFrame]
  );

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLCanvasElement>) => {
      if (!onWheel) return;

      const direction = event.deltaY < 0 ? 1 : -1;
      onWheel(direction, event);
    },
    [onWheel]
  );

  return {
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onWheel: handleWheel,
  };
}
