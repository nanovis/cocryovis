import { WebGpuBufferBBO } from "@/renderer/core/webGpuBufferBBO";
import {
  BoolUint32,
  type DecodedBuffer,
  Float32,
  Float32Vec4,
  Int32,
} from "buffer-backed-object";

const renderingParametersDescriptor = {
  clearColor: Float32Vec4(),

  enableEarlyRayTermination: BoolUint32(),
  enableJittering: BoolUint32(),
  enableAmbientOcclusion: BoolUint32(),
  enableSoftShadows: BoolUint32(),

  enableAnnotations: BoolUint32(),
  sampleRate: Float32(),
  aoRadius: Float32(),
  aoStrength: Float32(),

  aoNumSamples: Int32(),
  shadowQuality: Float32(),
  shadowStrength: Float32(),
  shadowRadius: Float32(),

  shadowMin: Float32(),
  shadowMax: Float32(),
} as const;

export type RenderingParameters = DecodedBuffer<
  typeof renderingParametersDescriptor
>;

export class RenderingParametersBuffer extends WebGpuBufferBBO<
  typeof renderingParametersDescriptor
> {
  static readonly defaults: RenderingParameters = {
    clearColor: [0, 0, 0, 1],

    enableEarlyRayTermination: true,
    enableJittering: true,
    enableAmbientOcclusion: true,
    enableSoftShadows: true,

    enableAnnotations: false,
    sampleRate: 5.0,
    aoRadius: 1.0,
    aoStrength: 0.9,

    aoNumSamples: 5,
    shadowQuality: 1.0,
    shadowStrength: 0.5,
    shadowRadius: 0.2,

    shadowMin: 0.0,
    shadowMax: 1.0,
  } as const;

  constructor(device: GPUDevice, init?: Partial<RenderingParameters>) {
    super(device, renderingParametersDescriptor, "ParamData Buffer", 16);
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
