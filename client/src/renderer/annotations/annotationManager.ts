import annotateShader from "@/assets/shaders/annotate.comp.wgsl?raw";
import copyKernelShader from "@/assets/shaders/copy_kernel.comp.wgsl?raw";
import clear3dShader from "@/assets/shaders/clear3d.comp.wgsl?raw";
import annotateReadWriteShader from "@/assets/shaders/annotate_readwrite.comp.wgsl?raw";
import clear3dReadWriteShader from "@/assets/shaders/clear3d_readwrite.comp.wgsl?raw";

import { BindGroup } from "../core/bindGroup";
import { AnnotationParametersBuffer } from "./annotationParametersBuffer";
import { AnnotationVolume } from "./annotationVolume";
import type { VolumeManager } from "../volume/volumeManager";
import { mat4, vec3, vec4 } from "gl-matrix";
import type { Camera } from "../core/camera";
import { intersectRayPlane } from "../utilities/math";
import type { ClippingPlaneManager } from "../volume/clippingPlaneManager";
import type { RenderingParametersBuffer } from "../renderingParametersBuffer";
import { AnnotationsDataBuffer } from "./annotationsDataBuffer";
import { readChannelFromRGBA3DTexture } from "@/renderer/utilities/export";

const bindGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: "uniform" },
    },
    {
      binding: 1,
      visibility: GPUShaderStage.COMPUTE,
      storageTexture: {
        access: "write-only",
        format: "rgba8unorm",
        viewDimension: "3d",
      },
    },
    {
      binding: 2,
      visibility: GPUShaderStage.COMPUTE,
      texture: { sampleType: "float", viewDimension: "3d" },
    },
  ],
};

const readWriteGroupLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.COMPUTE,
      buffer: { type: "uniform" },
    },
    {
      binding: 1,
      visibility: GPUShaderStage.COMPUTE,
      storageTexture: {
        access: "read-write",
        format: "rgba8unorm",
        viewDimension: "3d",
      },
    },
  ],
};

export class AnnotationManager {
  private static readonly ANNOTATE_WORKGROUP_SIZE = 4;
  private static readonly CLEAR_WORKGROUP_SIZE = 4;
  private static readonly EPSILON = 0.002;

  private readonly readwrite: boolean;

  private readonly device: GPUDevice;
  private volumeManager: VolumeManager;
  private camera: Camera;
  private clippingPlaneManager: ClippingPlaneManager;
  private renderingParametersBuffer: RenderingParametersBuffer;

  readonly annotationParameterBuffer: AnnotationParametersBuffer;
  readonly annotationsDataBuffer: AnnotationsDataBuffer;

  private readonly annotateBindGroup: BindGroup;
  private readonly copyKernelBindGroup: BindGroup | undefined;

  readonly pingVolume: AnnotationVolume;
  readonly pongVolume: AnnotationVolume | undefined;

  private readonly annotatePipeline: GPUComputePipeline;
  private readonly copyKernelPipeline: GPUComputePipeline | undefined;
  private readonly clear3dPipeline: GPUComputePipeline;

  private previousMousePosition: { x: number; y: number } | undefined;

  constructor(
    device: GPUDevice,
    volumeManager: VolumeManager,
    camera: Camera,
    clippingPlaneManager: ClippingPlaneManager,
    renderingParametersBuffer: RenderingParametersBuffer,
    forceWriteOnlyPipeline: boolean = false
  ) {
    this.readwrite =
      !forceWriteOnlyPipeline &&
      device.features.has("texture-formats-tier2") &&
      navigator.gpu.wgslLanguageFeatures.has(
        "readonly_and_readwrite_storage_textures"
      );
    console.log(
      "Annotation pipeline variant: ",
      this.readwrite ? "Read-Write" : "Write-Only"
    );

    this.device = device;
    this.volumeManager = volumeManager;
    this.camera = camera;
    this.clippingPlaneManager = clippingPlaneManager;
    this.renderingParametersBuffer = renderingParametersBuffer;

    this.annotationParameterBuffer = new AnnotationParametersBuffer(device);
    this.annotationsDataBuffer = new AnnotationsDataBuffer(device);

    this.pingVolume = new AnnotationVolume(
      device,
      volumeManager,
      "Annotation Volume Ping"
    );
    this.pongVolume = new AnnotationVolume(
      device,
      volumeManager,
      "Annotation Volume Pong"
    );

    this.annotateBindGroup = this.createAnnotateBindGroup();

    const pipelineLayout = device.createPipelineLayout({
      label: "Annotation Pipeline Layout",
      bindGroupLayouts: [this.annotateBindGroup.getBindGroupLayout()],
    });

    this.annotatePipeline = this.device.createComputePipeline({
      label: "Annotation Compute Pipeline",
      layout: pipelineLayout,
      compute: {
        module: device.createShaderModule({
          label: "Annotation Compute Shader",
          code: this.readwrite ? annotateReadWriteShader : annotateShader,
        }),
      },
    });

    this.clear3dPipeline = this.device.createComputePipeline({
      label: "Clear 3D Compute Pipeline",
      layout: pipelineLayout,
      compute: {
        module: device.createShaderModule({
          label: "Clear 3D Compute Shader",
          code: this.readwrite ? clear3dReadWriteShader : clear3dShader,
        }),
      },
    });

    if (!this.readwrite) {
      this.copyKernelBindGroup = new BindGroup(
        this.device,
        bindGroupLayoutDescriptor
      );
      this.copyKernelBindGroup.setResource(0, this.annotationParameterBuffer);
      this.copyKernelBindGroup.setResource(1, this.pingVolume);
      this.copyKernelBindGroup.setResource(2, this.pongVolume);

      this.copyKernelPipeline = this.device.createComputePipeline({
        label: "Copy Kernel Compute Pipeline",
        layout: device.createPipelineLayout({
          label: "Copy Kernel Pipeline Layout",
          bindGroupLayouts: [this.copyKernelBindGroup.getBindGroupLayout()],
        }),
        compute: {
          module: device.createShaderModule({
            label: "Copy Kernel Compute Shader",
            code: copyKernelShader,
          }),
        },
      });
    }
  }

  private createAnnotateBindGroup() {
    if (this.readwrite) {
      const bindGroup = new BindGroup(
        this.device,
        readWriteGroupLayoutDescriptor
      );
      bindGroup.setResource(0, this.annotationParameterBuffer);
      bindGroup.setResource(1, this.pingVolume);
      return bindGroup;
    } else {
      if (!this.pongVolume) {
        throw new Error(
          "Without read write storage textures, annotation requires pong volume"
        );
      }
      const bindGroup = new BindGroup(this.device, bindGroupLayoutDescriptor);
      bindGroup.setResource(0, this.annotationParameterBuffer);
      bindGroup.setResource(1, this.pongVolume);
      bindGroup.setResource(2, this.pingVolume);
      return bindGroup;
    }
  }

  getAnnotationVolume() {
    return this.pingVolume;
  }

  private computeBlockSizeFromKernel(kernelSize: number) {
    return Math.ceil(
      (kernelSize * 2 + 1) / AnnotationManager.ANNOTATE_WORKGROUP_SIZE
    );
  }

  /**
   * mouseX and mouseY should be in UV coordinates, i.e., in the range [0, 1], where (0,0) is the top-left corner.
   */
  processAnnotation(
    mouseX: number,
    mouseY: number,
    addAnnotation: boolean,
    volumeIndex: number
  ) {
    if (
      !this.renderingParametersBuffer.annotationsEnabled() ||
      this.clippingPlaneManager.getClippingPlaneType() === "none"
    )
      return;

    if (volumeIndex >= this.volumeManager.channelData.numberOfChannels) {
      console.warn("Attempting to annotate a non-existing volume");
      return;
    }

    if (
      this.previousMousePosition !== undefined &&
      Math.abs(mouseX - this.previousMousePosition.x) <
        AnnotationManager.EPSILON &&
      Math.abs(mouseY - this.previousMousePosition.y) <
        AnnotationManager.EPSILON
    ) {
      return;
    }

    this.previousMousePosition = { x: mouseX, y: mouseY };

    const ndcX = 2 * mouseX - 1;
    const ndcY = 1 - 2 * mouseY;

    const near = vec4.fromValues(ndcX, ndcY, 0, 1);
    const far = vec4.fromValues(ndcX, ndcY, 1, 1);

    const viewMatrix = this.camera.getViewMatrix().viewMatrix;
    const projectionMatrix = this.camera.getProjectionMatrix();

    const invViewProj = mat4.invert(
      mat4.create(),
      mat4.multiply(mat4.create(), projectionMatrix, viewMatrix)
    );

    if (invViewProj === null) {
      console.warn("Failed to invert view projection matrix");
      return;
    }

    vec4.transformMat4(near, near, invViewProj);
    vec4.transformMat4(far, far, invViewProj);

    for (const p of [near, far]) {
      p[0] /= p[3];
      p[1] /= p[3];
      p[2] /= p[3];
      p[3] = 1;
    }

    const rayOrigin = vec3.fromValues(near[0], near[1], near[2]);
    const rayDir = vec3.normalize(
      vec3.create(),
      vec3.sub(
        vec3.create(),
        vec3.fromValues(far[0], far[1], far[2]),
        rayOrigin
      )
    );

    const clippingPlaneBuffer =
      this.clippingPlaneManager.clippingParametersBuffer;
    const t = intersectRayPlane(
      rayOrigin,
      rayDir,
      clippingPlaneBuffer.clippingPlaneOrigin,
      clippingPlaneBuffer.clippingPlaneNormal
    );

    if (t === undefined) {
      return;
    }

    const ratio = this.volumeManager.channelData.getParameters(0).ratio;
    // const ratio = [1, 1, 1];

    const vertex = vec3.scaleAndAdd(vec3.create(), rayOrigin, rayDir, t);
    vertex[0] = (vertex[0] / ratio[0]) * 0.5 + 0.5;
    vertex[1] = (vertex[1] / ratio[1]) * 0.5 + 0.5;
    vertex[2] = (vertex[2] / ratio[2]) * 0.5 + 0.5;

    this.applyAnnotation(vertex, addAnnotation, volumeIndex);
  }

  private applyAnnotation(
    vertex: vec3,
    addAnnotation: boolean,
    volumeIndex: number
  ) {
    if (
      vertex[0] < 0 ||
      vertex[1] < 0 ||
      vertex[2] < 0 ||
      vertex[0] > 1 ||
      vertex[1] > 1 ||
      vertex[2] > 1
    ) {
      return;
    }

    if (volumeIndex >= this.volumeManager.channelData.numberOfChannels) {
      console.warn("Attempting to annotate a non-existing volume");
      return;
    }

    this.annotationParameterBuffer.set({
      vertex: vec4.fromValues(vertex[0], vertex[1], vertex[2], 0),
      addAnnotation: addAnnotation,
      annotationVolume: volumeIndex,
    });

    const annotateBindGroup = this.annotateBindGroup.getGPUBindGroup();
    const copyKernelBindGroup = this.copyKernelBindGroup?.getGPUBindGroup();

    if (!annotateBindGroup || (!this.readwrite && !copyKernelBindGroup)) {
      return;
    }

    const kernelSize = this.annotationParameterBuffer.getKernelSize();
    const numBlocksX = this.computeBlockSizeFromKernel(kernelSize[0]);
    const numBlocksY = this.computeBlockSizeFromKernel(kernelSize[1]);
    const numBlocksZ = this.computeBlockSizeFromKernel(kernelSize[2]);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    pass.setPipeline(this.annotatePipeline);
    pass.setBindGroup(0, annotateBindGroup);
    pass.dispatchWorkgroups(numBlocksX, numBlocksY, numBlocksZ);

    if (!this.readwrite) {
      if (!this.copyKernelPipeline) {
        throw new Error("Copy kernel pipeline not found");
      }
      pass.setPipeline(this.copyKernelPipeline);
      pass.setBindGroup(0, copyKernelBindGroup);
      pass.dispatchWorkgroups(numBlocksX, numBlocksY, numBlocksZ);
    }

    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  private computeBlockSizeFromVolumeSize(volumeSize: number) {
    return Math.ceil(volumeSize / AnnotationManager.CLEAR_WORKGROUP_SIZE);
  }

  clearAnnotations(channelIndex: number) {
    const volumeTexture = this.volumeManager.volume.getTexture();
    if (!volumeTexture) {
      return;
    }

    if (channelIndex == -1) {
      this.annotationParameterBuffer.set({
        clearMask: vec4.fromValues(1, 1, 1, 1),
      });
    } else {
      const clearMask = vec4.fromValues(0, 0, 0, 0);
      clearMask[channelIndex] = 1;
      this.annotationParameterBuffer.set({
        clearMask: clearMask,
      });
    }

    const annotateBindGroup = this.annotateBindGroup.getGPUBindGroup();

    // This is probably not the best idea, but lets assume those bind groups stay aligned
    const copyKernelBindGroup = this.copyKernelBindGroup?.getGPUBindGroup();

    if (!annotateBindGroup || (!this.readwrite && !copyKernelBindGroup)) {
      return;
    }

    const numBlocksX = this.computeBlockSizeFromVolumeSize(volumeTexture.width);
    const numBlocksY = this.computeBlockSizeFromVolumeSize(
      volumeTexture.height
    );
    const numBlocksZ = this.computeBlockSizeFromVolumeSize(
      volumeTexture.depthOrArrayLayers
    );

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    pass.setPipeline(this.clear3dPipeline);
    pass.setBindGroup(0, annotateBindGroup);
    pass.dispatchWorkgroups(numBlocksX, numBlocksY, numBlocksZ);

    if (!this.readwrite) {
      pass.setBindGroup(1, copyKernelBindGroup);
      pass.dispatchWorkgroups(numBlocksX, numBlocksY, numBlocksZ);
    }

    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  async exportAnnotation(channelIndex: number) {
    const volumeTexture = this.getAnnotationVolume().getTexture();
    if (!volumeTexture) {
      return;
    }
    return await readChannelFromRGBA3DTexture(
      this.device,
      volumeTexture,
      channelIndex
    );
  }
}
