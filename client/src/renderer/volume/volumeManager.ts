import { Volume } from "./volume";
import { ChannelData } from "./channelData";
import type { VolumeDescriptor } from "@/utils/volumeDescriptor";
import { pickDefaultTF } from "@/utils/helpers";
import { CONFIG } from "@/constants";
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

  private _settings: VolumeDescriptor["settings"] | undefined;

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

  get settings(): Readonly<VolumeDescriptor["settings"]> | undefined {
    return this._settings;
  }

  getUnits() {
    if (!this._settings) {
      return undefined;
    }
    switch (this._settings.physicalUnit) {
      case "PIXEL":
        return "px";
      case "UNIT":
        return "units";
      case "MICROMETER":
        return "µm";
      case "NANOMETER":
        return "nm";
      case "ANGSTROM":
        return "Å";
      default:
        return undefined;
    }
  }

  getPhysicalSize() {
    if (!this._settings) {
      return undefined;
    }

    const physicalSize = this._settings.physicalSize;

    if (this._settings.physicalUnit === "PIXEL") {
      const size = this._settings.size;
      return {
        x: size.x,
        y: size.y,
        z: size.z,
      };
    }

    return {
      x: physicalSize.x,
      y: physicalSize.y,
      z: physicalSize.z,
    };
  }

  getScaledPhysicalSize() {
    const physicalSize = this.getPhysicalSize();
    if (!physicalSize) return undefined;
    const ratio = this.getRatio();
    if (!ratio) return undefined;

    return {
      x: physicalSize.x * (1 / ratio.x),
      y: physicalSize.y * (1 / ratio.y),
      z: physicalSize.z * (1 / ratio.z),
    };
  }

  getRatio() {
    if (!this._settings) {
      return undefined;
    }

    const physicalSize = this.getPhysicalSize();
    if (!physicalSize) return undefined;

    const maxSize = Math.max(physicalSize.x, physicalSize.y, physicalSize.z);
    return {
      x: physicalSize.x / maxSize,
      y: physicalSize.y / maxSize,
      z: physicalSize.z / maxSize,
    };
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
    this._settings = undefined;

    let tfIndex = 0;
    for (const descriptor of descriptors) {
      let transferFunction = descriptor.transferFunction;
      if (!transferFunction) {
        transferFunction = pickDefaultTF(
          tfIndex,
          descriptors.length === 1
        ).tfDefinition;
      }

      let color = transferFunction.color;
      if (tfIndex === rawVolumeChannel) {
        color = { x: 255, y: 255, z: 255 };
      }

      const settings = await descriptor.getSettings();
      if (!this._settings) {
        this._settings = settings;
      }

      let scaledRatio!: [number, number, number];
      if (settings.physicalUnit === "PIXEL") {
        const size = settings.size;
        const physicalSize = settings.physicalSize;
        const sizeArray = [
          size.x * physicalSize.x,
          size.y * physicalSize.y,
          size.z * physicalSize.z,
        ];

        const maxSize = Math.max(...sizeArray);
        scaledRatio = sizeArray.map((s) => s / maxSize) as [
          number,
          number,
          number,
        ];
      } else {
        const maxPhysicalSize = Math.max(
          settings.physicalSize.x,
          settings.physicalSize.y,
          settings.physicalSize.z
        );
        scaledRatio = [
          settings.physicalSize.x / maxPhysicalSize,
          settings.physicalSize.y / maxPhysicalSize,
          settings.physicalSize.z / maxPhysicalSize,
        ];
      }

      this.channelData.set(tfIndex, {
        color: [color.x / 255, color.y / 255, color.z / 255, 1],
        ratio: scaledRatio,
        rampStart: transferFunction.rampLow,
        rampEnd: transferFunction.rampHigh,
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
