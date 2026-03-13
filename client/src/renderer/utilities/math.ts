import { vec2, vec3, vec4, type mat4 } from "gl-matrix";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function screenToNDC(
  x: number,
  y: number,
  width: number,
  height: number
): vec2 {
  const nx = (x / width) * 2 - 1;
  const ny = 1 - (y / height) * 2;

  return vec2.fromValues(nx, ny);
}

export function unproject(
  ndcX: number,
  ndcY: number,
  ndcZ: number,
  invViewProj: mat4
): vec3 {
  const v = vec4.fromValues(ndcX, ndcY, ndcZ, 1);

  vec4.transformMat4(v, v, invViewProj);

  if (v[3] === 0) {
    throw new Error("W component is zero during unprojection");
  }

  return vec3.fromValues(v[0] / v[3], v[1] / v[3], v[2] / v[3]);
}

export function unprojectPixel(
  x: number,
  y: number,
  ndcZ: number,
  invViewProj: mat4,
  width: number,
  height: number
): vec3 {
  const [nx, ny] = screenToNDC(x, y, width, height);

  return unproject(nx, ny, ndcZ, invViewProj);
}

export function projectWorldToPixel(
  p: vec3,
  viewProj: mat4,
  width: number,
  height: number
): vec2 {
  const v = vec4.fromValues(p[0], p[1], p[2], 1);

  vec4.transformMat4(v, v, viewProj);

  if (v[3] === 0) {
    throw new Error("W component is zero during projection");
  }

  const ndcX = v[0] / v[3];
  const ndcY = v[1] / v[3];

  const sx = (ndcX * 0.5 + 0.5) * width;
  const sy = (1 - (ndcY * 0.5 + 0.5)) * height;

  return [sx, sy];
}

export function intersectRayPlane(
  rayOrigin: vec3,
  rayDir: vec3,
  planeOrigin: vec3,
  planeNormal: vec3
): { t: number; backface: boolean } | undefined {
  const d = vec3.dot(planeNormal, rayDir);

  if (Math.abs(d) < Number.EPSILON) return undefined;

  const diff = vec3.sub(vec3.create(), planeOrigin, rayOrigin);
  const t = vec3.dot(diff, planeNormal) / d;

  if (t < 0) return undefined;

  return { t, backface: d > 0 };
}

export function findRayPlaneIntersection(
  rayOrigin: vec3,
  rayDir: vec3,
  planeOrigin: vec3,
  planeNormal: vec3
): { point: vec3; backface: boolean } | undefined {
  const intersection = intersectRayPlane(
    rayOrigin,
    rayDir,
    planeOrigin,
    planeNormal
  );

  if (intersection === undefined) return undefined;

  return {
    point: vec3.scaleAndAdd(vec3.create(), rayOrigin, rayDir, intersection.t),
    backface: intersection.backface,
  };
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
  const p4 = vec4.create();

  let left: vec3 | undefined;
  let right: vec3 | undefined;
  let top: vec3 | undefined;
  let bottom: vec3 | undefined;

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
    try {
      const [sx, sy] = projectWorldToPixel(p4, viewProj, width, height);
      if (sx < minX) {
        minX = sx;
        left = vec3.clone(p);
      }

      if (sx > maxX) {
        maxX = sx;
        right = vec3.clone(p);
      }

      if (sy < minY) {
        minY = sy;
        top = vec3.clone(p);
      }

      if (sy > maxY) {
        maxY = sy;
        bottom = vec3.clone(p);
      }
    } catch {
      // Ignore points that can't be projected
    }
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    left: left,
    right: right,
    top: top,
    bottom: bottom,
  };
}

export function rayFromPixel(
  x: number,
  y: number,
  width: number,
  height: number,
  invViewProj: mat4
) {
  const near = unprojectPixel(x, y, 0, invViewProj, width, height);
  const far = unprojectPixel(x, y, 1, invViewProj, width, height);

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

  const intersection = findRayPlaneIntersection(
    ray0.origin,
    ray0.dir,
    planeOrigin,
    planeNormal
  );

  if (!intersection) return null;

  const p0 = intersection.point;

  const intersectionX = findRayPlaneIntersection(
    rayX.origin,
    rayX.dir,
    planeOrigin,
    planeNormal
  );

  if (!intersectionX) return null;
  const px = intersectionX.point;

  const intersectionY = findRayPlaneIntersection(
    rayY.origin,
    rayY.dir,
    planeOrigin,
    planeNormal
  );

  if (!intersectionY) return null;
  const py = intersectionY.point;

  // Scale by 0.5, since the volume spans from -1 to 1 in all dimensions
  const pixelSizeX = anisotropicDistance(p0, px, voxelSize) * 0.5;
  const pixelSizeY = anisotropicDistance(p0, py, voxelSize) * 0.5;

  return {
    pixelSizeX,
    pixelSizeY,
  };
}

export function computeVisibleBoundsCameraSpace(
  leftWorld: vec3,
  rightWorld: vec3,
  topWorld: vec3,
  bottomWorld: vec3,
  view: mat4,
  projection: mat4
) {
  function toView(v: vec3): vec3 {
    const p = vec4.fromValues(v[0], v[1], v[2], 1);
    vec4.transformMat4(p, p, view);
    return vec3.fromValues(p[0], p[1], p[2]);
  }

  const leftV = toView(leftWorld);
  const rightV = toView(rightWorld);
  const topV = toView(topWorld);
  const bottomV = toView(bottomWorld);

  const z = leftV[2];

  const minX = Math.min(leftV[0], rightV[0]);
  const maxX = Math.max(leftV[0], rightV[0]);

  const minY = Math.min(bottomV[1], topV[1]);
  const maxY = Math.max(bottomV[1], topV[1]);

  const P00 = projection[0];
  const P11 = projection[5];

  const d = Math.abs(z);

  const xLimit = d / P00;
  const yLimit = d / P11;

  const visibleLeftX = Math.max(minX, -xLimit);
  const visibleRightX = Math.min(maxX, xLimit);

  const visibleBottomY = Math.max(minY, -yLimit);
  const visibleTopY = Math.min(maxY, yLimit);

  // Doesn't really matter where the center is, since the aspect ratio is preserved. Could also be 0
  const centerX = (visibleLeftX + visibleRightX) * 0.5;
  const centerY = (visibleTopY + visibleBottomY) * 0.5;

  return {
    left: vec3.fromValues(visibleLeftX, centerY, z),
    right: vec3.fromValues(visibleRightX, centerY, z),
    top: vec3.fromValues(centerX, visibleTopY, z),
    bottom: vec3.fromValues(centerX, visibleBottomY, z),
  };
}

export function computeVisibleDimensions(
  leftWorld: vec3,
  rightWorld: vec3,
  topWorld: vec3,
  bottomWorld: vec3,
  view: mat4,
  projection: mat4,
  voxelSize: vec3
) {
  const { left, right, top, bottom } = computeVisibleBoundsCameraSpace(
    leftWorld,
    rightWorld,
    topWorld,
    bottomWorld,
    view,
    projection
  );

  // Scale by 0.5, since the volume spans from -1 to 1 in all dimensions
  const width = anisotropicDistance(left, right, voxelSize) / 2;
  const height = anisotropicDistance(top, bottom, voxelSize) / 2;

  return {
    width,
    height,
  };
}
