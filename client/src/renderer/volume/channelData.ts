import {
  BoolUint32,
  type DecodedBuffer,
  Float32,
  Float32Vec4,
} from "buffer-backed-object";
import { WebGpuBufferBBOArray } from "@/renderer/core/webGpuBufferBBO";

const channelParametersDescriptor = {
  color: Float32Vec4(),
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
  }

  protected override createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      label: this.label,
      size: size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }
}
