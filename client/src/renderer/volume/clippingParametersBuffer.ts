import { WebGpuBufferBBO } from "@/renderer/core/webGpuBufferBBO";
import {
  BoolUint32,
  type DecodedBuffer,
  Float32Vec4,
} from "buffer-backed-object";

const clippingParametersDescriptor = {
  clippingPlaneOrigin: Float32Vec4(),
  clippingPlaneNormal: Float32Vec4(),
  clippingEnabled: BoolUint32(),
} as const;

export type ClippingParameters = DecodedBuffer<
  typeof clippingParametersDescriptor
>;

export class ClippingParametersBuffer extends WebGpuBufferBBO<
  typeof clippingParametersDescriptor
> {
  static readonly defaults: ClippingParameters = {
    clippingPlaneOrigin: [0, 0, 0, 0],
    clippingPlaneNormal: [0, 0, 0, 0],
    clippingEnabled: false,
  } as const;

  constructor(device: GPUDevice, init?: Partial<ClippingParameters>) {
    super(
      device,
      clippingParametersDescriptor,
      "Clipping Parameters Buffer",
      16
    );
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
