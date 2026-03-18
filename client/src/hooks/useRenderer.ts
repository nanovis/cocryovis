import {
  type RefObject,
  useEffect,
  useRef,
  useTransition,
  useState,
} from "react";
import {
  obtainContext,
  obtainDevice,
  type RendererCameraParameters,
  VolumeRenderer,
} from "@/renderer/renderer";
import { vec3 } from "gl-matrix";
import type { RenderingParameters } from "@/renderer/renderingParametersBuffer";
import { CONFIG } from "@/constants";

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
    clearColor,
    parameters,
    cameraParameters,
    onReady,
  }: {
    clearColor?: GPUColor;
    parameters?: Partial<RenderingParameters>;
    cameraParameters?: Partial<RendererCameraParameters>;
    onReady?: (renderer: VolumeRenderer) => void;
  }
) {
  const rendererRef = useRef<VolumeRenderer | null>(null);
  const onReadyRef = useRef<typeof onReady>(onReady);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let destroyed = false;
    startTransition(async () => {
      try {
        if (!canvasRef.current || destroyed) return;
        const deviceInfo = await obtainDevice();
        const context = obtainContext(deviceInfo.device, canvasRef.current);

        const rendererCameraParameters: RendererCameraParameters = {
          ...defaultCameraParameters,
          ...cameraParameters,
        };
        const renderer = new VolumeRenderer(
          deviceInfo.device,
          rendererCameraParameters,
          {
            clearColor: clearColor,
            context: context,
            parameters: parameters,
            forceWriteOnlyAnnotations: CONFIG.forceWriteOnlyAnnotations,
          }
        );
        rendererRef.current = renderer;
        onReadyRef.current?.(renderer);
      } catch (e) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError(`Error while initializing renderer: ${e}`);
        }
      }
    });

    return () => {
      destroyed = true;
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [canvasRef]);

  return {
    rendererRef,
    isPending,
    error,
  };
}
