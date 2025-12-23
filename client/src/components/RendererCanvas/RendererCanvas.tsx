import { useEffect, useRef } from "react";
import useRenderer from "../../hooks/useRenderer.ts";
import { makeStyles } from "@fluentui/react-components";

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

const RendererCanvas = () => {
  const classes = useStyles();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRenderer(canvasRef, (renderer) => {
    renderer.setVertexBuffer(
      new Float32Array([0.0, 0.6, -0.6, -0.6, 0.6, -0.6])
    );
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const { width, height } = entry.contentRect;

      rendererRef.current?.resize(width, height);
    });

    observer.observe(canvas);

    return () => observer.disconnect();
  });

  return (
    <div className={classes.canvasContainer}>
      <canvas ref={canvasRef} className={classes.canvas} />
    </div>
  );
};

export default RendererCanvas;
