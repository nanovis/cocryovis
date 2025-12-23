import type { vec4 } from "gl-matrix";

interface ChannelParameters {
  ratio: number;
  color: vec4;
  rampStart: number;
  rampEnd: number;
}

export class ChannelData {
  private buffer: GPUBuffer | undefined;
  private dirty: boolean = true;
  private volumes: ChannelParameters[] = [];
  private device: GPUDevice;

  constructor(device: GPUDevice) {
    this.device = device;
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
    if (!this.dirty && this.buffer) {
      return this.buffer;
    }

    const data = new Float32Array(this.volumes.length * 8); // Each VolumeData has 8 floats
    let offset = 0;
    for (const volume of this.volumes) {
      data[offset++] = volume.color[0];
      data[offset++] = volume.color[1];
      data[offset++] = volume.color[2];
      data[offset++] = volume.color[3];
      data[offset++] = volume.ratio;
      data[offset++] = volume.rampStart;
      data[offset++] = volume.rampEnd;
      data[offset++] = 0; // Padding to align to 32 bytes
    }

    if (!this.buffer) {
      this.buffer = this.device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
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
}
