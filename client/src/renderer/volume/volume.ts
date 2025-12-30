import { streamVolumesToGPU } from "./volumeLoader";
import type { VolumeDescriptor } from "../../utils/volumeSettings";
import { WebGpuTexture } from "../core/webGpuTexture";

export class Volume extends WebGpuTexture {
  async loadData(volumeDescriptors: VolumeDescriptor[]) {
    this.texture = await streamVolumesToGPU(this.device, volumeDescriptors);

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
