import { vec4 } from "gl-matrix";

export class ParamData {
  // Scalars (4-byte each, pad to 16 bytes per 4)
  enableEarlyRayTermination = 0;
  enableJittering = 0;
  enableAmbientOcclusion = 0;
  enableSoftShadows = 0;

  interaction = 0.0;
  sampleRate = 1.0;
  aoRadius = 1.0;
  aoStrength = 1.0;

  aoNumSamples = 1;
  shadowQuality = 1.0;
  shadowStrength = 1.0;
  voxelSize = 1.0;

  enableVolumeA = 0;
  enableVolumeB = 0;
  enableVolumeC = 0;
  enableVolumeD = 0;

  // vec4
  clippingMask = vec4.create();
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
  empty2 = 0;
  empty3 = 0;

  private dirty: boolean = true;
  private readonly onChange: (() => void) | undefined;
  private readonly buffer;
  private device: GPUDevice;

  constructor(
    device: GPUDevice,
    init?: Partial<ParamData>,
    onChange?: () => void
  ) {
    Object.assign(this, init);
    this.device = device;
    this.onChange = onChange;
    this.buffer = device.createBuffer({
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

  toBuffer(): Float32Array {
    const buffer = new Float32Array(64); // 64 floats = 1024 bits = plenty

    let i = 0;

    // Scalars (first 4 floats)
    buffer[i++] = this.enableEarlyRayTermination;
    buffer[i++] = this.enableJittering;
    buffer[i++] = this.enableAmbientOcclusion;
    buffer[i++] = this.enableSoftShadows;

    buffer[i++] = this.interaction;
    buffer[i++] = this.sampleRate;
    buffer[i++] = this.aoRadius;
    buffer[i++] = this.aoStrength;

    buffer[i++] = this.aoNumSamples;
    buffer[i++] = this.shadowQuality;
    buffer[i++] = this.shadowStrength;
    buffer[i++] = this.voxelSize;

    buffer[i++] = this.enableVolumeA;
    buffer[i++] = this.enableVolumeB;
    buffer[i++] = this.enableVolumeC;
    buffer[i++] = this.enableVolumeD;

    // vec4s
    buffer.set(this.clippingMask, i);
    i += 4;
    buffer.set(this.viewVector, i);
    i += 4;
    buffer.set(this.clippingPlaneOrigin, i);
    i += 4;
    buffer.set(this.clippingPlaneNormal, i);
    i += 4;
    buffer.set(this.clearColor, i);
    i += 4;

    // Scalars
    buffer[i++] = this.enableAnnotations;
    buffer[i++] = this.annotationVolume;
    buffer[i++] = this.annotationPingPong;
    buffer[i++] = this.shadowRadius;

    buffer[i++] = this.rawVolumeChannel;
    buffer[i++] = this.numChannels;
    buffer[i++] = this.empty2;
    buffer[i++] = this.empty3;

    return buffer;
  }

  updateBuffer() {
    if (!this.dirty) {
      return;
    }
    const data = this.toBuffer();
    this.device.queue.writeBuffer(this.buffer, 0, data.buffer);

    this.onChange?.();
  }

  getBuffer(): GPUBuffer {
    this.updateBuffer();
    return this.buffer;
  }
}
