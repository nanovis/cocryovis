export class WebGpuTexture {
  protected texture: GPUTexture | undefined;
  protected view: GPUTextureView | undefined;
  protected sampler: GPUSampler | undefined;
  protected readonly device: GPUDevice;

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

  protected requiresRenderAttachment(
    size: GPUExtent3DDictStrict,
    bytesPerVoxel: number
  ) {
    const maxBufferSize = this.device.limits.maxBufferSize;
    const byteSize =
      size.width *
      (size.height ?? 1) *
      (size.depthOrArrayLayers ?? 1) *
      bytesPerVoxel;
    return byteSize > maxBufferSize;
  }

  protected createTexture(
    descriptor: GPUTextureDescriptor & {
      size: GPUExtent3DDictStrict;
    }
  ) {
    this.texture?.destroy();

    // This is required due to an issue on Chrome:
    // https://issues.chromium.org/issues/341741272
    if (this.requiresRenderAttachment(descriptor.size, 4)) {
      descriptor.usage |= GPUTextureUsage.RENDER_ATTACHMENT;
    }

    const texture = this.device.createTexture({
      label: descriptor.label,
      size: descriptor.size,
      format: "rgba8unorm",
      dimension: "3d",
      usage: descriptor.usage,
    });

    const view = texture.createView({
      dimension: "3d",
    });

    return { texture, view };
  }
}
