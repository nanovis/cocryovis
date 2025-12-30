import { Volume } from "./volume";
import { ChannelData } from "./channelData";
import type { VolumeDescriptor } from "@/utils/volumeSettings";
import { pickDefaultTF } from "@/utils/Helpers";
import { CONFIG } from "@/Constants";
import { VolumeParameterBuffer } from "./volumeParameterBuffer";
import { mat4 } from "gl-matrix";

export interface VisualizationDescriptor {
  descriptors: VolumeDescriptor[];
  rawVolumeChannel?: number;
}

export class VolumeManager {
  private device: GPUDevice;
  volume: Volume;
  channelData: ChannelData;
  volumeParameterBuffer: VolumeParameterBuffer;
  private modelMatrix: mat4 = mat4.create();

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
    this.volumeParameterBuffer = new VolumeParameterBuffer(device);
  }

  async loadVolumes(
    visualizationDescriptor: VisualizationDescriptor
  ): Promise<VisualizationDescriptor> {
    const descriptors = visualizationDescriptor.descriptors.splice(
      0,
      CONFIG.maxRenderedVolumes
    );

    await this.volume.loadData(descriptors);

    let rawVolumeChannel = visualizationDescriptor.rawVolumeChannel ?? -1;
    if (rawVolumeChannel >= descriptors.length) {
      rawVolumeChannel = -1;
    }

    // this.channelData.clearChannelData();

    let tfIndex = 0;
    for (const descriptor of descriptors) {
      const transferFunction = pickDefaultTF(tfIndex, descriptors.length === 1);
      let color = transferFunction.tfDefinition.color;
      if (tfIndex === rawVolumeChannel) {
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
    this.volumeParameterBuffer.set({
      numChannels: descriptors.length,
      rawVolumeChannel: rawVolumeChannel,
      rawClippingPlane: false,
    });

    return {
      rawVolumeChannel: rawVolumeChannel !== -1 ? rawVolumeChannel : undefined,
      descriptors: descriptors,
    };
  }

  getModelMatrix() {
    return this.modelMatrix;
  }

  destroy() {
    this.volume.destroy();
    this.channelData.destroy();
  }
}
