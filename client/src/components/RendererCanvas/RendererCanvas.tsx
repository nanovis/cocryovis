import { useEffect, useRef } from "react";
import useRenderer from "../../hooks/useRenderer.ts";
import { makeStyles } from "@fluentui/react-components";
import { observer } from "mobx-react-lite";
import { useMst } from "../../stores/RootStore.ts";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRenderer(canvasRef, (renderer) => {
    rootStore.setRenderer(renderer);
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
  });

  return (
    <div className={classes.canvasContainer}>
      <canvas ref={canvasRef} className={classes.canvas} />
    </div>
  );
});

export default RendererCanvas;
