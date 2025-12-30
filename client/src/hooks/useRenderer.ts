import { type RefObject, useEffect, useRef, useTransition } from "react";
import {
  initializeDevice,
  type RendererCameraParameters,
  VolumeRenderer,
} from "../renderer/renderer.ts";
import { vec3 } from "gl-matrix";
import type { RenderingParameters } from "@/renderer/renderingParametersBuffer";
import { CONFIG } from "../Constants";

const defaultCameraParameters: RendererCameraParameters = {
  position: vec3.fromValues(0, 0, -3),
  viewCenter: vec3.fromValues(0, 0, 0),
  up: vec3.fromValues(0, 1, 0),
  fovY: 45,
  near: 0.01,
  far: 100,
} as const;

export default function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  {
    parameters,
    cameraParameters,
    onReady,
  }: {
    parameters?: Partial<RenderingParameters>;
    cameraParameters?: Partial<RendererCameraParameters>;
    onReady?: (renderer: VolumeRenderer) => void;
  }
) {
  const rendererRef = useRef<VolumeRenderer | null>(null);
  const onReadyRef = useRef<typeof onReady>(onReady);
  const [_isPending, startTransition] = useTransition();

  useEffect(() => {
    let destroyed = false;
    startTransition(async () => {
      if (!canvasRef.current || destroyed) return;
      const deviceInfo = await initializeDevice(canvasRef.current);
      const rendererCameraParameters: RendererCameraParameters = {
        ...defaultCameraParameters,
        ...cameraParameters,
      };
      const renderer = new VolumeRenderer(
        deviceInfo.device,
        rendererCameraParameters,
        {
          context: deviceInfo.context,
          parameters: parameters,
          forceWriteOnlyAnnotations: CONFIG.forceWriteOnlyAnnotations,
        }
      );
      rendererRef.current = renderer;
      onReadyRef.current?.(renderer);
    });

    return () => {
      destroyed = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, [canvasRef]); // eslint-disable-line react-hooks/exhaustive-deps

  return rendererRef;
}
