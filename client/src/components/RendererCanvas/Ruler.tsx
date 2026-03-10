import { useMst } from "@/stores/RootStore";
import { SVG, type Svg } from "@svgdotjs/svg.js";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, type RefObject } from "react";
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

      const invViewProj =
        camera.getViewProjectionMatrix().inverseViewProjMatrix;

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

    return () => {
      unsubscribe();
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
    draw
      .text(`${(width * mmPerPixel).toFixed(1)} mm`)
      .font({ size: 12, family: "Arial", anchor: "end" })
      .fill(color)
      .move(offset + width - 5, 0);
  }

  return <div ref={containerRef} />;
});

export default Ruler;
