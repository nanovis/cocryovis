import { type RefObject, useEffect, useRef, useTransition } from "react";
import { initializeDevice, VolumeRenderer } from "../renderer/renderer.ts";

export default function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onReady?: (renderer: VolumeRenderer) => void
) {
  const rendererRef = useRef<VolumeRenderer | null>(null);
  const onReadyRef = useRef<typeof onReady>(onReady);
  const [_isPending, startTransition] = useTransition();

  useEffect(() => {
    let destroyed = false;
    startTransition(async () => {
      if (!canvasRef.current || destroyed) return;
      const deviceInfo = await initializeDevice(canvasRef.current);
      const renderer = new VolumeRenderer(deviceInfo.device, {
        context: deviceInfo.context,
      });
      rendererRef.current = renderer;
      onReadyRef.current?.(renderer);
    });

    return () => {
      destroyed = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [canvasRef]);

  return rendererRef;
}
