import { useMst } from "@/stores/RootStore";
import { SVG, type Container, type Svg } from "@svgdotjs/svg.js";
import { observer } from "mobx-react-lite";
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { makeStyles } from "@fluentui/react-components";
import { mat4, vec3, vec4 } from "gl-matrix";
import { projectWorldToPixel, unprojectPixel } from "@/renderer/utilities/math";

const useStyles = makeStyles({
  container: {
    position: "absolute",
    padding: "inherit",
    inset: 0,
    pointerEvents: "none",
  },
});

const config = {
  color: "#FFFFFF",
} as const;

interface Circle3D {
  center: vec3;
  u: vec3;
  v: vec3;
}

interface Props {
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

const AnnotationMarker = observer(({ canvasRef }: Props) => {
  const classes = useStyles();

  const containerRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<Svg>(null);

  const scheduleRef = useRef<number | null>(null);

  const rootStore = useMst();

  const redrawMarker = useEffectEvent(() => {
    const canvas = canvasRef.current;
    const renderer = rootStore.renderer;
    const draw = drawRef.current;
    if (!canvas || !renderer || !draw) return;

    const camera = renderer.camera;
    const clippingPlaneManager = renderer.clippingPlaneManager;

    const normal =
      clippingPlaneManager.clippingParametersBuffer.params.clippingPlaneNormal;

    const { viewMatrix } = camera.getViewMatrix();
    const projMatrix = camera.getProjectionMatrix();
    const { inverseViewProjMatrix } = camera.getViewProjectionMatrix();

    const circle = circleFromScreenWithNormalFast(
      canvas.width / 2,
      canvas.height / 2,
      20,
      0.5,
      normal,
      viewMatrix,
      projMatrix,
      inverseViewProjMatrix,
      canvas.width,
      canvas.height
    );

    console.log(circle.center, circle.u, circle.v);

    draw.clear();

    drawProjectedCircle(
      draw,
      viewMatrix,
      projMatrix,
      circle,
      canvas.width,
      canvas.height
    );
  });

  const scheduleRedraw = useEffectEvent(() => {
    if (scheduleRef.current !== null) return;

    scheduleRef.current = requestAnimationFrame(() => {
      scheduleRef.current = null;
      redrawMarker();
    });
  });

  useEffect(() => {
    if (!containerRef.current) return;

    drawRef.current = SVG().addTo(containerRef.current).size("100%", "100%");

    return () => {
      drawRef.current?.remove();
      drawRef.current = null;
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
    // unsubscribes.push(
    //   renderer.volumeManager.observableSettings.observe(scheduleRedraw)
    // );

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

  return <div ref={containerRef} className={classes.container} />;
});

// function makeCircle(center: vec3, normal: vec3, radius: number): Circle3D {
//   const u = vec3.create();
//   const v = vec3.create();

//   const tmp =
//     Math.abs(normal[0]) < 0.9
//       ? vec3.fromValues(1, 0, 0)
//       : vec3.fromValues(0, 1, 0);

//   vec3.cross(u, normal, tmp);
//   vec3.normalize(u, u);
//   vec3.scale(u, u, radius);

//   vec3.cross(v, normal, u);
//   vec3.normalize(v, v);
//   vec3.scale(v, v, radius);

//   return { center, u, v };
// }

// function circleFromScreen(
//   cx: number,
//   cy: number,
//   radius: number,
//   depth: number,
//   invViewProj: mat4,
//   width: number,
//   height: number
// ): Circle3D {
//   const center = unprojectPixel(cx, cy, depth, invViewProj, width, height);

//   const right = unprojectPixel(
//     cx + radius,
//     cy,
//     depth,
//     invViewProj,
//     width,
//     height
//   );

//   const down = unprojectPixel(
//     cx,
//     cy + radius,
//     depth,
//     invViewProj,
//     width,
//     height
//   );

//   const u = vec3.create();
//   vec3.subtract(u, right, center);

//   const v = vec3.create();
//   vec3.subtract(v, down, center);

//   return { center, u, v };
// }

// function circleFromScreenWithNormal(
//   cx: number,
//   cy: number,
//   radiusPx: number,
//   depth: number,
//   normalWorld: vec3,
//   view: mat4,
//   proj: mat4,
//   width: number,
//   height: number
// ): Circle3D {
//   /* viewProjection + inverse */

//   const vp = mat4.create();
//   mat4.multiply(vp, proj, view);

//   const invVP = mat4.create();
//   mat4.invert(invVP, vp);

//   /* world center */

//   const center = unprojectPixel(cx, cy, depth, invVP, width, height);

//   /* compute world distance of 1 screen pixel */

//   const p1 = unprojectPixel(cx, cy, depth, invVP, width, height);
//   const p2 = unprojectPixel(cx + 1, cy, depth, invVP, width, height);

//   const pixelWorld = vec3.distance(p1, p2);

//   const worldRadius = pixelWorld * radiusPx;

//   /* build orthonormal basis from normal */

//   const n = vec3.clone(normalWorld);
//   vec3.normalize(n, n);

//   const tmp =
//     Math.abs(n[0]) < 0.9 ? vec3.fromValues(1, 0, 0) : vec3.fromValues(0, 1, 0);

//   const u = vec3.create();
//   vec3.cross(u, n, tmp);
//   vec3.normalize(u, u);
//   vec3.scale(u, u, worldRadius);

//   const v = vec3.create();
//   vec3.cross(v, n, u);
//   vec3.normalize(v, v);
//   vec3.scale(v, v, worldRadius);

//   return { center, u, v };
// }

function circleFromScreenWithNormalFast(
  cx: number,
  cy: number,
  radiusPx: number,
  depth: number,
  normalWorld: vec3,
  view: mat4,
  proj: mat4,
  invViewProj: mat4,
  width: number,
  height: number
): Circle3D {
  const center = unprojectPixel(cx, cy, depth, invViewProj, width, height);

  const center4 = vec4.fromValues(center[0], center[1], center[2], 1);
  vec4.transformMat4(center4, center4, view);

  const z = Math.abs(center4[2]);

  const f = proj[5];

  const worldRadius = (radiusPx * z) / (f * (height * 0.5));

  const n = vec3.clone(normalWorld);
  vec3.normalize(n, n);

  const tmp =
    Math.abs(n[0]) < 0.9 ? vec3.fromValues(1, 0, 0) : vec3.fromValues(0, 1, 0);

  const u = vec3.create();
  vec3.cross(u, n, tmp);
  vec3.normalize(u, u);
  vec3.scale(u, u, worldRadius);

  const v = vec3.create();
  vec3.cross(v, n, u);
  vec3.normalize(v, v);
  vec3.scale(v, v, worldRadius);

  return { center, u, v };
}

function drawProjectedCircle(
  container: Container,
  view: mat4,
  proj: mat4,
  circle: Circle3D,
  width: number,
  height: number
) {
  const vp = mat4.create();
  mat4.multiply(vp, proj, view);

  const c = projectWorldToPixel(circle.center, vp, width, height);

  const up = vec3.create();
  vec3.add(up, circle.center, circle.u);

  const vp2 = vec3.create();
  vec3.add(vp2, circle.center, circle.v);

  const u2 = projectWorldToPixel(up, vp, width, height);
  const v2 = projectWorldToPixel(vp2, vp, width, height);

  const axis1 = [u2[0] - c[0], u2[1] - c[1]];

  const axis2 = [v2[0] - c[0], v2[1] - c[1]];

  const a = axis1[0];
  const b = axis1[1];
  const c2 = axis2[0];
  const d = axis2[1];
  const e = c[0];
  const f = c[1];

  return container
    .circle(2)
    .center(0, 0)
    .fill("none")
    .stroke({ width: 2, color: config.color })
    .transform({ a, b, c: c2, d, e, f });
}

export default AnnotationMarker;
