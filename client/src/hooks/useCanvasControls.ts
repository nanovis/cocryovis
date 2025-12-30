import { useCallback, useRef, type WheelEvent } from "react";

interface Props {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onDrag: (normalizedX: number, normalizedY: number) => void;
  onWheel?: (direction: number, event: WheelEvent<HTMLCanvasElement>) => void;
}

export function useCanvasControls({ canvasRef, onDrag, onWheel }: Props) {
  const isPrimaryDown = useRef(false);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return;
      isPrimaryDown.current = true;
    },
    []
  );

  const handleMouseUp = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) return;
      isPrimaryDown.current = false;
    },
    []
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isPrimaryDown.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const { offsetX, offsetY } = event.nativeEvent;

      const x = offsetX / canvas.width;
      const y = offsetY / canvas.height;

      onDrag(x, y);
    },
    [canvasRef, onDrag]
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLCanvasElement>) => {
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
