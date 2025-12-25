export class WebGpuTexture {
  protected texture: GPUTexture | undefined;
  protected view: GPUTextureView | undefined;
  protected sampler: GPUSampler;
  protected device: GPUDevice;

  constructor(device: GPUDevice, sampler: GPUSampler) {
    this.device = device;
    this.sampler = sampler;
  }

  getView(): GPUTextureView | undefined {
    return this.view;
  }
  getSampler(): GPUSampler {
    return this.sampler;
  }
  destroy() {
    this.texture?.destroy();
  }
}
