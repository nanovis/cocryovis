import { detect } from "detect-browser";
import { CHROMIUM_BASED_BROWSERS } from "@/constants";
import { getTextureFormatInfo } from "../utilities/formatInfo";

export interface BindableTexture {
  getTexture(): GPUTexture | undefined;
  getView(): GPUTextureView | undefined;
  getSampler?(): GPUSampler | undefined;
}

type TextureInitDescriptor = RequireFields<
  GPUTextureDescriptor,
  "dimension" | "label"
> & {
  size: GPUExtent3DDictStrict;
};

export class TextureResource implements BindableTexture {
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
    this.texture = undefined;
    this.view = undefined;
  }

  protected requiresRenderAttachment(
    size: GPUExtent3DDictStrict,
    bytesPerVoxel: number
  ) {
    const browser = detect();
    if (browser && !CHROMIUM_BASED_BROWSERS.includes(browser.name)) {
      return false;
    }

    const maxBufferSize = this.device.limits.maxBufferSize;
    const byteSize =
      size.width *
      (size.height ?? 1) *
      (size.depthOrArrayLayers ?? 1) *
      bytesPerVoxel;
    return byteSize > maxBufferSize;
  }

  createTexture(descriptor: TextureInitDescriptor) {
    this.texture?.destroy();

    // This is required due to an issue on Chrome:
    // https://issues.chromium.org/issues/341741272
    const textureFormatInfo = getTextureFormatInfo(descriptor.format);
    if (
      textureFormatInfo &&
      this.requiresRenderAttachment(
        descriptor.size,
        textureFormatInfo.bytesPerBlock
      )
    ) {
      descriptor.usage |= GPUTextureUsage.RENDER_ATTACHMENT;
    }

    const texture = this.device.createTexture(descriptor);

    const view = texture.createView({
      dimension: descriptor.dimension,
    });

    this.texture = texture;
    this.view = view;

    return { texture, view };
  }
}

export class EagerTextureResource extends TextureResource {
  constructor(
    device: GPUDevice,
    descriptor: TextureInitDescriptor,
    sampler?: GPUSampler
  ) {
    super(device, sampler);
    this.createTexture(descriptor);
  }

  override getTexture(): GPUTexture {
    const texture = super.getTexture();
    if (!texture) {
      throw new Error(
        "Texture has not been created yet. This should never happen in EagerTextureResource."
      );
    }
    return texture;
  }

  override getView(): GPUTextureView {
    const view = super.getView();
    if (!view) {
      throw new Error(
        "Texture view has not been created yet. This should never happen in EagerTextureResource."
      );
    }
    return view;
  }
}
