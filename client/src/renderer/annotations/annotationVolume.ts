import { WebGpuTexture } from "../core/webGpuTexture";
import type { VolumeManager } from "../volume/volumeManager";
import type { VolumeDescriptor } from "@/utils/volumeDescriptor";
import { streamVolumesToGPU } from "@/renderer/volume/volumeLoader";

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

  async loadData(volumeDescriptors: VolumeDescriptor[]) {
    if (volumeDescriptors.length === 0) {
      throw new Error("No volume descriptors provided");
    }

    if (!this.texture) {
      const descriptor = volumeDescriptors[0];
      const settings = await descriptor.getSettings();

      const { texture, view } = this.createTexture(
        settings.size.x,
        settings.size.y,
        settings.size.z
      );
      this.texture = texture;
      this.view = view;
    }

    await streamVolumesToGPU(this.device, this.texture, volumeDescriptors);
  }

  private createTexture(width: number, height: number, depth: number) {
    this.texture?.destroy();
    const texture = this.device.createTexture({
      label: this.label,
      size: {
        width: width,
        height: height,
        depthOrArrayLayers: depth,
      },
      format: "rgba8unorm",
      dimension: "3d",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST,
    });

    const view = texture.createView({
      dimension: "3d",
    });

    this.width = width;
    this.height = height;
    this.depth = depth;

    return { texture, view };
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

    const { texture, view } = this.createTexture(
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
