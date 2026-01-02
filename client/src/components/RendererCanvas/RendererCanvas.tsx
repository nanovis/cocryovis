import { useEffect, useRef } from "react";
import useRenderer from "../../hooks/useRenderer";
import { makeStyles } from "@fluentui/react-components";
import { observer } from "mobx-react-lite";
import { useMst } from "@/stores/RootStore";
import { CONFIG } from "@/constants";
import { OrbitCameraController } from "@/utils/orbitCameraController";
import { useCanvasControls } from "@/hooks/useCanvasControls";

const useStyles = makeStyles({
  canvasContainer: {
    width: "100%",
    height: "100%",
  },
  canvas: {
    width: "100%",
    height: "100%",
    display: "block",
  },
});

const RendererCanvas = observer(() => {
  const rootStore = useMst();

  const classes = useStyles();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const rendererRef = useRenderer(canvasRef, {
    parameters: rootStore.uiState.renderSettings.getRendererParameters(),
    cameraParameters: rootStore.uiState.renderSettings.getCameraParameters(),
    onReady: (renderer) => {
      if (!canvasRef.current) {
        return;
      }
      rootStore.setRenderer(renderer);
      rootStore.setOrbitCameraController(
        new OrbitCameraController(renderer.camera, canvasRef.current, 3)
      );
    },
  });

  const canvasControls = useCanvasControls({
    canvasRef,
    onDrag: (x, y) => {
      if (!rootStore.uiState.visualizedVolume) return;
      rootStore.renderer?.annotationManager.processAnnotation(
        x,
        y,
        !rootStore.uiState.visualizedVolume.eraseMode,
        rootStore.uiState.visualizedVolume.manualLabelIndex
      );
    },
    onWheel: (direction, event) => {
      if (!event.shiftKey) return;
      rootStore.uiState.visualizedVolume?.changeClippingPlaneOffset(
        direction * CONFIG.clippingPlaneScrollSpeed
      );
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      let { width, height } = entry.contentRect;
      width = Math.round(width);
      height = Math.round(height);

      canvas.width = width;
      canvas.height = height;

      rendererRef.current?.resize(width, height);
    });

    observer.observe(canvas);

    return () => {
      observer.disconnect();
    };
  }, [rendererRef]);

  return (
    <div className={classes.canvasContainer}>
      <canvas ref={canvasRef} className={classes.canvas} {...canvasControls} />
    </div>
  );
});

export default RendererCanvas;
