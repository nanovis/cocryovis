import { vec4 } from "gl-matrix";
import { WebGpuBuffer } from "./webGpuBuffer.ts";

export interface RenderingParameters {
  clippingPlaneOrigin: vec4;
  clippingPlaneNormal: vec4;
  clearColor: vec4;

  enableEarlyRayTermination: boolean;
  enableJittering: boolean;
  enableAmbientOcclusion: boolean;
  enableSoftShadows: boolean;

  clippingEnabled: boolean;
  enableAnnotations: boolean;
  sampleRate: number;
  aoRadius: number;

  aoStrength: number;
  aoNumSamples: number;
  shadowQuality: number;
  shadowStrength: number;

  shadowRadius: number;
  shadowMin: number;
  shadowMax: number;
}

export class RenderingParametersBuffer extends WebGpuBuffer {
  params: RenderingParameters = {
    clippingPlaneOrigin: vec4.create(),
    clippingPlaneNormal: vec4.create(),
    clearColor: vec4.fromValues(0, 0, 0, 1),

    enableEarlyRayTermination: true,
    enableJittering: true,
    enableAmbientOcclusion: true,
    enableSoftShadows: true,

    clippingEnabled: false,
    enableAnnotations: true,
    sampleRate: 5.0,
    aoRadius: 1.0,

    aoStrength: 0.9,
    aoNumSamples: 5,
    shadowQuality: 1.0,
    shadowStrength: 0.5,

    shadowRadius: 0.2,
    shadowMin: 0.0,
    shadowMax: 1.0,
  };

  private dirty: boolean = true;

  private static readonly size = 28 * 4;

  constructor(device: GPUDevice, init?: Partial<RenderingParameters>) {
    super(device, RenderingParametersBuffer.size, "ParamData Buffer");
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

  set(params: Partial<RenderingParameters>) {
    this.dirty = true;
    Object.assign(this.params, params);
  }

  annotationsEnabled(): boolean {
    return this.params.enableAnnotations;
  }

  toBuffer(): ArrayBuffer {
    const buffer = new ArrayBuffer(RenderingParametersBuffer.size);
    const view = new DataView(buffer);

    let o = 0;
    const le = true;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.clippingPlaneOrigin[i], le);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.clippingPlaneNormal[i], le);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.clearColor[i], le);
    o += 16;

    view.setInt32(o, Number(this.params.enableEarlyRayTermination), le);
    o += 4;
    view.setInt32(o, Number(this.params.enableJittering), le);
    o += 4;
    view.setInt32(o, Number(this.params.enableAmbientOcclusion), le);
    o += 4;
    view.setInt32(o, Number(this.params.enableSoftShadows), le);
    o += 4;

    view.setInt32(o, Number(this.params.clippingEnabled), le);
    o += 4;
    view.setInt32(o, Number(this.params.enableAnnotations), le);
    o += 4;
    view.setFloat32(o, this.params.sampleRate, le);
    o += 4;
    view.setFloat32(o, this.params.aoRadius, le);
    o += 4;

    view.setFloat32(o, this.params.aoStrength, le);
    o += 4;
    view.setInt32(o, this.params.aoNumSamples, le);
    o += 4;
    view.setFloat32(o, this.params.shadowQuality, le);
    o += 4;
    view.setFloat32(o, this.params.shadowStrength, le);
    o += 4;

    view.setFloat32(o, this.params.shadowRadius, le);
    o += 4;
    view.setFloat32(o, this.params.shadowMin, le);
    o += 4;
    view.setFloat32(o, this.params.shadowMax, le);
    o += 4;
    // buffer
    view.setInt32(o, 0, le);
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
