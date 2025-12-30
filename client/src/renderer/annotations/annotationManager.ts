import annotateComputeShader from "../../assets/shaders/annotate.comp.wgsl?raw";
import clear3dComputeShader from "../../assets/shaders/clear3d.comp.wgsl?raw";

import { BindGroup } from "../bindGroup.ts";
import { AnnotationParametersBuffer } from "./annotationParametersBuffer.ts";
import { AnnotationVolume } from "./annotationVolume.ts";
import type { VolumeManager } from "../volumeManager.ts";
import { mat4, vec3, vec4 } from "gl-matrix";
import type { Camera } from "../camera.ts";
import { intersectRayPlane } from "../math.ts";
import type { ClippingPlaneManager } from "../clippingPlaneManager.ts";
import type { RenderingParametersBuffer } from "../renderingParametersBuffer.ts";
import { AnnotationsDataBuffer } from "./annotationsDataBuffer.ts";

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

export class AnnotationManager {
  private static readonly ANNOTATE_WORKGROUP_SIZE = 4;
  private static readonly CLEAR_WORKGROUP_SIZE = 4;
  private static readonly EPSILON = 0.002;

  private readonly device: GPUDevice;
  private volumeManager: VolumeManager;
  private camera: Camera;
  private clippingPlaneManager: ClippingPlaneManager;
  private renderingParametersBuffer: RenderingParametersBuffer;

  readonly annotationParameterBuffer: AnnotationParametersBuffer;
  readonly annotationsDataBuffer: AnnotationsDataBuffer;
  private readonly annotationBindGroups: [BindGroup, BindGroup];
  readonly annotationVolumes: [AnnotationVolume, AnnotationVolume];
  private readonly annotatePipeline: GPUComputePipeline;
  private readonly clear3dPipeline: GPUComputePipeline;
  private ping: boolean = true;

  private previousMousePosition: { x: number; y: number } | undefined;

  constructor(
    device: GPUDevice,
    volumeManager: VolumeManager,
    camera: Camera,
    clippingPlaneManager: ClippingPlaneManager,
    renderingParametersBuffer: RenderingParametersBuffer
  ) {
    this.device = device;
    this.volumeManager = volumeManager;
    this.camera = camera;
    this.clippingPlaneManager = clippingPlaneManager;
    this.renderingParametersBuffer = renderingParametersBuffer;

    this.annotationParameterBuffer = new AnnotationParametersBuffer(device);
    this.annotationsDataBuffer = new AnnotationsDataBuffer(device);

    this.annotationVolumes = [
      new AnnotationVolume(device, volumeManager, "Annotation Volume Ping"),
      new AnnotationVolume(device, volumeManager, "Annotation Volume Pong"),
    ];

    this.annotationBindGroups = [
      this.setupBindGroup(this.annotationVolumes[1], this.annotationVolumes[0]),
      this.setupBindGroup(this.annotationVolumes[0], this.annotationVolumes[1]),
    ];

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.annotationBindGroups[0].getBindGroupLayout()],
    });

    this.annotatePipeline = this.device.createComputePipeline({
      label: "Annotation Compute Pipeline",
      layout: pipelineLayout,
      compute: {
        module: device.createShaderModule({
          label: "Annotation Compute Shader",
          code: annotateComputeShader,
        }),
      },
    });

    this.clear3dPipeline = this.device.createComputePipeline({
      label: "Clear 3D Compute Pipeline",
      layout: pipelineLayout,
      compute: {
        module: device.createShaderModule({
          label: "Clear 3D Compute Shader",
          code: clear3dComputeShader,
        }),
      },
    });
  }

  private setupBindGroup(
    readVolume: AnnotationVolume,
    writeVolume: AnnotationVolume
  ) {
    const bindGroup = new BindGroup(this.device, bindGroupLayoutDescriptor);
    bindGroup.setResource(0, this.annotationParameterBuffer);
    bindGroup.setResource(1, writeVolume);
    bindGroup.setResource(2, readVolume);
    return bindGroup;
  }

  getReadTexture() {
    return this.annotationVolumes[this.ping ? 0 : 1].getTexture();
  }

  getWriteTexture() {
    return this.annotationVolumes[this.ping ? 0 : 1].getTexture();
  }

  computeBlockSizeFromKernel(kernelSize: number) {
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
      pingPong: this.ping,
      addAnnotation: addAnnotation,
      annotationVolume: volumeIndex,
    });

    const pingPongIndex = this.ping ? 0 : 1;

    const gpuBindGroup =
      this.annotationBindGroups[pingPongIndex].getGPUBindGroup();

    if (!gpuBindGroup) {
      return;
    }

    const kernelSize = this.annotationParameterBuffer.getKernelSize();
    const numBlocksX = this.computeBlockSizeFromKernel(kernelSize[0]);
    const numBlocksY = this.computeBlockSizeFromKernel(kernelSize[1]);
    const numBlocksZ = this.computeBlockSizeFromKernel(kernelSize[2]);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    pass.setPipeline(this.annotatePipeline);
    pass.setBindGroup(0, gpuBindGroup);
    pass.dispatchWorkgroups(numBlocksX, numBlocksY, numBlocksZ);

    pass.end();

    this.device.queue.submit([encoder.finish()]);

    this.ping = !this.ping;
    this.renderingParametersBuffer.set({
      annotationPingPong: this.ping,
    });
  }

  computeBlockSizeFromVolumeSize(volumeSize: number) {
    return Math.ceil(volumeSize / AnnotationManager.CLEAR_WORKGROUP_SIZE);
  }

  private clearAnnotationsVolume(
    annotationVolumeIndex: 0 | 1,
    channelIndex: number
  ) {
    const volumeTexture = this.volumeManager.volume.getTexture();
    if (!volumeTexture) {
      return;
    }

    const gpuBindGroup =
      this.annotationBindGroups[annotationVolumeIndex].getGPUBindGroup();

    if (!gpuBindGroup) {
      return;
    }

    const numBlocksX = this.computeBlockSizeFromVolumeSize(volumeTexture.width);
    const numBlocksY = this.computeBlockSizeFromVolumeSize(
      volumeTexture.height
    );
    const numBlocksZ = this.computeBlockSizeFromVolumeSize(
      volumeTexture.depthOrArrayLayers
    );

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

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();

    pass.setPipeline(this.clear3dPipeline);
    pass.setBindGroup(0, gpuBindGroup);
    pass.dispatchWorkgroups(numBlocksX, numBlocksY, numBlocksZ);

    pass.setBindGroup(1, gpuBindGroup);
    pass.dispatchWorkgroups(numBlocksX, numBlocksY, numBlocksZ);

    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  clearAnnotations(channelIndex: number) {
    this.clearAnnotationsVolume(0, channelIndex);
    this.clearAnnotationsVolume(1, channelIndex);
  }
}
