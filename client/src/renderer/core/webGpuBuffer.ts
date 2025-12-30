export abstract class WebGpuBuffer {
  protected device: GPUDevice;
  protected buffer: GPUBuffer;
  protected destroyed: boolean = false;
  protected label: string;

  protected constructor(device: GPUDevice, initialSize: number, label: string) {
    this.device = device;
    this.label = label;
    this.buffer = this.createBuffer(initialSize);
  }

  protected abstract createBuffer(size: number): GPUBuffer;

  abstract updateBuffer(): void;

  getBuffer(): GPUBuffer {
    this.updateBuffer();
    return this.buffer;
  }

  destroy() {
    this.destroyed = true;
    this.buffer.destroy();
  }
}
