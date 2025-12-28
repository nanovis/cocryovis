import { glMatrix, mat4, vec3 } from "gl-matrix";
import { WebGpuBuffer } from "./webGpuBuffer.ts";

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

  private viewMatrix: mat4;
  private inverseViewMatrix: mat4;
  private projectionMatrix: mat4;

  private static readonly size = 256;

  constructor(device: GPUDevice, params: CameraParams) {
    super(device, Camera.size, "Camera Buffer");

    this.params = params;

    const { viewMatrix, inverseViewMatrix } = this.computeViewMatrix();
    this.viewMatrix = viewMatrix;
    this.inverseViewMatrix = inverseViewMatrix;

    this.projectionMatrix = this.computeProjectionMatrix();
  }

  protected createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      label: "Camera Buffer",
      size: size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
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
    if (this.dirty) {
      const { viewMatrix, inverseViewMatrix } = this.computeViewMatrix();
      this.viewMatrix = viewMatrix;
      this.inverseViewMatrix = inverseViewMatrix;
    }
    return {
      viewMatrix: this.viewMatrix,
      inverseViewMatrix: this.inverseViewMatrix,
    };
  }

  getProjectionMatrix(): mat4 {
    if (this.dirty) {
      this.projectionMatrix = this.computeProjectionMatrix();
    }
    return this.projectionMatrix;
  }

  get viewCenter(): vec3 {
    return this.params.viewCenter;
  }

  get up(): vec3 {
    return this.params.up;
  }

  setParameters(params: Partial<CameraParams>) {
    Object.assign(this.params, params);
    this.dirty = true;
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

    const inverseMvp = mat4.create();
    mat4.multiply(inverseMvp, projectionMatrix, viewMatrix);
    mat4.invert(inverseMvp, inverseMvp);

    const data = new Float32Array(64);

    data.set(viewMatrix, 0);
    data.set(inverseViewMatrix, 16);
    data.set(projectionMatrix, 32);
    data.set(inverseMvp, 48);

    this.device.queue.writeBuffer(
      this.buffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );

    this.dirty = false;
  }

  getBuffer(): GPUBuffer {
    this.updateBuffer();
    return this.buffer;
  }
}
