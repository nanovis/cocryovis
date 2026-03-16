import annotationMarkerVertexShader from "@/assets/shaders/annotation_marker.vs.wgsl?raw";
import annotationMarkerFragmentShader from "@/assets/shaders/annotation_marker.fs.wgsl?raw";

import { BindGroup } from "../core/bindGroup";
import type { Camera } from "../core/camera";
import type { ClippingPlaneManager } from "../volume/clippingPlaneManager";
import { AnnotationMarkerBuffer } from "./annotationMarkerBuffer";
import { vec3 } from "gl-matrix";
import { findRayPlaneIntersection, unproject } from "../utilities/math";
import type { VolumeManager } from "../volume/volumeManager";
import type { AnnotationManager } from "./annotationManager";
import type { RenderingParametersBuffer } from "../renderingParametersBuffer";

const annotationMarkerLayoutDescriptor: GPUBindGroupLayoutDescriptor = {
  entries: [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: "uniform" },
    },
    {
      binding: 1,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: "uniform" },
    },
    {
      binding: 2,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: { type: "uniform" },
    },
  ],
};

export class AnnotationMarkerRenderer {
  private readonly device: GPUDevice;
  private readonly camera: Camera;

  private readonly annotationMarkerBindGroup: BindGroup;
  private readonly annotationMarkerPipeline: GPURenderPipeline;
  private readonly annotationMarkerBuffer: AnnotationMarkerBuffer;
  private readonly renderingParametersBuffer: RenderingParametersBuffer;

  private readonly clippingPlaneManager: ClippingPlaneManager;
  private readonly volumeManager: VolumeManager;
  private readonly annotationManager: AnnotationManager;

  private mouseX: number | null = null;
  private mouseY: number | null = null;

  constructor({
    device,
    format,
    camera,
    clippingPlaneManager,
    volumeManager,
    annotationManager,
    renderingParametersBuffer,
  }: {
    device: GPUDevice;
    format: GPUTextureFormat;
    camera: Camera;
    clippingPlaneManager: ClippingPlaneManager;
    volumeManager: VolumeManager;
    annotationManager: AnnotationManager;
    renderingParametersBuffer: RenderingParametersBuffer;
  }) {
    this.device = device;
    this.camera = camera;
    this.clippingPlaneManager = clippingPlaneManager;
    this.volumeManager = volumeManager;
    this.annotationManager = annotationManager;
    this.renderingParametersBuffer = renderingParametersBuffer;

    this.annotationMarkerBuffer = new AnnotationMarkerBuffer(device);

    this.annotationMarkerBindGroup = new BindGroup(
      this.device,
      annotationMarkerLayoutDescriptor
    );
    this.annotationMarkerBindGroup.setResource(0, camera);
    this.annotationMarkerBindGroup.setResource(
      1,
      clippingPlaneManager.clippingParametersBuffer
    );
    this.annotationMarkerBindGroup.setResource(2, this.annotationMarkerBuffer);

    this.annotationMarkerPipeline = this.device.createRenderPipeline({
      label: "Annotation Marker Render Pipeline",
      layout: device.createPipelineLayout({
        label: "Annotation Marker Pipeline Layout",
        bindGroupLayouts: [this.annotationMarkerBindGroup.getBindGroupLayout()],
      }),
      vertex: {
        module: this.device.createShaderModule({
          label: "Annotation Marker Vertex Shader",
          code: annotationMarkerVertexShader,
        }),
        entryPoint: "main",
      },
      fragment: {
        module: this.device.createShaderModule({
          label: "Annotation Marker Fragment Shader",
          code: annotationMarkerFragmentShader,
        }),
        entryPoint: "main",
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-strip",
      },
    });
  }

  setMousePosition(x: number, y: number) {
    this.mouseX = x;
    this.mouseY = y;
  }

  update() {
    if (
      this.mouseX === null ||
      this.mouseY === null ||
      !this.volumeManager.settings
    ) {
      return;
    }

    const ndcX = 2 * this.mouseX - 1;
    const ndcY = 1 - 2 * this.mouseY;

    const invViewProj =
      this.camera.getViewProjectionMatrix().inverseViewProjMatrix;

    let near!: vec3;
    let far!: vec3;

    try {
      near = unproject(ndcX, ndcY, 0, invViewProj);
      far = unproject(ndcX, ndcY, 1, invViewProj);
    } catch {
      return;
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

    const intersection = findRayPlaneIntersection(
      rayOrigin,
      rayDir,
      clippingPlaneBuffer.params.clippingPlaneOrigin,
      clippingPlaneBuffer.params.clippingPlaneNormal
    );

    if (intersection === undefined || intersection.backface) {
      this.mouseX = null;
      this.mouseY = null;
      return;
    }

    const vertex = intersection.point;

    const ratio = this.volumeManager.getRatio();
    if (!ratio) {
      return;
    }

    const scaledVertex = vec3.fromValues(
      vertex[0] / ratio.x,
      vertex[1] / ratio.y,
      vertex[2] / ratio.z
    );

    if (
      scaledVertex[0] < -1 ||
      scaledVertex[0] > 1 ||
      scaledVertex[1] < -1 ||
      scaledVertex[1] > 1 ||
      scaledVertex[2] < -1 ||
      scaledVertex[2] > 1
    ) {
      this.mouseX = null;
      this.mouseY = null;
      return;
    }

    const voxelToWorld = this.volumeManager.getVoxelToWorld();
    if (!voxelToWorld) {
      return;
    }

    const kernelSize =
      this.annotationManager.annotationParameterBuffer.params.kernelSize;

    const worldKernalSize = vec3.fromValues(
      voxelToWorld * kernelSize[0],
      voxelToWorld * kernelSize[1],
      voxelToWorld * kernelSize[2]
    );

    const activeLabelIndex = this.annotationManager.activeLabelIndex;
    let color: vec3 | undefined;
    try {
      color =
        this.annotationManager.annotationsDataBuffer.get(
          activeLabelIndex
        ).color;
    } catch (e) {
      console.warn(
        "Failed to get annotation color for label index",
        activeLabelIndex,
        e
      );
    }

    this.annotationMarkerBuffer.set({
      center: vec3.fromValues(vertex[0], vertex[1], vertex[2]),
      kernelSize: worldKernalSize,
      ratio: vec3.fromValues(ratio.x, ratio.y, ratio.z),
      color: color ? vec3.clone(color) : vec3.fromValues(1, 0, 0),
    });
  }

  render(pass: GPURenderPassEncoder) {
    if (
      !this.renderingParametersBuffer.params.enableAnnotations ||
      this.clippingPlaneManager.getClippingPlaneType() === "none"
    )
      return;

    this.update();
    if (this.mouseX === null || this.mouseY === null) {
      return;
    }

    const annotationMarkerBindGroup =
      this.annotationMarkerBindGroup.getGPUBindGroup();

    if (annotationMarkerBindGroup) {
      pass.setPipeline(this.annotationMarkerPipeline);
      pass.setBindGroup(0, annotationMarkerBindGroup);
      pass.draw(4);
    }
  }
}
