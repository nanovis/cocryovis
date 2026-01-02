import { streamVolumesToGPU } from "../utilities/volumeLoader";
import type { VolumeDescriptor } from "@/utils/volumeDescriptor";
import { WebGpuTexture } from "../core/webGpuTexture";

export class Volume extends WebGpuTexture {
  async loadData(volumeDescriptors: VolumeDescriptor[]) {
    if (volumeDescriptors.length === 0) {
      throw new Error("No volume descriptors provided");
    }
    const descriptor = volumeDescriptors[0];

    const settings = await descriptor.getSettings();

    this.texture?.destroy();

    const { texture, view } = this.createTexture({
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
    this.texture = texture;
    this.view = view;

    await streamVolumesToGPU(this.device, this.texture, volumeDescriptors);

    this.view = this.texture.createView({
      dimension: "3d",
    });
  }
}
