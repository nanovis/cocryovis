import type { vec3 } from "gl-matrix";
import { mat4 } from "gl-matrix";

export interface CameraParams {
  position: vec3;
  viewCenter: vec3;
  up: vec3;
  fovY: number;
  aspectRatio: number;
  near: number;
  far: number;
}

export class Camera {
  private readonly buffer: GPUBuffer;

  private params: CameraParams;

  private dirty: boolean = true;

  private viewMatrix: mat4;
  private inverseViewMatrix: mat4;
  private projectionMatrix: mat4;

  private device: GPUDevice;

  constructor(device: GPUDevice, params: CameraParams) {
    this.device = device;

    this.params = params;
    this.buffer = this.device.createBuffer({
      label: "Camera Buffer",
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const { viewMatrix, inverseViewMatrix } = this.computeViewMatrix();
    this.viewMatrix = viewMatrix;
    this.inverseViewMatrix = inverseViewMatrix;

    this.projectionMatrix = this.computeProjectionMatrix();
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
      this.params.fovY,
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

  setParameters(params: Partial<CameraParams>) {
    Object.assign(this.params, params);
    this.dirty = true;
  }

  updateBuffer() {
    if (!this.dirty) {
      return;
    }

    const { viewMatrix, inverseViewMatrix } = this.getViewMatrix();
    const projectionMatrix = this.getProjectionMatrix();

    const inverseProjectionMatrix = mat4.create();
    mat4.multiply(inverseProjectionMatrix, projectionMatrix, viewMatrix);
    mat4.invert(inverseProjectionMatrix, inverseProjectionMatrix);

    const data = new Float32Array(64);

    data.set(viewMatrix, 0);
    data.set(inverseViewMatrix, 16);
    data.set(projectionMatrix, 32);
    data.set(inverseProjectionMatrix, 48);

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
    return this.buffer;
  }

  destroy() {
    this.buffer.destroy();
  }
}
