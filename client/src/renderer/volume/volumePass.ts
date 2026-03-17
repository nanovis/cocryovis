import volumeVertexShader from "@/assets/shaders/volume.vs.wgsl?raw";
import volumeFragmentShader from "@/assets/shaders/volume.fs.wgsl?raw";

import type { AnnotationManager } from "../annotations/annotationManager";
import { BindGroup } from "../core/bindGroup";
import type { Camera } from "../core/camera";
import { Framebuffer } from "../core/framebuffer";
import type { RenderingParametersBuffer } from "../renderingParametersBuffer";
import type { ClippingPlaneManager } from "./clippingPlaneManager";
import type { VolumeManager } from "./volumeManager";
import { DEPTH_TEXTURE_FORMAT } from "../core/defines";

const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
      buffer: { type: "uniform" },
    },
    {
      binding: 2,
      visibility: GPUShaderStage.FRAGMENT,
      sampler: { type: "filtering" },
    },
    {
      binding: 3,
      visibility: GPUShaderStage.FRAGMENT,
      texture: { sampleType: "float", viewDimension: "3d" },
    },
    {
      binding: 4,
      visibility: GPUShaderStage.FRAGMENT,
      texture: { sampleType: "float", viewDimension: "3d" },
    },
    {
      binding: 5,
      visibility: GPUShaderStage.FRAGMENT,
      texture: { sampleType: "float", viewDimension: "2d" },
    },
    {
      binding: 6,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "read-only-storage" },
    },
    {
      binding: 7,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" },
    },
    {
      binding: 8,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" },
    },
    {
      binding: 9,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "read-only-storage" },
    },
    {
      binding: 10,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" },
    },
  ],
};

export class VolumePass {
  private readonly device: GPUDevice;
  private readonly bindGroup: BindGroup;
  private readonly volumePipeline: GPURenderPipeline;
  readonly framebuffer: Framebuffer;

  constructor({
    device,
    width,
    height,
    format,
    camera,
    volumeManager,
    annotationManager,
    renderingParameters,
    clippingPlaneManager,
  }: {
    device: GPUDevice;
    width: number;
    height: number;
    format: GPUTextureFormat;
    camera: Camera;
    volumeManager: VolumeManager;
    annotationManager: AnnotationManager;
    renderingParameters: RenderingParametersBuffer;
    clippingPlaneManager: ClippingPlaneManager;
  }) {
    this.device = device;
    this.framebuffer = new Framebuffer({
      device,
      width,
      height,
      colorFormat: format,
      depthFormat: DEPTH_TEXTURE_FORMAT,
    });

    this.bindGroup = new BindGroup(this.device, bindGroupLayoutDescriptor);
    this.bindGroup.setResource(0, camera);
    this.bindGroup.setResource(2, volumeManager.volume);
    this.bindGroup.setResource(3, volumeManager.volume);
    this.bindGroup.setResource(4, annotationManager.getAnnotationVolume());
    this.bindGroup.setResource(5, volumeManager.transferFunctionLut);
    this.bindGroup.setResource(6, annotationManager.annotationsDataBuffer);
    this.bindGroup.setResource(7, volumeManager.volumeParameterBuffer);
    this.bindGroup.setResource(8, renderingParameters);
    this.bindGroup.setResource(9, volumeManager.channelData);
    this.bindGroup.setResource(
      10,
      clippingPlaneManager.clippingParametersBuffer
    );

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroup.getBindGroupLayout()],
    });

    this.volumePipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: this.device.createShaderModule({
          label: "Volume Vertex Shader",
          code: volumeVertexShader,
        }),
        entryPoint: "main",
      },
      fragment: {
        module: this.device.createShaderModule({
          label: "Volume Fragment Shader",
          code: volumeFragmentShader,
        }),
        entryPoint: "main",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: DEPTH_TEXTURE_FORMAT,
      },
    });
  }

  resize(width: number, height: number) {
    this.framebuffer.resize(width, height);
  }

  render(encoder: GPUCommandEncoder, clearColor: GPUColor) {
    const gpuBindGroup = this.bindGroup.getGPUBindGroup();

    const pass = encoder.beginRenderPass(
      this.framebuffer.getRenderPassDescriptor(clearColor)
    );

    if (gpuBindGroup) {
      pass.setPipeline(this.volumePipeline);
      pass.setBindGroup(0, gpuBindGroup);
      pass.draw(6);
    }

    pass.end();
  }

  destroy() {
    this.framebuffer.destroy();
  }
}
