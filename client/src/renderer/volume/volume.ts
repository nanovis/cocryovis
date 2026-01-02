import { streamVolumesToGPU } from "./volumeLoader";
import type { VolumeDescriptor } from "@/utils/volumeDescriptor";
import { WebGpuTexture } from "../core/webGpuTexture";

export class Volume extends WebGpuTexture {
  async loadData(volumeDescriptors: VolumeDescriptor[]) {
    if (volumeDescriptors.length === 0) {
      throw new Error("No volume descriptors provided");
    }
    const descriptor = volumeDescriptors[0];

    const settings = await descriptor.getSettings();

    this.texture = this.device.createTexture({
      size: {
        width: settings.size.x,
        height: settings.size.y,
        depthOrArrayLayers: settings.size.z,
      },
      dimension: "3d",
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    await streamVolumesToGPU(this.device, this.texture, volumeDescriptors);

    this.view = this.texture.createView({
      dimension: "3d",
    });
  }

  // setData(
  //   device: GPUDevice,
  //   data: ArrayBuffer,
  //   width: number,
  //   height: number,
  //   depth: number
  // ) {
  //   if (this.texture) {
  //     this.texture.destroy();
  //   }
  //   this.texture = device.createTexture({
  //     size: { width, height, depthOrArrayLayers: depth },
  //     format: "r8unorm",
  //     usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  //   });
  //   device.queue.writeTexture(
  //     { texture: this.texture },
  //     data,
  //     { bytesPerRow: width },
  //     { width, height, depthOrArrayLayers: depth }
  //   );
  //   this.view = this.texture.createView({
  //     dimension: "3d",
  //   });
  //
  //   this.onChange?.();
  // }
}
