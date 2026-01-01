import { vec4 } from "gl-matrix";
import { WebGpuBuffer } from "../core/webGpuBuffer";

export interface AnnotationParameters {
  vertex: vec4;
  kernelSize: vec4;
  clearMask: vec4;

  addAnnotation: boolean;
  annotationVolume: number;
}

export class AnnotationParametersBuffer extends WebGpuBuffer {
  params: AnnotationParameters = {
    vertex: vec4.create(),
    kernelSize: vec4.fromValues(25, 25, 25, 0),
    clearMask: vec4.create(),

    addAnnotation: true,
    annotationVolume: 0,
  };

  private dirty: boolean = true;

  private static readonly size = 24 * 4;

  constructor(device: GPUDevice, init?: Partial<AnnotationParameters>) {
    super(
      device,
      AnnotationParametersBuffer.size,
      "Annotation Parameters Buffer"
    );
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

  set(params: Partial<AnnotationParameters>) {
    this.dirty = true;
    Object.assign(this.params, params);
  }

  getKernelSize(): vec4 {
    return vec4.clone(this.params.kernelSize);
  }

  toBuffer(): ArrayBuffer {
    const buffer = new ArrayBuffer(AnnotationParametersBuffer.size);
    const view = new DataView(buffer);

    let o = 0;
    const le = true;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.vertex[i], le);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setInt32(o + i * 4, this.params.kernelSize[i], le);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.clearMask[i], le);
    o += 16;

    view.setInt32(o, Number(this.params.addAnnotation), le);
    o += 4;
    view.setInt32(o, this.params.annotationVolume, le);
    o += 4;
    // Buffer
    view.setInt32(o, 0, le);
    o += 4;
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
