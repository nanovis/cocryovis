import { useEffect, useRef } from "react";
import useRenderer from "../../hooks/useRenderer.ts";

const RendererCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setVertexBuffer } = useRenderer(canvasRef);

  useEffect(() => {
    setVertexBuffer(new Float32Array([0.0, 0.6, -0.6, -0.6, 0.6, -0.6]));
  }, [setVertexBuffer]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ width: "800px", height: "600px" }}
    />
  );
};

export default RendererCanvas;
