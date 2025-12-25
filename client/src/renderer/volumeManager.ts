import { Volume } from "./volume.ts";
import { ChannelData } from "./channelData.ts";
import type { VolumeDescriptor } from "../utils/volumeSettings.ts";
import { pickDefaultTF } from "../utils/Helpers.ts";

export class VolumeManager {
  private device: GPUDevice;
  volume: Volume;
  channelData: ChannelData;

  constructor(device: GPUDevice) {
    this.device = device;
    this.channelData = new ChannelData(device);
    const volumeSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
    });
    this.volume = new Volume(device, volumeSampler);
  }

  async loadVolumes(volumeDescriptors: VolumeDescriptor[]) {
    await this.volume.loadData(volumeDescriptors);
    this.channelData.clearChannelData();

    let tfIndex = 0;
    for (const descriptor of volumeDescriptors) {
      const transferFunction = pickDefaultTF(
        tfIndex,
        volumeDescriptors.length === 1
      );
      const color = transferFunction.tfDefinition.color;

      const ratio = descriptor.settings?.ratio;
      const ratioArray = ratio ? [ratio.x, ratio.y, ratio.z] : [1, 1, 1];

      const size = descriptor.settings?.size;
      const sizeArray = size ? [size.x, size.y, size.z] : [1, 1, 1];

      const maxSize = Math.max(...sizeArray);
      const scaledRatio = ratioArray.map(
        (r, i) => (r * sizeArray[i]) / maxSize
      );

      this.channelData.addChannelData({
        color: [color.x / 255, color.y / 255, color.z / 255],
        ratio: scaledRatio,
        rampStart: transferFunction.tfDefinition.rampLow,
        rampEnd: transferFunction.tfDefinition.rampHigh,
      });
      tfIndex++;
    }
  }

  destroy() {
    this.volume.destroy();
    this.channelData.destroy();
  }
}
