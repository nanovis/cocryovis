import { mat4, vec3, vec4 } from "gl-matrix";
import { WebGpuBuffer } from "./webGpuBuffer.ts";
import type { Camera } from "./camera.ts";
import { clamp } from "./math.ts";

export interface RendererParameters {
  enableEarlyRayTermination: boolean;
  enableJittering: boolean;
  enableAmbientOcclusion: boolean;
  enableSoftShadows: boolean;

  interaction: number;
  sampleRate: number;
  aoRadius: number;
  aoStrength: number;

  aoNumSamples: number;
  shadowQuality: number;
  shadowStrength: number;
  voxelSize: number;

  viewVector: vec4;
  clippingPlaneOrigin: vec4;
  clippingPlaneNormal: vec4;
  clearColor: vec4;

  enableAnnotations: boolean;
  annotationVolume: number;
  annotationPingPong: number;
  shadowRadius: number;

  rawVolumeChannel: number;
  numChannels: number;
  clippingEnabled: boolean;
}

export type ClippingPlaneType = "view-aligned" | "x" | "y" | "z" | "none";

export class ParamData extends WebGpuBuffer {
  params: RendererParameters = {
    enableEarlyRayTermination: true,
    enableJittering: true,
    enableAmbientOcclusion: true,
    enableSoftShadows: true,

    interaction: 0.0,
    sampleRate: 5.0,
    aoRadius: 1.0,
    aoStrength: 0.9,

    aoNumSamples: 5,
    shadowQuality: 1.0,
    shadowStrength: 0.5,
    voxelSize: 1.0,

    viewVector: vec4.create(),
    clippingPlaneOrigin: vec4.create(),
    clippingPlaneNormal: vec4.create(),
    clearColor: vec4.fromValues(0, 0, 0, 1),

    enableAnnotations: false,
    annotationVolume: 0,
    annotationPingPong: 0,
    shadowRadius: 0.2,

    rawVolumeChannel: -1,
    numChannels: 1,
    clippingEnabled: false,
  };

  private camera: Camera;

  private dirty: boolean = true;
  private clippingPlaneType: ClippingPlaneType = "none";
  private clippingPlaneOffset: number = 0;

  private lastClippingPlaneOriginUpdate:
    | undefined
    | { normal: vec3; offset: number };

  private lastViewDirection: undefined | vec3;

  private static readonly size = 36 * 4;

  constructor(
    device: GPUDevice,
    camera: Camera,
    init?: Partial<RendererParameters>
  ) {
    super(device, ParamData.size, "ParamData Buffer");
    this.camera = camera;
    Object.assign(this.params, init);
    this.device = device;
  }

  protected createBuffer(size: number): GPUBuffer {
    return this.device.createBuffer({
      size: size,
      label: this.label,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  set(params: Partial<RendererParameters>) {
    this.dirty = true;
    Object.assign(this.params, params);
  }

  toBuffer(): ArrayBuffer {
    const buffer = new ArrayBuffer(ParamData.size);
    const view = new DataView(buffer);

    let o = 0;
    const le = true;

    view.setInt32(o, Number(this.params.enableEarlyRayTermination), le);
    o += 4;
    view.setInt32(o, Number(this.params.enableJittering), le);
    o += 4;
    view.setInt32(o, Number(this.params.enableAmbientOcclusion), le);
    o += 4;
    view.setInt32(o, Number(this.params.enableSoftShadows), le);
    o += 4;

    view.setFloat32(o, this.params.interaction, le);
    o += 4;
    view.setFloat32(o, this.params.sampleRate, le);
    o += 4;
    view.setFloat32(o, this.params.aoRadius, le);
    o += 4;
    view.setFloat32(o, this.params.aoStrength, le);
    o += 4;

    view.setInt32(o, this.params.aoNumSamples, le);
    o += 4;
    view.setFloat32(o, this.params.shadowQuality, le);
    o += 4;
    view.setFloat32(o, this.params.shadowStrength, le);
    o += 4;
    view.setFloat32(o, this.params.voxelSize, le);
    o += 4;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.viewVector[i], le);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.clippingPlaneOrigin[i], le);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.clippingPlaneNormal[i], le);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.clearColor[i], le);
    o += 16;

    view.setInt32(o, Number(this.params.enableAnnotations), le);
    o += 4;
    view.setInt32(o, this.params.annotationVolume, le);
    o += 4;
    view.setInt32(o, this.params.annotationPingPong, le);
    o += 4;
    view.setFloat32(o, this.params.shadowRadius, le);
    o += 4;

    view.setInt32(o, this.params.rawVolumeChannel, le);
    o += 4;
    view.setInt32(o, this.params.numChannels, le);
    o += 4;
    view.setInt32(o, Number(this.params.clippingEnabled), le);
    o += 4;

    // Padding
    view.setInt32(o, 0, le);
    o += 4;

    return buffer;
  }

  setClippingPlane(type: ClippingPlaneType) {
    if (this.clippingPlaneType === type) return;
    this.dirty = true;
    this.clippingPlaneType = type;
    this.params.clippingEnabled = type !== "none";

    if (type === "x") {
      this.params.clippingPlaneNormal = vec4.fromValues(1, 0, 0, 0);
    } else if (type === "y") {
      this.params.clippingPlaneNormal = vec4.fromValues(0, 1, 0, 0);
    } else if (type === "z") {
      this.params.clippingPlaneNormal = vec4.fromValues(0, 0, 1, 0);
    }
  }

  setClippingPlaneOffset(offset: number) {
    this.clippingPlaneOffset = clamp(offset, -1, 1);
  }

  updateClippingPlane() {
    if (this.clippingPlaneType === "view-aligned") {
      const viewDirection = this.camera.getViewVector();
      if (
        this.lastViewDirection === undefined ||
        !vec3.equals(this.lastViewDirection, viewDirection)
      ) {
        const inverseModelMatrix = mat4.create();
        const normal = vec4.create();
        const up = vec4.create();

        const viewVector: vec4 = [...viewDirection, 0];
        const upVector: vec4 = [...this.camera.up, 0];

        vec4.transformMat4(normal, viewVector, inverseModelMatrix);
        vec3.normalize(normal, normal);

        vec4.transformMat4(up, upVector, inverseModelMatrix);
        vec3.normalize(up, up);

        const dot = Math.abs(vec3.dot(normal, up));

        if (dot > 0.99 || dot < 0.01) {
          // Pick fallback axis (X-axis)
          const right = vec4.create();
          vec3.cross(right, normal, vec3.fromValues(1, 0, 0));
          vec3.normalize(right, right);

          vec3.cross(up, right, normal);
          vec3.normalize(up, up);
        }

        this.params.clippingPlaneNormal = normal;
        this.lastViewDirection = vec3.clone(viewDirection);
        this.dirty = true;
      }
    }

    if (this.clippingPlaneType !== "none") {
      if (
        this.lastClippingPlaneOriginUpdate === undefined ||
        !vec3.equals(
          this.lastClippingPlaneOriginUpdate.normal,
          this.params.clippingPlaneNormal
        ) ||
        this.lastClippingPlaneOriginUpdate.offset !== this.clippingPlaneOffset
      ) {
        vec3.scale(
          this.params.clippingPlaneOrigin,
          this.params.clippingPlaneNormal,
          this.clippingPlaneOffset
        );
        this.lastClippingPlaneOriginUpdate = {
          normal: vec3.clone(this.params.clippingPlaneNormal),
          offset: this.clippingPlaneOffset,
        };
        this.dirty = true;
      }
    }
  }

  updateBuffer() {
    this.updateClippingPlane();
    if (!this.dirty || this.destroyed) {
      return;
    }
    const data = this.toBuffer();
    this.device.queue.writeBuffer(this.buffer, 0, data);
    this.dirty = false;
  }
}
