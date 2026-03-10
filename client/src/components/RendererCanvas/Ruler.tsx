import { useMst } from "@/stores/RootStore";
import { SVG, type Svg } from "@svgdotjs/svg.js";
import { observer } from "mobx-react-lite";
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { planeBBox, slicePixelSize } from "@/renderer/utilities/math";
import { makeStyles } from "@fluentui/react-components";

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

const config = {
  barHeight: 100,
  tickSpacing: 10,
  color: "#FFFFFF",
  startEndColor: "#FF0000",
  fontSize: 14,
  minorTickHeight: 10,
  majorTickHeight: 20,
  horizontalTextOffset: 20,
  verticalTextOffset: 10,
} as const;

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

    const clippingPlaneType =
      renderer.clippingPlaneManager.getClippingPlaneType();

    if (clippingPlaneType !== "view-aligned") {
      horizontalDraw.clear();
      verticalDraw.clear();
      return;
    }

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

    const unit = renderer.volumeManager.getUnits();
    if (!unit) return;

    redrawHorizontal(
      horizontalDraw,
      boundingBox.width,
      boundingBox.x,
      canvas.width,
      pixelSize?.pixelSizeX ?? 0,
      unit
    );
    redrawVertical(
      verticalDraw,
      boundingBox.height,
      boundingBox.y,
      canvas.height,
      pixelSize?.pixelSizeY ?? 0,
      unit
    );
  });

  useEffect(() => {
    if (!horizontalContainerRef.current) return;

    horizontalDrawRef.current = SVG()
      .addTo(horizontalContainerRef.current)
      .size("100%", config.barHeight);

    return () => {
      horizontalDrawRef.current?.remove();
      horizontalDrawRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!verticalContainerRef.current) return;

    verticalDrawRef.current = SVG()
      .addTo(verticalContainerRef.current)
      .size(config.barHeight, "100%");

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
  containerWidth: number,
  unitsPerPixel: number,
  unit: string
) {
  svg.clear();
  offset = Math.max(offset, 0);
  width = Math.min(width, containerWidth - offset);

  const ticks = Math.floor(width / config.tickSpacing);
  const minorTickEnd = config.barHeight - config.minorTickHeight;
  const majorTickEnd = config.barHeight - config.majorTickHeight;

  for (let i = 0; i < ticks; i++) {
    const x = i * config.tickSpacing + offset;

    svg
      .line(x, config.barHeight, x, i % 10 === 0 ? majorTickEnd : minorTickEnd)
      .stroke({
        width: 1,
        color: i === 0 ? config.startEndColor : config.color,
      });
  }
  svg
    .line(offset + width, config.barHeight, offset + width, majorTickEnd)
    .stroke({ width: 1, color: config.startEndColor });

  const textPosition =
    offset + width > containerWidth - 120
      ? {
          x: offset + width - 120,
          y: config.barHeight - config.horizontalTextOffset - 20,
        }
      : {
          x: offset + width + 10,
          y: config.barHeight - config.horizontalTextOffset,
        };

  console.log(textPosition);
  svg
    .text(`${(width * unitsPerPixel).toFixed(1)} ${unit}`)
    .font({ size: config.fontSize, family: "Arial", anchor: "end" })
    .fill(config.color)
    .move(textPosition.x, textPosition.y);
}

function redrawVertical(
  svg: Svg,
  height: number,
  offset: number,
  containerHeight: number,
  unitsPerPixel: number,
  unit: string
) {
  svg.clear();
  offset = Math.max(offset, 0);
  height = Math.min(height, containerHeight - offset);

  const ticks = Math.floor(height / config.tickSpacing);
  const minorTickEnd = config.barHeight - config.minorTickHeight;
  const majorTickEnd = config.barHeight - config.majorTickHeight;

  for (let i = 0; i < ticks; i++) {
    const y = i * config.tickSpacing + offset;

    svg
      .line(config.barHeight, y, i % 10 === 0 ? majorTickEnd : minorTickEnd, y)
      .stroke({
        width: 1,
        color: i === 0 ? config.startEndColor : config.color,
      });
  }
  svg
    .line(config.barHeight, offset + height, majorTickEnd, offset + height)
    .stroke({ width: 1, color: config.startEndColor });

  const textPosition =
    offset + height > containerHeight - 120
      ? {
          y: offset + height - 120,
          x: config.barHeight - config.verticalTextOffset - 20,
        }
      : {
          y: offset + height + 20,
          x: config.barHeight - config.verticalTextOffset,
        };

  svg
    .text(`${(height * unitsPerPixel).toFixed(1)} ${unit}`)
    .css("text-anchor", "end")
    .font({ size: config.fontSize, family: "Arial", anchor: "end" })
    .fill(config.color)
    .attr({ x: textPosition.x, y: textPosition.y });
}

export default Ruler;
