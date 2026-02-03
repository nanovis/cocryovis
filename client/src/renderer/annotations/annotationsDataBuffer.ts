import {
  BoolUint32,
  type DecodedBuffer,
  Float32Vec4,
} from "buffer-backed-object";
import { WebGpuBufferBBOArray } from "@/renderer/core/webGpuBufferBBO";

const annotationDataDescriptor = {
  color: Float32Vec4(),
  enabled: BoolUint32(),
} as const;

export type AnnotationData = DecodedBuffer<typeof annotationDataDescriptor>;

export class AnnotationsDataBuffer extends WebGpuBufferBBOArray<
  typeof annotationDataDescriptor
> {
  constructor(device: GPUDevice) {
    super(device, annotationDataDescriptor, "AnnotationData Buffer", 4, {
      align: 16,
    });

    this.set(0, { color: [1, 1, 1, 1], enabled: true });
    this.set(1, { color: [1, 1, 1, 1], enabled: false });
    this.set(2, { color: [1, 1, 1, 1], enabled: false });
    this.set(3, { color: [1, 1, 1, 1], enabled: false });
  }

  protected createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      label: this.label,
      size: size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }
}
