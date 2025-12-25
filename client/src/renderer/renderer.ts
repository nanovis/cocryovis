import vertexShader from "../assets/shaders/volume.vs.wgsl?raw";
import fragmentShader from "../assets/shaders/volume.fs.wgsl?raw";
import { Volume } from "./volume.ts";
import { ParamData } from "./params.ts";
import { Camera, type CameraParams } from "./camera.ts";
import { ChannelData } from "./channelData.ts";
import { BindGroup } from "./bindGroup.ts";

export interface DeviceInfo {
  adapter: GPUAdapter;
  device: GPUDevice;
  context: GPUCanvasContext;
}

export interface OutputInfo {
  outputFormat: GPUTextureFormat;
  outputView: GPUTextureView;
  width: number;
  height: number;
}

export async function initializeDevice(
  canvas: HTMLCanvasElement,
  {
    adapterOptions,
    deviceOptions,
  }: {
    adapterOptions?: GPURequestAdapterOptions;
    deviceOptions?: GPUDeviceDescriptor;
  } = {}
): Promise<DeviceInfo> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported");
  }

  const adapter = await navigator.gpu.requestAdapter(adapterOptions);
  if (!adapter) {
    throw new Error("No GPU adapter found");
  }

  const requiredLimits = {
    maxTextureDimension3D: adapter.limits.maxTextureDimension3D,
    maxBufferSize: adapter.limits.maxBufferSize,
  };

  console.log("Requesting device with limits:", requiredLimits);

  const deviceDescriptor: GPUDeviceDescriptor = {
    ...deviceOptions,
    requiredLimits: { ...requiredLimits },
  };

  const device = await adapter.requestDevice(deviceDescriptor);

  console.log("Obtained device with limits:", device.limits);

  const context = canvas.getContext("webgpu");

  if (!context) {
    throw new Error("WebGPU not supported");
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: "opaque",
  });

  return { adapter, device, context };
}

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
      binding: 8,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" },
    },
    {
      binding: 9,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: "read-only-storage" },
    },
  ],
};

const DEPTH_TEXTURE_FORMAT: GPUTextureFormat = "depth24plus";

export class VolumeRenderer {
  device: GPUDevice;
  context: GPUCanvasContext | undefined;
  output: OutputInfo | undefined;
  volume: Volume;
  paramData: ParamData;
  camera: Camera;
  channelData: ChannelData;
  width: number;
  height: number;
  format: GPUTextureFormat;
  pipeline: GPURenderPipeline;
  animationFrame: number | null = null;

  private depthTexture: GPUTexture | undefined;

  private destroyed: boolean = false;

  private bindGroup: BindGroup;

  constructor(
    device: GPUDevice,
    cameraParams: Omit<CameraParams, "aspectRatio">,
    {
      output,
      context,
    }: {
      output?: OutputInfo;
      context?: GPUCanvasContext;
    } = {}
  ) {
    this.device = device;
    this.context = context;
    this.output = output;

    if (output) {
      this.width = output.width;
      this.height = output.height;
      this.format = output.outputFormat;
    } else if (context) {
      this.width = context.canvas.width;
      this.height = context.canvas.height;
      this.format = navigator.gpu.getPreferredCanvasFormat();
    } else {
      throw new Error("Either context or output information must be provided");
    }

    const volumeSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
    });
    this.volume = new Volume(this.device, volumeSampler);
    this.paramData = new ParamData(this.device);
    this.channelData = new ChannelData(this.device);

    this.camera = new Camera(this.device, {
      ...cameraParams,
      aspectRatio: this.width / this.height,
    });

    const vertexShaderModule = this.device.createShaderModule({
      code: vertexShader,
    });

    const fragmentShaderModule = this.device.createShaderModule({
      code: fragmentShader,
    });

    this.bindGroup = new BindGroup(this.device, bindGroupLayoutDescriptor);
    this.bindGroup.setResource(0, this.camera);
    this.bindGroup.setResource(2, this.volume);
    this.bindGroup.setResource(3, this.volume);
    this.bindGroup.setResource(8, this.paramData);
    this.bindGroup.setResource(9, this.channelData);

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroup.getBindGroupLayout()],
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: vertexShaderModule,
        entryPoint: "main",
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "main",
        targets: [{ format: this.format }],
      },
      primitive: { topology: "triangle-list" },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: DEPTH_TEXTURE_FORMAT,
      },
    });

    this.render();
  }

  getDepthTexture(): GPUTexture {
    if (
      this.depthTexture &&
      this.depthTexture.width === this.width &&
      this.depthTexture.height === this.height
    ) {
      return this.depthTexture;
    }

    this.depthTexture?.destroy();
    this.depthTexture = this.device.createTexture({
      label: "Depth Texture",
      size: [this.width, this.height],
      format: DEPTH_TEXTURE_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    return this.depthTexture;
  }

  render() {
    if (this.destroyed) {
      return;
    }

    const encoder = this.device.createCommandEncoder();
    const view =
      this.output?.outputView ?? this.context?.getCurrentTexture().createView();

    if (!view) {
      return;
    }

    this.paramData.updateBuffer();
    this.channelData.updateBuffer();
    this.camera.updateBuffer();

    const gpuBindGroup = this.bindGroup.getGPUBindGroup();

    if (!gpuBindGroup) {
      this.renderEmpty();
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: this.paramData.params.clearColor,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.getDepthTexture(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      },
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, gpuBindGroup);

    pass.draw(6);

    pass.end();
    this.device.queue.submit([encoder.finish()]);

    this.animationFrame = requestAnimationFrame(this.render.bind(this));
  }

  renderEmpty() {
    const encoder = this.device.createCommandEncoder();
    const view =
      this.output?.outputView ?? this.context?.getCurrentTexture().createView();

    if (!view) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: this.paramData.params.clearColor,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.getDepthTexture(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      },
    });

    pass.end();
    this.device.queue.submit([encoder.finish()]);

    this.animationFrame = requestAnimationFrame(this.render.bind(this));
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.camera.setParameters({ aspectRatio: width / height });
  }

  destroy() {
    this.destroyed = true;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.depthTexture?.destroy();
    this.volume.destroy();
    this.camera.destroy();
    this.paramData.destroy();
    this.channelData.destroy();
  }
}
