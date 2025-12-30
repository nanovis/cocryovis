export class WebGpuTexture {
  protected texture: GPUTexture | undefined;
  protected view: GPUTextureView | undefined;
  protected sampler: GPUSampler | undefined;
  protected device: GPUDevice;

  constructor(device: GPUDevice, sampler?: GPUSampler) {
    this.device = device;
    this.sampler = sampler;
  }

  getTexture(): GPUTexture | undefined {
    return this.texture;
  }

  getView(): GPUTextureView | undefined {
    return this.view;
  }
  getSampler(): GPUSampler | undefined {
    return this.sampler;
  }
  destroy() {
    this.texture?.destroy();
  }
}
