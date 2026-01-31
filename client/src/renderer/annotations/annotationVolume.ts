import { WebGpuTexture } from "../core/webGpuTexture";
import type { VolumeManager } from "../volume/volumeManager";
import type { VolumeDescriptor } from "@/utils/volumeDescriptor";
import { streamVolumesToGPU } from "@/renderer/utilities/volumeLoader";

export class AnnotationVolume extends WebGpuTexture {
  private readonly volumeManager: VolumeManager;
  private readonly label: string;

  constructor(device: GPUDevice, volumeManager: VolumeManager, label: string) {
    super(device);
    this.volumeManager = volumeManager;
    this.label = label;
  }

  async loadData(volumeDescriptors: VolumeDescriptor[]) {
    if (volumeDescriptors.length === 0) {
      throw new Error("No volume descriptors provided");
    }

    if (!this.texture) {
      const descriptor = volumeDescriptors[0];
      const settings = await descriptor.getSettings();

      const { texture, view } = this.createAnnotationTexture(
        settings.size.x,
        settings.size.y,
        settings.size.z
      );
      this.texture = texture;
      this.view = view;
    }

    await streamVolumesToGPU(this.device, this.texture, volumeDescriptors);
  }

  private createAnnotationTexture(
    width: number,
    height: number,
    depth: number
  ) {
    return this.createTexture({
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

  update() {
    const volumeTexture = this.volumeManager.volume.getTexture();
    if (!volumeTexture) {
      return;
    }

    if (
      this.texture?.width === volumeTexture.width &&
      this.texture.height === volumeTexture.height &&
      this.texture.depthOrArrayLayers === volumeTexture.depthOrArrayLayers
    ) {
      return;
    }

    const { texture, view } = this.createAnnotationTexture(
      volumeTexture.width,
      volumeTexture.height,
      volumeTexture.depthOrArrayLayers
    );

    this.texture = texture;
    this.view = view;
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
