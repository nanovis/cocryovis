import volumeVertexShader from "@/assets/shaders/volume.vs.wgsl?raw";
import volumeFragmentShader from "@/assets/shaders/volume.fs.wgsl?raw";
import {
  RenderingParametersBuffer,
  type RenderingParameters,
} from "./renderingParametersBuffer";
import { Camera, type CameraParams } from "./core/camera";
import { BindGroup } from "./core/bindGroup";
import { VolumeManager } from "./volume/volumeManager";
import { ClippingPlaneManager } from "./volume/clippingPlaneManager";
import { AnnotationManager } from "./annotations/annotationManager";
import { toBoolean } from "@/utils/helpers";

export interface OutputInfo {
  outputFormat: GPUTextureFormat;
  outputView: GPUTextureView;
  width: number;
  height: number;
}

type RequiredLimits = Omit<GPUSupportedLimits, "__brand">;

export async function obtainDevice({
  adapterOptions,
  deviceOptions,
}: {
  adapterOptions?: GPURequestAdapterOptions;
  deviceOptions?: GPUDeviceDescriptor;
} = {}): Promise<{ adapter: GPUAdapter; device: GPUDevice }> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (toBoolean(import.meta.env.VITE_NO_WEBGPU) || !navigator.gpu) {
    throw new Error("WebGPU is not supported.");
  }

  const adapter = await navigator.gpu.requestAdapter(adapterOptions);
  if (!adapter) {
    throw new Error("No GPU adapter found.");
  }

  // TODO Make some sort of global define for this
  const requiredLimits: Partial<RequiredLimits> = {
    maxTextureDimension3D: adapter.limits.maxTextureDimension3D,
    maxBufferSize: adapter.limits.maxBufferSize,
    ...VolumeRenderer.REQUIRED_LIMITS,
  };

  let device: GPUDevice | undefined;

  const baseRequiredLimits: Partial<RequiredLimits> =
    deviceOptions?.requiredLimits ?? {};
  const baseFeatures: Iterable<GPUFeatureName> =
    deviceOptions?.requiredFeatures ?? [];

  const potentialRequiredLimits: Partial<RequiredLimits>[] = [
    {
      ...baseRequiredLimits,
      ...requiredLimits,
    },
  ];
  const potentialRequiredFeatures: Array<GPUFeatureName[]> = [
    [...baseFeatures, ...VolumeRenderer.OPTIONAL_FEATURES],
    [...baseFeatures],
  ];

  const deviceDescriptors: GPUDeviceDescriptor[] = [];
  for (const requiredLimits of potentialRequiredLimits) {
    for (const requiredFeatures of potentialRequiredFeatures) {
      deviceDescriptors.push({
        ...deviceOptions,
        requiredLimits,
        requiredFeatures,
      });
    }
  }

  for (const deviceDescriptor of deviceDescriptors) {
    try {
      console.log("Requesting device with limits:", deviceDescriptor);
      device = await adapter.requestDevice(deviceDescriptor);
      break;
    } catch (e) {
      if (e instanceof TypeError) {
        continue;
      }
      throw e;
    }
  }

  if (!device) {
    throw new Error("No GPU device with the required limits could be created.");
  }

  console.log(
    "Obtained device with limits:",
    device.limits,
    "and features",
    Array.from(device.features.values())
  );

  return { adapter, device };
}

export function obtainContext(
  device: GPUDevice,
  canvas: HTMLCanvasElement
): GPUCanvasContext {
  const context = canvas.getContext("webgpu");

  if (!context) {
    throw new Error(
      "Failed to initialize the WebGPU context, please refresh the page."
    );
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: "opaque",
  });

  return context;
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
      binding: 4,
      visibility: GPUShaderStage.FRAGMENT,
      texture: { sampleType: "float", viewDimension: "3d" },
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

const DEPTH_TEXTURE_FORMAT: GPUTextureFormat = "depth24plus";

export type RendererCameraParameters = Omit<CameraParams, "aspectRatio">;

export class VolumeRenderer {
  static readonly REQUIRED_LIMITS: Partial<RequiredLimits> = {
    maxComputeInvocationsPerWorkgroup: 512,
  } as const;
  static readonly OPTIONAL_FEATURES: Iterable<GPUFeatureName> = [
    "texture-formats-tier2",
  ] as const;

  device: GPUDevice;
  context: GPUCanvasContext | undefined;
  output: OutputInfo | undefined;
  volumeManager: VolumeManager;
  clippingPlaneManager: ClippingPlaneManager;
  renderingParameters: RenderingParametersBuffer;
  annotationManager: AnnotationManager;
  camera: Camera;
  width: number;
  height: number;
  format: GPUTextureFormat;
  volumePipeline: GPURenderPipeline;
  animationFrame: number | null = null;

  private depthTexture: GPUTexture | undefined;

  private destroyed: boolean = false;

  private bindGroup: BindGroup;

  constructor(
    device: GPUDevice,
    cameraParams: RendererCameraParameters,
    {
      output,
      context,
      parameters,
      forceWriteOnlyAnnotations,
    }: {
      output?: OutputInfo;
      context?: GPUCanvasContext;
      parameters?: Partial<RenderingParameters>;
      forceWriteOnlyAnnotations?: boolean;
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
    this.camera = new Camera(this.device, {
      ...cameraParams,
      aspectRatio: this.width / this.height,
    });
    this.renderingParameters = new RenderingParametersBuffer(
      this.device,
      parameters
    );
    this.volumeManager = new VolumeManager(this.device);
    this.clippingPlaneManager = new ClippingPlaneManager(
      this.device,
      this.camera,
      this.volumeManager
    );
    this.annotationManager = new AnnotationManager(
      this.device,
      this.volumeManager,
      this.camera,
      this.clippingPlaneManager,
      this.renderingParameters,
      forceWriteOnlyAnnotations
    );

    this.bindGroup = new BindGroup(this.device, bindGroupLayoutDescriptor);
    this.bindGroup.setResource(0, this.camera);
    this.bindGroup.setResource(2, this.volumeManager.volume);
    this.bindGroup.setResource(3, this.volumeManager.volume);
    this.bindGroup.setResource(4, this.annotationManager.getAnnotationVolume());
    this.bindGroup.setResource(6, this.annotationManager.annotationsDataBuffer);
    this.bindGroup.setResource(7, this.volumeManager.volumeParameterBuffer);
    this.bindGroup.setResource(8, this.renderingParameters);
    this.bindGroup.setResource(9, this.volumeManager.channelData);
    this.bindGroup.setResource(
      10,
      this.clippingPlaneManager.clippingParametersBuffer
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
      this.depthTexture?.width === this.width &&
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

    this.clippingPlaneManager.update();

    const gpuBindGroup = this.bindGroup.getGPUBindGroup();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: this.renderingParameters.params.clearColor,
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

    if (gpuBindGroup) {
      pass.setPipeline(this.volumePipeline);
      pass.setBindGroup(0, gpuBindGroup);

      pass.draw(6);
    }

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
    this.volumeManager.destroy();
    this.camera.destroy();
    this.renderingParameters.destroy();
  }
}
