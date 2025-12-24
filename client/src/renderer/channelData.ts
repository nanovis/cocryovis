import type { vec4 } from "gl-matrix";

interface ChannelParameters {
  color: vec4;
  ratio: vec4;
  rampStart: number;
  rampEnd: number;
}

export class ChannelData {
  private buffer: GPUBuffer;
  private dirty: boolean = true;
  private volumes: ChannelParameters[] = [];
  private device: GPUDevice;
  private bufferSize: number = 0;

  private destroyed: boolean = false;

  private onCreated: (() => void) | undefined;

  constructor(device: GPUDevice, onCreated?: () => void) {
    this.device = device;
    this.onCreated = onCreated;

    this.buffer = this.createBuffer(this.bufferSize);

    this.addChannelData({
      color: [1, 1, 1, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.1,
      rampEnd: 0.9,
    });
    this.addChannelData({
      color: [0, 1, 0, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.0,
      rampEnd: 1.0,
    });
    this.addChannelData({
      color: [0, 0, 1, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.0,
      rampEnd: 1.0,
    });
    this.addChannelData({
      color: [1, 1, 0, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.0,
      rampEnd: 1.0,
    });
    this.addChannelData({
      color: [1, 0, 1, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.0,
      rampEnd: 1.0,
    });
  }

  private createBuffer(size: number): GPUBuffer {
    const buffer = this.device.createBuffer({
      label: "ChannelData Buffer",
      size: size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.onCreated?.();
    return buffer;
  }

  addChannelData(volume: ChannelParameters) {
    this.volumes.push(volume);
    this.dirty = true;
  }

  setChannelData(index: number, data: Partial<ChannelParameters>) {
    if (index < 0 || index >= this.volumes.length) {
      throw new Error("Index out of bounds");
    }
    Object.assign(this.volumes[index], data);
    this.dirty = true;
  }

  private getOrUpdateBuffer(): GPUBuffer {
    if (!this.dirty || this.destroyed) {
      return this.buffer;
    }

    const data = new Float32Array(this.volumes.length * 10); // Each VolumeData has 8 floats
    let offset = 0;
    for (const volume of this.volumes) {
      data[offset++] = volume.color[0];
      data[offset++] = volume.color[1];
      data[offset++] = volume.color[2];
      data[offset++] = volume.color[3];
      data[offset++] = volume.ratio[0];
      data[offset++] = volume.ratio[1];
      data[offset++] = volume.ratio[2];
      data[offset++] = volume.ratio[3];
      data[offset++] = volume.rampStart;
      data[offset++] = volume.rampEnd;
      data[offset++] = 0;
      data[offset++] = 0;
    }

    if (this.bufferSize !== data.byteLength) {
      this.buffer.destroy();
      this.bufferSize = data.byteLength;
      this.buffer = this.createBuffer(this.bufferSize);
    }

    this.device.queue.writeBuffer(
      this.buffer,
      0,
      data.buffer,
      data.byteOffset,
      data.byteLength
    );

    this.dirty = false;
    return this.buffer;
  }

  updateBuffer() {
    this.getOrUpdateBuffer();
  }

  getBuffer(): GPUBuffer {
    return this.getOrUpdateBuffer();
  }

  destroy() {
    this.destroyed = true;
    this.buffer.destroy();
  }
}
