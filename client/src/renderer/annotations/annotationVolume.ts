import { WebGpuTexture } from "../core/webGpuTexture.ts";
import type { VolumeManager } from "../volume/volumeManager.ts";

export class AnnotationVolume extends WebGpuTexture {
  private readonly volumeManager: VolumeManager;
  private width: number | undefined;
  private height: number | undefined;
  private depth: number | undefined;
  private readonly label: string;

  constructor(device: GPUDevice, volumeManager: VolumeManager, label: string) {
    super(device);
    this.volumeManager = volumeManager;
    this.label = label;
  }

  update() {
    const volumeTexture = this.volumeManager.volume.getTexture();
    if (!volumeTexture) {
      return;
    }

    if (
      this.width === volumeTexture.width &&
      this.height === volumeTexture.height &&
      this.depth === volumeTexture.depthOrArrayLayers
    ) {
      return;
    }

    this.texture?.destroy();
    this.texture = this.device.createTexture({
      label: this.label,
      size: {
        width: volumeTexture.width,
        height: volumeTexture.height,
        depthOrArrayLayers: volumeTexture.depthOrArrayLayers,
      },
      format: "rgba8unorm",
      dimension: "3d",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST,
    });

    this.view = this.texture.createView({
      dimension: "3d",
    });

    this.width = volumeTexture.width;
    this.height = volumeTexture.height;
    this.depth = volumeTexture.depthOrArrayLayers;
  }

  override getTexture(): GPUTexture | undefined {
    this.update();
    return super.getTexture();
  }

  override getView(): GPUTextureView | undefined {
    this.update();
    return super.getView();
  }
}
