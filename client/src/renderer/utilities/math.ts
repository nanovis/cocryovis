import { vec3, vec4, type mat4 } from "gl-matrix";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function intersectRayPlane(
  rayOrigin: vec3,
  rayDir: vec3,
  planePoint: vec3,
  planeOrigin: vec3
): number | undefined {
  const d = vec3.dot(planeOrigin, rayDir);

  if (Math.abs(d) < Number.EPSILON) return undefined;

  const diff = vec3.sub(vec3.create(), planePoint, rayOrigin);
  const t = vec3.dot(diff, planeOrigin) / d;

  if (t < 0) return undefined;

  return t;
}

export function findRayPlaneIntersection(
  rayOrigin: vec3,
  rayDir: vec3,
  planePoint: vec3,
  planeOrigin: vec3
): vec3 | undefined {
  const t = intersectRayPlane(rayOrigin, rayDir, planePoint, planeOrigin);

  if (t === undefined) return undefined;

  return vec3.scaleAndAdd(vec3.create(), rayOrigin, rayDir, t);
}

export function anisotropicDistance(a: vec3, b: vec3, voxel: vec3) {
  const dx = (a[0] - b[0]) * voxel[0];
  const dy = (a[1] - b[1]) * voxel[1];
  const dz = (a[2] - b[2]) * voxel[2];

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

const BOX_VERTICES = [
  vec3.fromValues(-1, -1, -1),
  vec3.fromValues(-1, -1, 1),
  vec3.fromValues(-1, 1, -1),
  vec3.fromValues(-1, 1, 1),
  vec3.fromValues(1, -1, -1),
  vec3.fromValues(1, -1, 1),
  vec3.fromValues(1, 1, -1),
  vec3.fromValues(1, 1, 1),
] as const;

const BOX_EDGES = [
  [0, 1],
  [0, 2],
  [0, 4],
  [1, 3],
  [1, 5],
  [2, 3],
  [2, 6],
  [3, 7],
  [4, 5],
  [4, 6],
  [5, 7],
  [6, 7],
] as const;

export function computeSliceScreenBounds(
  viewProj: mat4,
  width: number,
  height: number,
  origin: vec3,
  normal: vec3,
  ratio: vec3
) {
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  const d = vec3.dot(origin, normal);

  const ab = vec3.create();
  const p = vec3.create();
  const clip = vec4.create();
  const p4 = vec4.create();

  let left: vec3 | undefined;
  let right: vec3 | undefined;

  for (const [i, j] of BOX_EDGES) {
    const a = vec3.mul(vec3.create(), BOX_VERTICES[i], ratio);
    const b = vec3.mul(vec3.create(), BOX_VERTICES[j], ratio);

    vec3.subtract(ab, b, a);

    const denom = vec3.dot(normal, ab);
    if (Math.abs(denom) < 1e-6) continue;

    const t = (d - vec3.dot(normal, a)) / denom;
    if (t < 0 || t > 1) continue;

    vec3.scaleAndAdd(p, a, ab, t);

    vec4.set(p4, p[0], p[1], p[2], 1);
    vec4.transformMat4(clip, p4, viewProj);

    const w = clip[3];
    if (w === 0) continue;

    const ndcX = clip[0] / w;
    const ndcY = clip[1] / w;

    const sx = (ndcX + 1) * 0.5 * width;
    const sy = (1 - ndcY) * 0.5 * height;

    minX = Math.min(minX, sx);
    maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy);
    maxY = Math.max(maxY, sy);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function rayFromPixel(
  x: number,
  y: number,
  width: number,
  height: number,
  invViewProj: mat4
) {
  const ndcX = (x / width) * 2 - 1;
  const ndcY = 1 - (y / height) * 2;

  const near = vec4.fromValues(ndcX, ndcY, -1, 1);
  const far = vec4.fromValues(ndcX, ndcY, 1, 1);

  vec4.transformMat4(near, near, invViewProj);
  vec4.transformMat4(far, far, invViewProj);

  for (const v of [near, far]) {
    v[0] /= v[3];
    v[1] /= v[3];
    v[2] /= v[3];
  }

  const origin = vec3.fromValues(near[0], near[1], near[2]);
  const dir = vec3.normalize(
    vec3.create(),
    vec3.sub(vec3.create(), vec3.fromValues(far[0], far[1], far[2]), origin)
  );

  return { origin, dir };
}

export function slicePixelSize(
  width: number,
  height: number,
  invViewProj: mat4,
  planeOrigin: vec3,
  planeNormal: vec3,
  voxelSize: vec3
) {
  const cx = width * 0.5;
  const cy = height * 0.5;

  const ray0 = rayFromPixel(cx, cy, width, height, invViewProj);
  const rayX = rayFromPixel(cx + 1, cy, width, height, invViewProj);
  const rayY = rayFromPixel(cx, cy + 1, width, height, invViewProj);

  const p0 = findRayPlaneIntersection(
    ray0.origin,
    ray0.dir,
    planeOrigin,
    planeNormal
  );

  if (!p0) return null;

  const px = findRayPlaneIntersection(
    rayX.origin,
    rayX.dir,
    planeOrigin,
    planeNormal
  );

  if (!px) return null;

  const py = findRayPlaneIntersection(
    rayY.origin,
    rayY.dir,
    planeOrigin,
    planeNormal
  );

  if (!py) return null;

  // Scale by 0.5, since the volume spans from -1 to 1 in all dimensions
  const pixelSizeX = anisotropicDistance(p0, px, voxelSize) * 0.5;
  const pixelSizeY = anisotropicDistance(p0, py, voxelSize) * 0.5;

  return {
    pixelSizeX,
    pixelSizeY,
  };
}
