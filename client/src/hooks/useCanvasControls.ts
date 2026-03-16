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
  onMove?: (normalizedX: number, normalizedY: number) => void;
  syncToFrame?: boolean;
}

export function useCanvasControls({
  canvasRef,
  onDrag,
  onWheel,
  onMove,
  syncToFrame = true,
}: Props) {
  const isPrimaryDownRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return;
      isPrimaryDownRef.current = true;
    },
    []
  );

  const handleMouseUp = useCallback((event: MouseEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    isPrimaryDownRef.current = false;
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const { offsetX, offsetY } = event.nativeEvent;

      const x = offsetX / canvas.width;
      const y = offsetY / canvas.height;

      onMove?.(x, y);

      if (!isPrimaryDownRef.current) return;

      if (!syncToFrame) return onDrag(x, y);

      lastPosRef.current = {
        x: x,
        y: y,
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
    [canvasRef, onDrag, onMove, syncToFrame]
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
