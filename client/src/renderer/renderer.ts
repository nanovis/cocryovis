import {
  RenderingParametersBuffer,
  type RenderingParameters,
} from "./renderingParametersBuffer";
import { Camera, type CameraParams } from "./core/camera";
import { VolumeManager } from "./volume/volumeManager";
import { ClippingPlaneManager } from "./volume/clippingPlaneManager";
import { AnnotationManager } from "./annotations/annotationManager";
import { toBoolean } from "@/utils/helpers";
import { FullscreenComposite } from "./core/fullscreenComposite";
import { VolumePass } from "./volume/volumePass";
import { AnnotationMarkerRenderer } from "./annotations/annotationMarkerRenderer";

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

export type RendererCameraParameters = Omit<CameraParams, "aspectRatio">;

export class VolumeRenderer {
  static readonly REQUIRED_LIMITS: Partial<RequiredLimits> = {
    maxComputeInvocationsPerWorkgroup: 512,
  } as const;
  static readonly OPTIONAL_FEATURES: Iterable<GPUFeatureName> = [
    "texture-formats-tier2",
  ] as const;

  readonly device: GPUDevice;
  context: GPUCanvasContext | undefined;
  output: OutputInfo | undefined;
  readonly volumeManager: VolumeManager;
  readonly clippingPlaneManager: ClippingPlaneManager;
  readonly renderingParameters: RenderingParametersBuffer;
  readonly annotationManager: AnnotationManager;
  readonly camera: Camera;
  width: number;
  height: number;
  readonly format: GPUTextureFormat;
  animationFrame: number | null = null;

  private destroyed: boolean = false;
  private volumePass: VolumePass;
  private fullscreenComposite: FullscreenComposite;

  readonly annotationMarkerRenderer: AnnotationMarkerRenderer;

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

    this.volumePass = new VolumePass({
      device: this.device,
      width: this.width,
      height: this.height,
      format: this.format,
      camera: this.camera,
      volumeManager: this.volumeManager,
      annotationManager: this.annotationManager,
      renderingParameters: this.renderingParameters,
      clippingPlaneManager: this.clippingPlaneManager,
    });
    this.fullscreenComposite = new FullscreenComposite(
      this.device,
      this.format,
      this.volumePass.framebuffer
    );
    this.annotationMarkerRenderer = new AnnotationMarkerRenderer({
      device: this.device,
      format: this.format,
      camera: this.camera,
      clippingPlaneManager: this.clippingPlaneManager,
      volumeManager: this.volumeManager,
      annotationManager: this.annotationManager,
      renderingParametersBuffer: this.renderingParameters,
    });

    this.render();
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
    this.volumePass.render(encoder, this.renderingParameters.params.clearColor);

    const fullscreenPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: view,
          clearValue: this.renderingParameters.params.clearColor,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    this.fullscreenComposite.render(fullscreenPass);
    this.annotationMarkerRenderer.render(fullscreenPass);

    fullscreenPass.end();

    this.device.queue.submit([encoder.finish()]);

    this.animationFrame = requestAnimationFrame(this.render.bind(this));
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.volumePass.resize(width, height);
    this.camera.setParameters({ aspectRatio: width / height });
  }

  destroy() {
    this.destroyed = true;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.volumePass.destroy();
    this.volumeManager.destroy();
    this.camera.destroy();
    this.renderingParameters.destroy();
  }
}
