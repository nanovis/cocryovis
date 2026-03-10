import { useMst } from "@/stores/RootStore";
import { SVG, type Svg } from "@svgdotjs/svg.js";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, type RefObject } from "react";
import { mat4 } from "gl-matrix";
import { planeBBox, slicePixelSize } from "@/renderer/utilities/math";

const color = "#FFFFFF";

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

const Ruler = observer(({ canvasRef }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<Svg>(null);
  const { renderer } = useMst();

  const canvas = canvasRef.current;

  useEffect(() => {
    if (!canvas || !containerRef.current || !renderer) return;

    const container = containerRef.current;

    drawRef.current = SVG().addTo(container).size("100%", 20);

    const unsubscribe = renderer.camera.observe((camera) => {
      const clippingPlaneParams =
        renderer.clippingPlaneManager.clippingParametersBuffer.params;
      const boundingBox = planeBBox(
        camera,
        canvas.width,
        canvas.height,
        clippingPlaneParams.clippingPlaneOrigin,
        clippingPlaneParams.clippingPlaneNormal
      );
      const volumeSize = renderer.volumeManager.computedPhysicalSize();
      if (!volumeSize) {
        return;
      }

      const projectionMatrix = camera.getProjectionMatrix();
      const viewMatrix = camera.getViewMatrix().viewMatrix;
      const viewProj = mat4.create();
      mat4.multiply(viewProj, projectionMatrix, viewMatrix);
      const invViewProj = mat4.invert(mat4.create(), viewProj);
      if (!invViewProj) {
        console.warn("Failed to invert view-projection matrix");
        return;
      }

      const pixelSize = slicePixelSize(
        canvas.width,
        canvas.height,
        invViewProj,
        clippingPlaneParams.clippingPlaneOrigin,
        clippingPlaneParams.clippingPlaneNormal,
        [volumeSize.x, volumeSize.y, volumeSize.z]
      );

      redraw(boundingBox.width, boundingBox.x, pixelSize?.pixelSizeX ?? 0);
    });

    // const observer = new ResizeObserver((entries) => {
    //   const entry = entries[0];

    //   // let width = entry.contentRect.width;
    //   // const height = entry.contentRect.height;

    //   // const minAxis = Math.min(width, height);
    //   // const widthOffset = (width - minAxis) / 2;
    //   // width = minAxis;

    //   // const test = getPixelsPerWorldUnit(renderer.camera, canvas);
    //   // console.log(test);

    //   // console.log(bbox(renderer.camera, canvas));

    //   const boundingBox = bbox(renderer.camera, canvas);

    //   redraw(boundingBox.width, boundingBox.x);
    // });

    // observer.observe(canvas);

    return () => {
      unsubscribe();
      // observer.disconnect();
      drawRef.current?.remove();
    };
  }, [canvas, renderer]);

  function redraw(width: number, offset: number, mmPerPixel: number) {
    if (!drawRef.current) {
      return;
    }
    const draw = drawRef.current;

    draw.clear();

    const tickSpacing = 10;
    const ticks = Math.floor(width / tickSpacing);

    for (let i = 0; i < ticks; i++) {
      const x = i * tickSpacing + offset;

      draw
        .line(x, 20, x, i % 10 === 0 ? 0 : 10)
        .stroke({ width: 1, color: color });
    }
    // Draw number at the end
    draw
      .text(`${(width * mmPerPixel).toFixed(1)} mm`)
      .font({ size: 12, family: "Arial", anchor: "end" })
      .fill(color)
      .move(offset + width - 5, 0);
  }

  return <div ref={containerRef} />;
});

export default Ruler;
