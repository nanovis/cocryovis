import { WebGpuBuffer } from "../core/webGpuBuffer";

export interface VolumeParameters {
  rawVolumeChannel: number;
  numChannels: number;
  voxelSize: number;
  rawClippingPlane: boolean;
}

export class VolumeParameterBuffer extends WebGpuBuffer {
  params: VolumeParameters = {
    rawVolumeChannel: -1,
    numChannels: 0,
    voxelSize: 1,
    rawClippingPlane: false,
  };

  private dirty: boolean = true;

  private static readonly size = 4 * 4;

  constructor(device: GPUDevice, init?: Partial<VolumeParameters>) {
    super(device, VolumeParameterBuffer.size, "Volume Parameters Buffer");
    Object.assign(this.params, init);
  }

  protected createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      size: size,
      label: this.label,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  set(params: Partial<VolumeParameters>) {
    this.dirty = true;
    Object.assign(this.params, params);
  }

  toBuffer(): ArrayBuffer {
    const buffer = new ArrayBuffer(VolumeParameterBuffer.size);
    const view = new DataView(buffer);

    let o = 0;
    const le = true;

    view.setInt32(o, this.params.rawVolumeChannel, le);
    o += 4;
    view.setInt32(o, this.params.numChannels, le);
    o += 4;
    view.setFloat32(o, this.params.voxelSize, le);
    o += 4;
    view.setInt32(o, Number(this.params.rawClippingPlane), le);
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
