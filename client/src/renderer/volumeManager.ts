import { Volume } from "./volume.ts";
import { ChannelData } from "./channelData.ts";
import type { VolumeDescriptor } from "../utils/volumeSettings.ts";
import { pickDefaultTF } from "../utils/Helpers.ts";
import type { ParamData } from "./params.ts";
import { CONFIG } from "../Constants.mjs";

export interface VisualizationDescriptor {
  descriptors: VolumeDescriptor[];
  rawVolumeChannel?: number;
}

export class VolumeManager {
  private device: GPUDevice;
  private params: ParamData;
  volume: Volume;
  channelData: ChannelData;

  constructor(device: GPUDevice, params: ParamData) {
    this.device = device;
    this.params = params;
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

  async loadVolumes(visualizationDescriptor: VisualizationDescriptor) {
    await this.volume.loadData(visualizationDescriptor.descriptors);
    // this.channelData.clearChannelData();

    let tfIndex = 0;
    for (const descriptor of visualizationDescriptor.descriptors) {
      const transferFunction = pickDefaultTF(
        tfIndex,
        visualizationDescriptor.descriptors.length === 1
      );
      let color = transferFunction.tfDefinition.color;
      if (tfIndex === visualizationDescriptor.rawVolumeChannel) {
        color = { x: 255, y: 255, z: 255 };
      }

      const ratio = descriptor.settings?.ratio;
      const ratioArray = ratio ? [ratio.x, ratio.y, ratio.z] : [1, 1, 1];

      const size = descriptor.settings?.size;
      const sizeArray = size ? [size.x, size.y, size.z] : [1, 1, 1];

      const maxSize = Math.max(...sizeArray);
      const scaledRatio = ratioArray.map(
        (r, i) => (r * sizeArray[i]) / maxSize
      );

      this.channelData.setChannelData(tfIndex, {
        color: [color.x / 255, color.y / 255, color.z / 255],
        ratio: scaledRatio,
        rampStart: transferFunction.tfDefinition.rampLow,
        rampEnd: transferFunction.tfDefinition.rampHigh,
        visible: true,
      });
      tfIndex++;
    }
    this.params.set({
      numChannels: Math.min(tfIndex, CONFIG.maxRenderedVolumes),
      rawVolumeChannel: visualizationDescriptor.rawVolumeChannel ?? -1,
    });
  }

  destroy() {
    this.volume.destroy();
    this.channelData.destroy();
  }
}
