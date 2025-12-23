import { vec4 } from "gl-matrix";

export class ParamData {
  // Scalars (4-byte each, pad to 16 bytes per 4)
  enableEarlyRayTermination = 0;
  enableJittering = 0;
  enableAmbientOcclusion = 0;
  enableSoftShadows = 0;

  interaction = 0.0;
  sampleRate = 5.0;
  aoRadius = 1.0;
  aoStrength = 1.0;

  aoNumSamples = 1;
  shadowQuality = 1.0;
  shadowStrength = 1.0;
  voxelSize = 1.0;

  enableVolumeA = 1;
  enableVolumeB = 0;
  enableVolumeC = 0;
  enableVolumeD = 0;

  // vec4
  clippingMask = vec4.fromValues(1, 1, 1, 1);
  viewVector = vec4.create();
  clippingPlaneOrigin = vec4.create();
  clippingPlaneNormal = vec4.create();
  clearColor = vec4.fromValues(0, 0, 0, 1);

  enableAnnotations = 0;
  annotationVolume = 0;
  annotationPingPong = 0;
  shadowRadius = 1.0;

  rawVolumeChannel = -1;
  numChannels = 1;

  private dirty: boolean = true;
  private readonly onChange: (() => void) | undefined;
  private readonly buffer;
  private device: GPUDevice;

  private destroyed: boolean = false;

  constructor(
    device: GPUDevice,
    init?: Partial<ParamData>,
    onChange?: () => void
  ) {
    Object.assign(this, init);
    this.device = device;
    this.onChange = onChange;
    this.buffer = device.createBuffer({
      label: "ParamData Buffer",
      size: this.getSize(),
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  set(params: Partial<ParamData>) {
    this.dirty = true;
    Object.assign(this, params);
  }

  getSize(): number {
    const data = this.toBuffer();
    return data.byteLength;
  }

  toBuffer(): ArrayBuffer {
    const buffer = new ArrayBuffer(48 * 4);
    const view = new DataView(buffer);

    let o = 0;
    const le = true; // little-endian (required)

    // ---- i32 flags ----
    view.setInt32(o, this.enableEarlyRayTermination, le);
    o += 4;
    view.setInt32(o, this.enableJittering, le);
    o += 4;
    view.setInt32(o, this.enableAmbientOcclusion, le);
    o += 4;
    view.setInt32(o, this.enableSoftShadows, le);
    o += 4;

    // ---- f32 ----
    view.setFloat32(o, this.interaction, le);
    o += 4;
    view.setFloat32(o, this.sampleRate, le);
    o += 4;
    view.setFloat32(o, this.aoRadius, le);
    o += 4;
    view.setFloat32(o, this.aoStrength, le);
    o += 4;

    // ---- mixed ----
    view.setInt32(o, this.aoNumSamples, le);
    o += 4;
    view.setFloat32(o, this.shadowQuality, le);
    o += 4;
    view.setFloat32(o, this.shadowStrength, le);
    o += 4;
    view.setFloat32(o, this.voxelSize, le);
    o += 4;

    view.setInt32(o, this.enableVolumeA, le);
    o += 4;
    view.setInt32(o, this.enableVolumeB, le);
    o += 4;
    view.setInt32(o, this.enableVolumeC, le);
    o += 4;
    view.setInt32(o, this.enableVolumeD, le);
    o += 4;

    // ---- vec4<f32> ----
    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.clippingMask[i], le);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.viewVector[i], le);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.clippingPlaneOrigin[i], le);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.clippingPlaneNormal[i], le);
    o += 16;

    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.clearColor[i], le);
    o += 16;

    // ---- tail i32s ----
    view.setInt32(o, this.enableAnnotations, le);
    o += 4;
    view.setInt32(o, this.annotationVolume, le);
    o += 4;
    view.setInt32(o, this.annotationPingPong, le);
    o += 4;
    view.setFloat32(o, this.shadowRadius, le);
    o += 4;

    view.setInt32(o, this.rawVolumeChannel, le);
    o += 4;
    view.setInt32(o, this.numChannels, le);
    o += 4;

    // padding (empty2, empty3)
    view.setInt32(o, 0, le);
    o += 4;
    view.setInt32(o, 0, le);
    o += 4;

    console.log(buffer);

    return buffer;
  }

  updateBuffer() {
    if (!this.dirty || this.destroyed) {
      return;
    }
    const data = this.toBuffer();
    this.device.queue.writeBuffer(this.buffer, 0, data);
    this.dirty = false;
    this.onChange?.();
  }

  getBuffer(): GPUBuffer {
    this.updateBuffer();
    return this.buffer;
  }

  destroy() {
    this.destroyed = true;
    this.buffer.destroy();
  }
}
