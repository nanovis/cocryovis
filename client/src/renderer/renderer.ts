import vertexShader from "../assets/shaders/volume.vs.wgsl?raw";
import fragmentShader from "../assets/shaders/volume.fs.wgsl?raw";
import { Volume } from "./volume.ts";
import { ParamData } from "./params.ts";
import { Camera, type CameraParams } from "./camera.ts";
import { ChannelData } from "./transferFunctions.ts";

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

  const device = await adapter.requestDevice(deviceOptions);

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

  clearValue: GPUColor = { r: 0.1, g: 0.1, b: 0.1, a: 1 };

  bindGroup: GPUBindGroup | undefined;
  private dirtyBindGroup: boolean = true;
  volume: Volume;
  params: ParamData;
  camera: Camera;
  channelData: ChannelData;
  width: number;
  height: number;
  format: GPUTextureFormat;
  pipeline: GPURenderPipeline | null = null;
  vertexBuffer: GPUBuffer | null = null;
  animationFrame: number | null = null;

  private depthTexture: GPUTexture | undefined;

  constructor(
    device: GPUDevice,
    cameraParams: Omit<CameraParams, "aspectRatio">,
    {
      output,
      context,
    }: {
      clearValue?: GPUColor;
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
    this.volume = new Volume(volumeSampler, () => {
      this.dirtyBindGroup = true;
    });
    this.params = new ParamData(this.device);
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

    const bindGroupLayout = this.device.createBindGroupLayout(
      bindGroupLayoutDescriptor
    );
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
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
      this.depthTexture.width !== this.width &&
      this.depthTexture.height !== this.height
    ) {
      return this.depthTexture;
    }

    this.depthTexture?.destroy();
    this.depthTexture = this.device.createTexture({
      size: [this.width, this.height],
      format: DEPTH_TEXTURE_FORMAT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    return this.depthTexture;
  }

  recreateBindGroup() {
    if (!this.pipeline) {
      return;
    }

    const volumeView = this.volume.getView();

    if (!volumeView) {
      return;
    }

    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.camera.getBuffer(),
          },
        },
        {
          binding: 2,
          resource: this.volume.sampler,
        },
        {
          binding: 3,
          resource: volumeView,
        },
        {
          binding: 8,
          resource: {
            buffer: this.params.getBuffer(),
          },
        },
        {
          binding: 9,
          resource: this.channelData.getBuffer(),
        },
      ],
    });
  }

  render() {
    if (!this.pipeline) return;

    const encoder = this.device.createCommandEncoder();
    const view =
      this.output?.outputView ?? this.context?.getCurrentTexture().createView();

    if (!view) {
      return;
    }

    this.params.updateBuffer();
    this.channelData.updateBuffer();
    this.camera.updateBuffer();

    if (!this.bindGroup || this.dirtyBindGroup) {
      this.recreateBindGroup();
    }

    if (!this.bindGroup) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: this.clearValue,
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

    if (this.vertexBuffer) {
      pass.setVertexBuffer(0, this.vertexBuffer);
      pass.draw(3);
    }

    pass.end();
    this.device.queue.submit([encoder.finish()]);

    this.animationFrame = requestAnimationFrame(this.render.bind(this));
  }

  setVertexBuffer(data: Float32Array) {
    this.vertexBuffer?.destroy();

    this.vertexBuffer = this.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Float32Array(this.vertexBuffer.getMappedRange()).set(data);
    this.vertexBuffer.unmap();
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.camera.setParameters({ aspectRatio: width / height });
  }

  destroy() {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.vertexBuffer?.destroy();
    this.vertexBuffer = null;
    this.pipeline = null;
  }
}
