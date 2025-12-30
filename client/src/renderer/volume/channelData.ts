import type { vec4 } from "gl-matrix";
import { WebGpuBuffer } from "../core/webGpuBuffer";

interface ChannelParameters {
  color: vec4;
  ratio: vec4;
  rampStart: number;
  rampEnd: number;
  visible: boolean;
}

export class ChannelData extends WebGpuBuffer {
  private dirty: boolean = true;
  private volumes: ChannelParameters[] = [];
  private bufferSize: number = 0;

  private static readonly channelSize = 48;

  constructor(device: GPUDevice) {
    super(device, 0, "ChannelData Buffer");

    this.addChannelData({
      color: [1, 1, 1, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.1,
      rampEnd: 0.9,
      visible: false,
    });
    this.addChannelData({
      color: [0, 1, 0, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.0,
      rampEnd: 1.0,
      visible: false,
    });
    this.addChannelData({
      color: [0, 0, 1, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.0,
      rampEnd: 1.0,
      visible: false,
    });
    this.addChannelData({
      color: [1, 1, 0, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.0,
      rampEnd: 1.0,
      visible: false,
    });
    this.addChannelData({
      color: [1, 0, 1, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.0,
      rampEnd: 1.0,
      visible: false,
    });
  }

  protected createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      label: this.label,
      size: size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  addChannelData(volume: ChannelParameters) {
    this.volumes.push(volume);
    this.dirty = true;
  }

  setChannelData(index: number, data: Partial<ChannelParameters>) {
    if (index < 0 || index > this.volumes.length) {
      throw new Error("Index out of bounds");
    }
    Object.assign(this.volumes[index], data);
    this.dirty = true;
  }

  get numberOfChannels(): number {
    return this.volumes.length;
  }

  getParameters(index: number): ChannelParameters {
    if (index < 0 || index > this.volumes.length) {
      throw new Error("Index out of bounds");
    }
    return { ...this.volumes[index] };
  }

  clearChannelData() {
    this.volumes = [];
    this.dirty = true;
  }

  updateBuffer() {
    if (!this.dirty || this.destroyed) {
      return;
    }

    const buffer = new ArrayBuffer(
      ChannelData.channelSize * this.volumes.length
    );
    const view = new DataView(buffer);

    let o = 0;
    for (const volume of this.volumes) {
      for (let i = 0; i < 4; i++)
        view.setFloat32(o + i * 4, volume.color[i], true);
      o += 16;

      for (let i = 0; i < 4; i++)
        view.setFloat32(o + i * 4, volume.ratio[i], true);
      o += 16;

      view.setFloat32(o, volume.rampStart, true);
      o += 4;
      view.setFloat32(o, volume.rampEnd, true);
      o += 4;

      view.setInt32(o, Number(volume.visible), true);
      o += 4;

      // Padding
      view.setInt32(o, 0, true);
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
