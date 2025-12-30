import { WebGpuBuffer } from "../core/webGpuBuffer.ts";
import type { vec3 } from "gl-matrix";

interface AnnotationData {
  color: vec3;
  enabled: boolean;
}

export class AnnotationsDataBuffer extends WebGpuBuffer {
  private dirty: boolean = true;
  private annotationsData: AnnotationData[] = [];
  private bufferSize: number = 0;

  private static readonly channelSize = 4 * 4;

  constructor(device: GPUDevice) {
    super(device, 0, "ChannelData Buffer");

    this.addAnnotationData({
      color: [1, 1, 1, 1],
      enabled: true,
    });
    this.addAnnotationData({
      color: [1, 1, 1, 1],
      enabled: false,
    });
    this.addAnnotationData({
      color: [1, 1, 1, 1],
      enabled: false,
    });
    this.addAnnotationData({
      color: [1, 1, 1, 1],
      enabled: false,
    });
  }

  protected createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      label: this.label,
      size: size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  addAnnotationData(data: AnnotationData) {
    this.annotationsData.push(data);
    this.dirty = true;
  }

  setAnnotationData(index: number, data: Partial<AnnotationData>) {
    if (index < 0 || index > this.annotationsData.length) {
      throw new Error("Index out of bounds");
    }
    Object.assign(this.annotationsData[index], data);
    this.dirty = true;
  }

  getParameters(index: number): AnnotationData {
    if (index < 0 || index > this.annotationsData.length) {
      throw new Error("Index out of bounds");
    }
    return { ...this.annotationsData[index] };
  }

  clearChannelData() {
    this.annotationsData = [];
    this.dirty = true;
  }

  updateBuffer() {
    if (!this.dirty || this.destroyed) {
      return;
    }

    const buffer = new ArrayBuffer(
      AnnotationsDataBuffer.channelSize * this.annotationsData.length
    );
    const view = new DataView(buffer);

    let o = 0;
    for (const annotation of this.annotationsData) {
      for (let i = 0; i < 3; i++)
        view.setFloat32(o + i * 4, annotation.color[i], true);
      o += 12;

      view.setFloat32(o, Number(annotation.enabled), true);
      o += 4;
    }

    if (this.bufferSize !== buffer.byteLength) {
      this.buffer.destroy();
      this.bufferSize = buffer.byteLength;
      this.buffer = this.createBuffer(this.bufferSize);
    }

    this.device.queue.writeBuffer(this.buffer, 0, buffer);

    this.dirty = false;
  }
}
