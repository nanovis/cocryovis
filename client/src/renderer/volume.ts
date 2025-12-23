import { streamVolumesToGPU } from "./volumeLoader.ts";

export class Volume {
  private texture: GPUTexture | undefined;
  private view: GPUTextureView | undefined;
  private readonly onChange: (() => void) | undefined;
  sampler: GPUSampler;
  private device: GPUDevice;

  constructor(device: GPUDevice, sampler: GPUSampler, onChange?: () => void) {
    this.onChange = onChange;
    this.sampler = sampler;
    this.device = device;
  }

  loadData(data: ArrayBuffer) {
    this.texture = streamVolumesToGPU(this.device, [
      {
        buffer: data,
        params: {
          bytesPerVoxel: 1,
          usedBits: 8,
          skipBytes: 0,
          littleEndian: true,
          isSigned: false,
          addValue: 0,
          size: { x: 256, y: 256, z: 448 },
          ratio: { x: 1, y: 1, z: 1 },
        },
      },
    ]);

    this.view = this.texture.createView({
      dimension: "3d",
    });

    this.onChange?.();
  }

  // async loadTestData(device: GPUDevice) {
  //   this.texture = await loadTestVolume(device);
  //   this.view = this.texture.createView({
  //     dimension: "3d",
  //   });
  //   console.log("TEST DATA LOADED");
  //
  //   this.onChange?.();
  // }

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

  getView(): GPUTextureView | undefined {
    return this.view;
  }
  destroy() {
    this.texture?.destroy();
  }
}
