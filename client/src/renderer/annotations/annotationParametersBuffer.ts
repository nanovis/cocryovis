import { vec4 } from "gl-matrix";
import {
  Float32Vec4,
  Int32Vec4,
  Int32,
  BoolUint32,
  type DecodedBuffer,
} from "buffer-backed-object";
import { WebGpuBufferBBO } from "@/renderer/core/webGpuBufferBBO";

const annotationParametersDescriptor = {
  vertex: Float32Vec4(),
  kernelSize: Int32Vec4(),
  clearMask: Float32Vec4(),

  addAnnotation: BoolUint32(),
  annotationVolume: Int32(),
} as const;

export type AnnotationParameters = DecodedBuffer<
  typeof annotationParametersDescriptor
>;

export class AnnotationParametersBuffer extends WebGpuBufferBBO<
  typeof annotationParametersDescriptor
> {
  static readonly defaults: AnnotationParameters = {
    vertex: vec4.create(),
    kernelSize: [25, 25, 25, 0],
    clearMask: vec4.create(),

    addAnnotation: true,
    annotationVolume: 0,
  };

  constructor(device: GPUDevice, init?: Partial<AnnotationParameters>) {
    super(
      device,
      annotationParametersDescriptor,
      "Annotation Parameters Buffer",
      { align: 16 }
    );

    this.set(AnnotationParametersBuffer.defaults);
    if (init !== undefined) {
      this.set(init);
    }
  }

  protected override createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      size: size,
      label: this.label,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }
}
