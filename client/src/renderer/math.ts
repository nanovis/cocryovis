import { vec3 } from "gl-matrix";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function intersectRayPlane(
  rayOrigin: vec3,
  rayDir: vec3,
  planePoint: vec3,
  planeNormal: vec3
): number | undefined {
  const d = vec3.dot(planeNormal, rayDir);

  if (Math.abs(d) < Number.EPSILON) return undefined;

  const diff = vec3.sub(vec3.create(), planePoint, rayOrigin);
  const t = vec3.dot(diff, planeNormal) / d;

  if (t < 0) return undefined;

  return t;
}
