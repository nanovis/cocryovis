import { vec4 } from "gl-matrix";
import { Float32Vec4, type DecodedBuffer } from "buffer-backed-object";
import { WebGpuBufferBBO } from "@/renderer/core/webGpuBufferBBO";

const annotationMerkerDescriptor = {
  center: Float32Vec4(),
  kernelSize: Float32Vec4(),
  ratio: Float32Vec4(),
  color: Float32Vec4(),
} as const;

type AnnotationMarker = DecodedBuffer<typeof annotationMerkerDescriptor>;

export class AnnotationMarkerBuffer extends WebGpuBufferBBO<
  typeof annotationMerkerDescriptor
> {
  static readonly defaults: AnnotationMarker = {
    center: vec4.create(),
    kernelSize: [25, 25, 25, 0],
    ratio: [1, 1, 1, 0],
    color: vec4.fromValues(1, 0, 0, 1),
  };

  constructor(device: GPUDevice, init?: Partial<AnnotationMarker>) {
    super(device, annotationMerkerDescriptor, "Annotation Parameters Buffer", {
      align: 16,
    });

    this.set(AnnotationMarkerBuffer.defaults);
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
