import {
  Int32,
  Float32,
  BoolUint32,
  type DecodedBuffer,
} from "buffer-backed-object";
import { WebGpuBufferBBO } from "../core/webGpuBufferBBO";

const volumeParametersDescriptor = {
  rawVolumeChannel: Int32(),
  numChannels: Int32(),
  voxelSize: Float32(),
  rawClippingPlane: BoolUint32(),
} as const;

export type VolumeParameters = DecodedBuffer<typeof volumeParametersDescriptor>;

export class VolumeParameterBuffer extends WebGpuBufferBBO<
  typeof volumeParametersDescriptor
> {
  static readonly defaults: VolumeParameters = {
    rawVolumeChannel: -1,
    numChannels: 0,
    voxelSize: 1,
    rawClippingPlane: false,
  } as const;

  constructor(device: GPUDevice, init?: Partial<VolumeParameters>) {
    super(device, volumeParametersDescriptor, "Volume Parameters Buffer", 16);

    this.set(VolumeParameterBuffer.defaults);
    if (init !== undefined) {
      this.set(init);
    }
  }

  protected createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      size: size,
      label: this.label,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
}
