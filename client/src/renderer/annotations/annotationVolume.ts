import { TextureResource, type BindableTexture } from "../core/webGpuTexture";
import type { VolumeManager } from "../volume/volumeManager";
import type { VolumeDescriptor } from "@/utils/volumeDescriptor";
import { streamVolumesToGPU } from "@/renderer/utilities/volumeLoader";

export class AnnotationVolume implements BindableTexture {
  private readonly device: GPUDevice;
  private readonly volumeManager: VolumeManager;
  private readonly label: string;
  private texture: TextureResource;

  constructor(device: GPUDevice, volumeManager: VolumeManager, label: string) {
    this.device = device;
    this.volumeManager = volumeManager;
    this.label = label;
    this.texture = new TextureResource(device);
  }

  async loadData(volumeDescriptors: VolumeDescriptor[]) {
    if (volumeDescriptors.length === 0) {
      throw new Error("No volume descriptors provided");
    }

    const texture = this.getTexture();

    if (!texture) {
      throw new Error("Could not create annotation texture.");
    }

    await streamVolumesToGPU(this.device, texture, volumeDescriptors);
  }

  private createAnnotationTexture(
    width: number,
    height: number,
    depth: number
  ) {
    return this.texture.createTexture({
      label: this.label,
      format: "rgba8unorm",
      dimension: "3d",
      size: {
        width: width,
        height: height,
        depthOrArrayLayers: depth,
      },
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST,
    });
  }

  private ensureTextureMatchesVolume() {
    const volumeTexture = this.volumeManager.volume.getTexture();
    if (!volumeTexture) {
      return;
    }

    const texture = this.texture.getTexture();

    if (
      texture?.width === volumeTexture.width &&
      texture.height === volumeTexture.height &&
      texture.depthOrArrayLayers === volumeTexture.depthOrArrayLayers
    ) {
      return;
    }

    this.createAnnotationTexture(
      volumeTexture.width,
      volumeTexture.height,
      volumeTexture.depthOrArrayLayers
    );
  }

  getTexture(): GPUTexture | undefined {
    this.ensureTextureMatchesVolume();
    return this.texture.getTexture();
  }

  getView(): GPUTextureView | undefined {
    this.ensureTextureMatchesVolume();
    return this.texture.getView();
  }
}
