import { glMatrix, mat4, vec3 } from "gl-matrix";
import { WebGpuBuffer } from "./webGpuBuffer";
import { Observable } from "../utilities/observable";

export interface CameraParams {
  position: vec3;
  viewCenter: vec3;
  up: vec3;
  fovY: number;
  aspectRatio: number;
  near: number;
  far: number;
}

export class Camera extends WebGpuBuffer {
  private readonly params: CameraParams;

  private dirty: boolean = true;

  private viewDirty: boolean = true;
  private projDirty: boolean = true;
  private viewProjDirty: boolean = true;

  private viewMatrix: mat4;
  private inverseViewMatrix: mat4;
  private projectionMatrix: mat4;
  private viewProjectionMatrix: mat4;
  private inverseViewProjectionMatrix: mat4;

  private static readonly size = 256;

  private views = new Map<string, CameraParams>();

  readonly observable = new Observable(() => this);

  constructor(device: GPUDevice, params: CameraParams) {
    super(device, Camera.size, "Camera Buffer");

    this.params = params;

    const { viewMatrix, inverseViewMatrix } = this.getViewMatrix();
    this.viewMatrix = viewMatrix;
    this.inverseViewMatrix = inverseViewMatrix;

    this.projectionMatrix = this.getProjectionMatrix();

    const { viewProjMatrix, inverseViewProjMatrix } =
      this.getViewProjectionMatrix();
    this.viewProjectionMatrix = viewProjMatrix;
    this.inverseViewProjectionMatrix = inverseViewProjMatrix;
  }

  protected createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      label: "Camera Buffer",
      size: size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  saveCameraView(key: string) {
    this.views.set(key, {
      position: vec3.clone(this.params.position),
      viewCenter: vec3.clone(this.params.viewCenter),
      up: vec3.clone(this.params.up),
      fovY: this.params.fovY,
      aspectRatio: this.params.aspectRatio,
      near: this.params.near,
      far: this.params.far,
    });
  }

  restoreCameraView(key: string) {
    const view = this.views.get(key);
    if (!view) return;

    this.setParameters(view);
  }

  private computeViewMatrix(): { viewMatrix: mat4; inverseViewMatrix: mat4 } {
    const viewMatrix = mat4.create();
    mat4.lookAt(
      viewMatrix,
      this.params.position,
      this.params.viewCenter,
      this.params.up
    );
    const inverseViewMatrix = mat4.create();
    mat4.invert(inverseViewMatrix, viewMatrix);
    return { viewMatrix, inverseViewMatrix };
  }

  private computeProjectionMatrix(): mat4 {
    const projectionMatrix = mat4.create();
    mat4.perspectiveZO(
      projectionMatrix,
      glMatrix.toRadian(this.params.fovY),
      this.params.aspectRatio,
      this.params.near,
      this.params.far
    );
    return projectionMatrix;
  }

  getViewMatrix(): { viewMatrix: mat4; inverseViewMatrix: mat4 } {
    if (this.viewDirty) {
      const { viewMatrix, inverseViewMatrix } = this.computeViewMatrix();
      this.viewMatrix = viewMatrix;
      this.inverseViewMatrix = inverseViewMatrix;
      this.viewDirty = false;
      this.viewProjDirty = true;
    }
    return {
      viewMatrix: this.viewMatrix,
      inverseViewMatrix: this.inverseViewMatrix,
    };
  }

  getProjectionMatrix(): mat4 {
    if (this.projDirty) {
      this.projectionMatrix = this.computeProjectionMatrix();
      this.projDirty = false;
      this.viewProjDirty = true;
    }
    return this.projectionMatrix;
  }

  private computeViewProjectionMatrix(): {
    viewProjMatrix: mat4;
    inverseViewProjMatrix: mat4;
  } {
    const { viewMatrix } = this.getViewMatrix();
    const projMatrix = this.getProjectionMatrix();
    const viewProjMatrix = mat4.multiply(mat4.create(), projMatrix, viewMatrix);
    const inverseViewProjMatrix = mat4.create();
    mat4.invert(inverseViewProjMatrix, viewProjMatrix);
    return { viewProjMatrix, inverseViewProjMatrix };
  }

  getViewProjectionMatrix(): {
    viewProjMatrix: mat4;
    inverseViewProjMatrix: mat4;
  } {
    if (this.viewProjDirty) {
      const { viewProjMatrix, inverseViewProjMatrix } =
        this.computeViewProjectionMatrix();
      this.viewProjectionMatrix = viewProjMatrix;
      this.inverseViewProjectionMatrix = inverseViewProjMatrix;
      this.viewProjDirty = false;
    }
    return {
      viewProjMatrix: this.viewProjectionMatrix,
      inverseViewProjMatrix: this.inverseViewProjectionMatrix,
    };
  }

  get viewCenter(): vec3 {
    return this.params.viewCenter;
  }

  get fovY(): number {
    return this.params.fovY;
  }

  get aspectRatio(): number {
    return this.params.aspectRatio;
  }

  get position(): vec3 {
    return vec3.clone(this.params.position);
  }

  get up(): vec3 {
    return vec3.clone(this.params.up);
  }

  setParameters(params: Partial<CameraParams>) {
    Object.assign(this.params, params);
    this.dirty = true;
    this.viewDirty = true;
    this.projDirty = true;
    this.viewProjDirty = true;
    this.observable.notify();
  }

  getViewVector() {
    const viewVector = vec3.create();
    vec3.subtract(viewVector, this.params.viewCenter, this.params.position);
    vec3.normalize(viewVector, viewVector);
    return viewVector;
  }

  updateBuffer() {
    if (!this.dirty || this.destroyed) {
      return;
    }

    const { viewMatrix, inverseViewMatrix } = this.getViewMatrix();
    const projectionMatrix = this.getProjectionMatrix();

    const { inverseViewProjMatrix } = this.getViewProjectionMatrix();

    const data = new Float32Array(64);

    data.set(viewMatrix, 0);
    data.set(inverseViewMatrix, 16);
    data.set(projectionMatrix, 32);
    data.set(inverseViewProjMatrix, 48);

    this.device.queue.writeBuffer(
      this.buffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );

    this.dirty = false;
  }

  setFullscreen(
    clippingPlaneUp: vec3,
    clippingPlaneNormal: vec3,
    clippingPlaneOrigin: vec3,
    volumeRatio: vec3
  ) {
    const up = vec3.clone(clippingPlaneUp);
    const viewCenter = vec3.clone(clippingPlaneOrigin);
    const objectHeight =
      Math.abs(volumeRatio[0] * clippingPlaneUp[0]) +
      Math.abs(volumeRatio[1] * clippingPlaneUp[1]) +
      Math.abs(volumeRatio[2] * clippingPlaneUp[2]);

    const right = vec3.cross(
      vec3.create(),
      clippingPlaneNormal,
      clippingPlaneUp
    );

    const objectWidth =
      Math.abs(volumeRatio[0] * right[0]) +
      Math.abs(volumeRatio[1] * right[1]) +
      Math.abs(volumeRatio[2] * right[2]);

    const projectionMatrix = this.getProjectionMatrix();
    const tanHalfFovX = 1 / projectionMatrix[0];
    const tanHalfFovY = 1 / projectionMatrix[5];

    const distanceX = objectWidth / tanHalfFovX;
    const distanceY = objectHeight / tanHalfFovY;
    const distance = Math.max(distanceX, distanceY);

    const position = vec3.scaleAndAdd(
      vec3.create(),
      clippingPlaneOrigin,
      clippingPlaneNormal,
      -distance
    );

    this.setParameters({
      up: up,
      viewCenter: viewCenter,
      position: position,
    });
  }

  getBuffer(): GPUBuffer {
    this.updateBuffer();
    return this.buffer;
  }
}
