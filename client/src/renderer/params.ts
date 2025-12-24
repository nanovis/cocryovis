import { vec4 } from "gl-matrix";

export class ParamData {
  params = {
    enableEarlyRayTermination: 1,
    enableJittering: 1,
    enableAmbientOcclusion: 1,
    enableSoftShadows: 1,

    interaction: 0.0,
    sampleRate: 5.0,
    aoRadius: 1.0,
    aoStrength: 0.9,

    aoNumSamples: 5,
    shadowQuality: 1.0,
    shadowStrength: 0.5,
    voxelSize: 1.0,

    enableVolumeA: 1,
    enableVolumeB: 0,
    enableVolumeC: 0,
    enableVolumeD: 0,

    // vec4
    clippingMask: vec4.fromValues(1, 1, 1, 1),
    viewVector: vec4.create(),
    clippingPlaneOrigin: vec4.create(),
    clippingPlaneNormal: vec4.create(),
    clearColor: vec4.fromValues(0, 0, 0, 1),

    enableAnnotations: 0,
    annotationVolume: 0,
    annotationPingPong: 0,
    shadowRadius: 0.2,

    rawVolumeChannel: -1,
    numChannels: 1,
  };

  private dirty: boolean = true;
  private readonly onChange: (() => void) | undefined;
  private readonly buffer;
  private device: GPUDevice;

  private destroyed: boolean = false;

  constructor(
    device: GPUDevice,
    init?: Partial<typeof this.params>,
    onChange?: () => void
  ) {
    Object.assign(this.params, init);
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
    Object.assign(this.params, params);
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
    view.setInt32(o, this.params.enableEarlyRayTermination, le);
    o += 4;
    view.setInt32(o, this.params.enableJittering, le);
    o += 4;
    view.setInt32(o, this.params.enableAmbientOcclusion, le);
    o += 4;
    view.setInt32(o, this.params.enableSoftShadows, le);
    o += 4;

    // ---- f32 ----
    view.setFloat32(o, this.params.interaction, le);
    o += 4;
    view.setFloat32(o, this.params.sampleRate, le);
    o += 4;
    view.setFloat32(o, this.params.aoRadius, le);
    o += 4;
    view.setFloat32(o, this.params.aoStrength, le);
    o += 4;

    // ---- mixed ----
    view.setInt32(o, this.params.aoNumSamples, le);
    o += 4;
    view.setFloat32(o, this.params.shadowQuality, le);
    o += 4;
    view.setFloat32(o, this.params.shadowStrength, le);
    o += 4;
    view.setFloat32(o, this.params.voxelSize, le);
    o += 4;

    view.setInt32(o, this.params.enableVolumeA, le);
    o += 4;
    view.setInt32(o, this.params.enableVolumeB, le);
    o += 4;
    view.setInt32(o, this.params.enableVolumeC, le);
    o += 4;
    view.setInt32(o, this.params.enableVolumeD, le);
    o += 4;

    // ---- vec4<f32> ----
    for (let i = 0; i < 4; i++)
      view.setFloat32(o + i * 4, this.params.clippingMask[i], le);
    o += 16;

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

    // ---- tail i32s ----
    view.setInt32(o, this.params.enableAnnotations, le);
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

    // padding (empty2, empty3)
    view.setInt32(o, 0, le);
    o += 4;
    view.setInt32(o, 0, le);
    o += 4;

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
