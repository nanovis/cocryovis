import { useMst } from "@/stores/RootStore";
import { SVG, type G, type Svg } from "@svgdotjs/svg.js";
import { observer } from "mobx-react-lite";
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import {
  computeSliceScreenBounds,
  computeVisibleDimensions,
} from "@/renderer/utilities/math";
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

  const scheduleRef = useRef<number | null>(null);

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

    const ratio = renderer.volumeManager.getRatio();
    if (!ratio) return;

    const { viewProjMatrix } = camera.getViewProjectionMatrix();

    const boundingBox = computeSliceScreenBounds(
      viewProjMatrix,
      canvas.width,
      canvas.height,
      clippingPlaneParams.clippingPlaneOrigin,
      clippingPlaneParams.clippingPlaneNormal,
      [ratio.x, ratio.y, ratio.z]
    );

    if (
      !boundingBox.right ||
      !boundingBox.left ||
      !boundingBox.top ||
      !boundingBox.bottom
    ) {
      horizontalDraw.clear();
      verticalDraw.clear();
      return;
    }

    const volumeSize = renderer.volumeManager.getScaledPhysicalSize();
    if (!volumeSize) return;

    const unit = renderer.volumeManager.getUnits();
    if (!unit) return;

    const { viewMatrix } = camera.getViewMatrix();
    const projectionMatrix = camera.getProjectionMatrix();

    const { width, height } = computeVisibleDimensions(
      boundingBox.left,
      boundingBox.right,
      boundingBox.top,
      boundingBox.bottom,
      viewMatrix,
      projectionMatrix,
      [volumeSize.x, volumeSize.y, volumeSize.z]
    );

    redrawHorizontal(
      horizontalDraw,
      boundingBox.width,
      boundingBox.x,
      canvas.width,
      width,
      unit
    );
    redrawVertical(
      verticalDraw,
      boundingBox.height,
      boundingBox.y,
      canvas.height,
      height,
      unit
    );
  });

  const scheduleRedraw = useEffectEvent(() => {
    if (scheduleRef.current !== null) return;

    scheduleRef.current = requestAnimationFrame(() => {
      scheduleRef.current = null;
      redrawRuler();
    });
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

    const unsubscribes: Array<() => boolean> = [];

    unsubscribes.push(renderer.camera.observable.observe(scheduleRedraw));
    unsubscribes.push(
      renderer.clippingPlaneManager.clippingParametersBuffer.observable.observe(
        scheduleRedraw
      )
    );
    unsubscribes.push(
      renderer.volumeManager.observableSettings.observe(scheduleRedraw)
    );

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [rootStore.renderer, canvasRef]);

  useEffect(() => {
    return () => {
      if (scheduleRef.current !== null) {
        cancelAnimationFrame(scheduleRef.current);
      }
    };
  }, []);

  return (
    <div className={classes.container}>
      <div ref={horizontalContainerRef} className={classes.horizontalRuler} />
      <div ref={verticalContainerRef} className={classes.verticalRuler} />
    </div>
  );
});

function outlinedLine(
  draw: Svg,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: {
    color: string;
    width: number;
    borderColor: string;
    borderWidth: number;
    linecap?: "butt" | "round" | "square";
  }
): G {
  const g = draw.group();

  const linecap = options.linecap ?? "butt";

  g.line(x1, y1, x2, y2).stroke({
    color: options.borderColor,
    width: options.width + options.borderWidth * 2,
    linecap,
  });

  g.line(x1, y1, x2, y2).stroke({
    color: options.color,
    width: options.width,
    linecap,
  });

  return g;
}

function redrawHorizontal(
  svg: Svg,
  width: number,
  offset: number,
  containerWidth: number,
  widthInUnits: number,
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

    outlinedLine(
      svg,
      x,
      config.barHeight,
      x,
      i % 10 === 0 ? majorTickEnd : minorTickEnd,
      {
        color: i === 0 ? config.startEndColor : config.color,
        width: 1,
        borderColor: "#000",
        borderWidth: 1,
        linecap: "round",
      }
    );
  }

  outlinedLine(
    svg,
    offset + width,
    config.barHeight,
    offset + width,
    majorTickEnd,
    {
      color: config.startEndColor,
      width: 1,
      borderColor: "#000",
      borderWidth: 1,
      linecap: "round",
    }
  );

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

  svg
    .text(`${widthInUnits.toFixed(1)} ${unit}`)
    .font({ size: config.fontSize, family: "Arial", anchor: "end" })
    .fill(config.color)
    .stroke({
      color: "#000",
      width: 2,
    })
    .attr({
      "paint-order": "stroke",
    })
    .move(textPosition.x, textPosition.y);
}

function redrawVertical(
  svg: Svg,
  height: number,
  offset: number,
  containerHeight: number,
  heightInUnits: number,
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
    outlinedLine(
      svg,
      config.barHeight,
      y,
      i % 10 === 0 ? majorTickEnd : minorTickEnd,
      y,
      {
        color: i === 0 ? config.startEndColor : config.color,
        width: 1,
        borderColor: "#000",
        borderWidth: 1,
        linecap: "round",
      }
    );
  }

  outlinedLine(
    svg,
    config.barHeight,
    offset + height,
    majorTickEnd,
    offset + height,
    {
      color: config.startEndColor,
      width: 1,
      borderColor: "#000",
      borderWidth: 1,
      linecap: "round",
    }
  );

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
    .text(`${heightInUnits.toFixed(1)} ${unit}`)
    .css("text-anchor", "end")
    .font({ size: config.fontSize, family: "Arial", anchor: "end" })
    .fill(config.color)
    .stroke({
      color: "#000",
      width: 2,
    })
    .attr({
      "paint-order": "stroke",
    })
    .attr({ x: textPosition.x, y: textPosition.y });
}

export default Ruler;
