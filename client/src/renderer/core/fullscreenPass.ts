import fullscreenVertexShader from "@/assets/shaders/fullscreen.vs.wgsl?raw";
import fullscreenFragmentShader from "@/assets/shaders/fullscreen.fs.wgsl?raw";

import { BindGroup } from "./bindGroup";
import type { Framebuffer } from "./framebuffer";

export class FullscreenPass {
  private readonly bindGroup: BindGroup;
  private readonly pipeline: GPURenderPipeline;

  constructor(device: GPUDevice, format: GPUTextureFormat, input: Framebuffer) {
    const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float", viewDimension: "2d" },
        },
      ],
    };

    this.bindGroup = new BindGroup(device, bindGroupLayoutDescriptor);
    this.bindGroup.setResource(0, input);
    this.bindGroup.setResource(1, input);

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroup.getBindGroupLayout()],
    });

    this.pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: device.createShaderModule({
          label: "Fullscreen Vertex Shader",
          code: fullscreenVertexShader,
        }),
        entryPoint: "main",
      },
      fragment: {
        module: device.createShaderModule({
          label: "Fullscreen Fragment Shader",
          code: fullscreenFragmentShader,
        }),
        entryPoint: "main",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });
  }

  render(
    encoder: GPUCommandEncoder,
    targetView: GPUTextureView,
    clearColor: GPUColor
  ) {
    const gpuBindGroup = this.bindGroup.getGPUBindGroup();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targetView,
          clearValue: clearColor,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    if (gpuBindGroup) {
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, gpuBindGroup);
      pass.draw(3);
    }

    pass.end();
  }
}
