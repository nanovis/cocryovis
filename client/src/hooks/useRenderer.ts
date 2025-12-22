import { type RefObject, useEffect, useRef, useTransition } from "react";
import { initializeDevice, VolumeRenderer } from "../renderer/renderer.ts";

export default function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>
) {
  const rendererRef = useRef<VolumeRenderer | null>(null);
  const [_isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      if (!canvasRef.current) return;
      const deviceInfo = await initializeDevice(canvasRef.current);
      rendererRef.current = new VolumeRenderer(deviceInfo.device, {
        context: deviceInfo.context,
      });
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
