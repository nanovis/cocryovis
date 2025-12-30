import { WebGpuBuffer } from "../core/webGpuBuffer";
import { vec4 } from "gl-matrix";

export interface ClippingParameters {
  clippingPlaneOrigin: vec4;
  clippingPlaneNormal: vec4;
  clippingEnabled: boolean;
}

export class ClippingParametersBuffer extends WebGpuBuffer {
  params: ClippingParameters = {
    clippingPlaneOrigin: vec4.create(),
    clippingPlaneNormal: vec4.create(),
    clippingEnabled: false,
  };

  private dirty: boolean = true;

  private static readonly size = 12 * 4;

  constructor(device: GPUDevice, init?: Partial<ClippingParameters>) {
    super(device, ClippingParametersBuffer.size, "Clipping Parameters Buffer");
    Object.assign(this.params, init);
    this.device = device;
  }

  protected createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      size: size,
      label: this.label,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  set(params: Partial<ClippingParameters>) {
    this.dirty = true;
    Object.assign(this.params, params);
  }

  get clippingPlaneNormal(): vec4 {
    return vec4.clone(this.params.clippingPlaneNormal);
  }

  get clippingPlaneOrigin(): vec4 {
    return vec4.clone(this.params.clippingPlaneOrigin);
  }

  toBuffer(): ArrayBuffer {
    const buffer = new ArrayBuffer(ClippingParametersBuffer.size);
    const view = new DataView(buffer);

    let o = 0;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.clippingPlaneOrigin[i], true);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.clippingPlaneNormal[i], true);
    o += 16;

    view.setInt32(o, Number(this.params.clippingEnabled), true);
    o += 4;

    return buffer;
  }

  updateBuffer() {
    if (!this.dirty || this.destroyed) {
      return;
    }
    const data = this.toBuffer();
    this.device.queue.writeBuffer(this.buffer, 0, data);
    this.dirty = false;
  }
}
