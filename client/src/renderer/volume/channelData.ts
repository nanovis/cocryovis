import {
  BoolUint32,
  type DecodedBuffer,
  Float32,
  Float32Vec4,
} from "buffer-backed-object";
import { WebGpuBufferBBOArray } from "@/renderer/core/webGpuBufferBBO";

const channelParametersDescriptor = {
  color: Float32Vec4(),
  ratio: Float32Vec4(),

  rampStart: Float32(),
  rampEnd: Float32(),
  visible: BoolUint32(),
} as const;

export type ChannelParameters = DecodedBuffer<
  typeof channelParametersDescriptor
>;

export class ChannelData extends WebGpuBufferBBOArray<
  typeof channelParametersDescriptor
> {
  constructor(device: GPUDevice) {
    super(device, channelParametersDescriptor, "ChannelData Buffer", 4, {
      align: 16,
    });

    this.set(0, {
      color: [1, 1, 1, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.1,
      rampEnd: 0.9,
      visible: false,
    });
    this.set(1, {
      color: [0, 1, 0, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.0,
      rampEnd: 1.0,
      visible: false,
    });
    this.set(2, {
      color: [0, 0, 1, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.0,
      rampEnd: 1.0,
      visible: false,
    });
    this.set(3, {
      color: [1, 1, 0, 1],
      ratio: [1, 1, 1, 1],
      rampStart: 0.0,
      rampEnd: 1.0,
      visible: false,
    });
  }

  protected override createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      label: this.label,
      size: size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }
}
