import { type RefObject, useEffect, useRef, useTransition } from "react";
import {
  createWebGPURenderer,
  type WebGPURenderer,
} from "../renderer/renderer.ts";

export default function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>
) {
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const [_isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      if (!canvasRef.current) return;
      const renderer = createWebGPURenderer();
      rendererRef.current = renderer;

      await renderer.init(canvasRef.current);
    });

    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [canvasRef]);

  return {
    setVertexBuffer: (data: Float32Array) =>
      rendererRef.current?.setVertexBuffer(data),
  };
}
