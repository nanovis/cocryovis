import { streamVolumesToGPU } from "../utilities/volumeLoader";
import type { VolumeDescriptor } from "@/utils/volumeDescriptor";
import { TextureResource, type BindableTexture } from "../core/webGpuTexture";

export class Volume implements BindableTexture {
  private readonly device: GPUDevice;
  private texture: TextureResource;

  constructor(device: GPUDevice, sampler?: GPUSampler) {
    this.device = device;
    this.texture = new TextureResource(device, sampler);
  }

  async loadData(volumeDescriptors: VolumeDescriptor[]) {
    if (volumeDescriptors.length === 0) {
      throw new Error("No volume descriptors provided");
    }
    const descriptor = volumeDescriptors[0];

    const settings = await descriptor.getSettings();

    const { texture } = this.texture.createTexture({
      label: "Volume",
      format: "rgba8unorm",
      dimension: "3d",
      size: {
        width: settings.size.x,
        height: settings.size.y,
        depthOrArrayLayers: settings.size.z,
      },
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });

    await streamVolumesToGPU(this.device, texture, volumeDescriptors);
  }

  getTexture(): GPUTexture | undefined {
    return this.texture.getTexture();
  }

  getView(): GPUTextureView | undefined {
    return this.texture.getView();
  }

  getSampler(): GPUSampler | undefined {
    return this.texture.getSampler();
  }

  destroy() {
    this.texture.destroy();
  }
}
