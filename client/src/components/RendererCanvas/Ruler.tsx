import { useMst } from "@/stores/RootStore";
import { SVG, type Svg } from "@svgdotjs/svg.js";
import { observer } from "mobx-react-lite";
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { planeBBox, slicePixelSize } from "@/renderer/utilities/math";
import { makeStyles } from "@fluentui/react-components";

const color = "#FFFFFF";

const useStyles = makeStyles({
  container: {
    position: "absolute",
    padding: "inherit",
    inset: 0,
    pointerEvents: "none",
  },
  horizontalRuler: {
    position: "absolute",
    padding: "inherit",
    bottom: 0,
    right: 0,
    left: 0,
  },
  verticalRuler: {
    position: "absolute",
    padding: "inherit",
    top: 0,
    bottom: 0,
    right: 0,
  },
});

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

const Ruler = observer(({ canvasRef }: Props) => {
  const classes = useStyles();

  const horizontalContainerRef = useRef<HTMLDivElement>(null);
  const verticalContainerRef = useRef<HTMLDivElement>(null);
  const horizontalDrawRef = useRef<Svg>(null);
  const verticalDrawRef = useRef<Svg>(null);
  const rootStore = useMst();

  const redrawRuler = useEffectEvent(() => {
    const canvas = canvasRef.current;
    const renderer = rootStore.renderer;
    const horizontalDraw = horizontalDrawRef.current;
    const verticalDraw = verticalDrawRef.current;
    if (!canvas || !renderer || !horizontalDraw || !verticalDraw) return;

    const camera = renderer.camera;

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
    if (!volumeSize) return;

    const invViewProj = camera.getViewProjectionMatrix().inverseViewProjMatrix;

    const pixelSize = slicePixelSize(
      canvas.width,
      canvas.height,
      invViewProj,
      clippingPlaneParams.clippingPlaneOrigin,
      clippingPlaneParams.clippingPlaneNormal,
      [volumeSize.x, volumeSize.y, volumeSize.z]
    );

    redrawHorizontal(
      horizontalDraw,
      boundingBox.width,
      boundingBox.x,
      pixelSize?.pixelSizeX ?? 0
    );
    redrawVertical(
      verticalDraw,
      boundingBox.height,
      boundingBox.y,
      pixelSize?.pixelSizeY ?? 0
    );
  });

  useEffect(() => {
    if (!horizontalContainerRef.current) return;

    horizontalDrawRef.current = SVG()
      .addTo(horizontalContainerRef.current)
      .size("100%", 20);

    return () => {
      horizontalDrawRef.current?.remove();
      horizontalDrawRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!verticalContainerRef.current) return;

    verticalDrawRef.current = SVG()
      .addTo(verticalContainerRef.current)
      .size(20, "100%");

    return () => {
      verticalDrawRef.current?.remove();
      verticalDrawRef.current = null;
    };
  }, []);

  useEffect(() => {
    const renderer = rootStore.renderer;
    const canvas = canvasRef.current;

    if (!canvas || !renderer) return;

    const unsubscribeCamera = renderer.camera.observable.observe(redrawRuler);
    const unsubscribeClip =
      renderer.clippingPlaneManager.clippingParametersBuffer.observable.observe(
        redrawRuler
      );

    return () => {
      unsubscribeCamera();
      unsubscribeClip();
    };
  }, [rootStore.renderer, canvasRef]);

  return (
    <div className={classes.container}>
      <div ref={horizontalContainerRef} className={classes.horizontalRuler} />
      <div ref={verticalContainerRef} className={classes.verticalRuler} />
    </div>
  );
});

function redrawHorizontal(
  svg: Svg,
  width: number,
  offset: number,
  mmPerPixel: number
) {
  svg.clear();

  const tickSpacing = 10;
  const ticks = Math.floor(width / tickSpacing);

  for (let i = 0; i < ticks; i++) {
    const x = i * tickSpacing + offset;

    svg
      .line(x, 20, x, i % 10 === 0 ? 0 : 10)
      .stroke({ width: 1, color: color });
  }
  svg
    .text(`${(width * mmPerPixel).toFixed(1)} mm`)
    .font({ size: 12, family: "Arial", anchor: "end" })
    .fill(color)
    .move(offset + width - 5, 0);
}

function redrawVertical(
  svg: Svg,
  height: number,
  offset: number,
  mmPerPixel: number
) {
  svg.clear();

  const tickSpacing = 10;
  const ticks = Math.floor(height / tickSpacing);

  for (let i = 0; i < ticks; i++) {
    const y = i * tickSpacing + offset;

    svg
      .line(20, y, i % 10 === 0 ? 0 : 10, y)
      .stroke({ width: 1, color: color });
  }
  svg
    .text(`${(height * mmPerPixel).toFixed(1)} mm`)
    .font({ size: 12, family: "Arial", anchor: "end" })
    .fill(color)
    .move(0, offset + height - 5);
}

export default Ruler;
