import { WebGpuBuffer } from "./webGpuBuffer";
import {
  BufferBackedObject,
  type DecodedBuffer,
  type Descriptors,
  nextAlign,
  structSize,
} from "buffer-backed-object";

// Buffer wrapper variant with integrated buffer-backed object.
// Could use some more generic buffer - layout package (like @solana/buffer-layout)

export abstract class WebGpuBufferBBO<
  T extends Descriptors,
> extends WebGpuBuffer {
  protected readonly arrayBuffer: ArrayBuffer;
  protected readonly bufferObject: DecodedBuffer<T>;
  protected dirty: boolean = true;

  protected constructor(
    device: GPUDevice,
    descriptor: T,
    label: string,
    align: number = 4
  ) {
    const size = nextAlign(structSize(descriptor), align);
    super(device, size, label);

    this.arrayBuffer = new ArrayBuffer(size);
    this.bufferObject = BufferBackedObject(this.arrayBuffer, descriptor, {
      align: align,
    });
  }

  protected abstract createBuffer(size: number): GPUBuffer;

  set(params: Partial<DecodedBuffer<T>>) {
    this.dirty = true;
    Object.assign(this.bufferObject, params);
  }

  get params(): Readonly<DecodedBuffer<T>> {
    return this.bufferObject;
  }

  updateBuffer() {
    if (!this.dirty || this.destroyed) {
      return;
    }
    this.device.queue.writeBuffer(this.buffer, 0, this.arrayBuffer);
    this.dirty = false;
  }
}
