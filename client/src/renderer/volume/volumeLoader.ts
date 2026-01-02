import {
  type VolumeDescriptor,
  type VolumeDescriptorSettings,
} from "@/utils/volumeDescriptor";
import { CONFIG } from "@/constants";
import { clamp } from "@/renderer/utilities/math";

function normalizeToUint8PerChannel(
  data: Float32Array,
  min: number,
  max: number
): Uint8Array {
  const out = new Uint8Array(data.length);
  const range = max - min || 1; // avoid divide by zero
  const scale = 255 / range;

  for (let i = 0; i < data.length; i++) {
    const v = clamp(data[i], min, max);
    out[i] = Math.round((v - min) * scale);
  }

  return out;
}

function readRaw3D(
  buffer: ArrayBuffer,
  params: VolumeDescriptorSettings
): Float32Array {
  const {
    bytesPerVoxel,
    usedBits,
    skipBytes,
    isLittleEndian,
    isSigned,
    addValue,
    size,
  } = params;

  const voxelCount = size.x * size.y * size.z;
  const expectedBytes = skipBytes + voxelCount * bytesPerVoxel;

  if (buffer.byteLength < expectedBytes) {
    throw new Error(
      `Buffer too small. Expected ${expectedBytes}, got ${buffer.byteLength}`
    );
  }

  const view = new DataView(buffer, skipBytes);
  const output = new Float32Array(voxelCount);
  const canMask = usedBits < bytesPerVoxel * 8 && usedBits < 31;
  const bitMask = canMask ? (1 << usedBits) - 1 : null;

  let offset = 0;
  for (let i = 0; i < voxelCount; i++) {
    let value: number;

    switch (bytesPerVoxel) {
      case 1:
        value = isSigned ? view.getInt8(offset) : view.getUint8(offset);
        break;
      case 2:
        value = isSigned
          ? view.getInt16(offset, isLittleEndian)
          : view.getUint16(offset, isLittleEndian);
        break;
      case 4:
        value = isSigned
          ? view.getInt32(offset, isLittleEndian)
          : view.getUint32(offset, isLittleEndian);
        break;
      default:
        throw new Error(`Unsupported bytesPerVoxel: ${bytesPerVoxel}`);
    }

    if (bitMask !== null) {
      value &= bitMask;
      if (isSigned) {
        const signBit = 1 << (usedBits - 1);
        if (value & signBit) value -= 1 << usedBits;
      }
    }

    output[i] = value + addValue;
    offset += bytesPerVoxel;
  }

  return output;
}

function readRawSlab(
  buffer: ArrayBuffer,
  params: VolumeDescriptorSettings,
  zStart: number,
  slabDepth: number
): Float32Array {
  const { size, bytesPerVoxel, skipBytes } = params;
  const actualDepth = Math.max(0, Math.min(slabDepth, size.z - zStart));

  if (actualDepth === 0) return new Float32Array(0);

  const voxelsPerSlice = size.x * size.y;
  const slabVoxelCount = voxelsPerSlice * actualDepth;
  const slabBytes = slabVoxelCount * bytesPerVoxel;
  const byteOffset = skipBytes + zStart * voxelsPerSlice * bytesPerVoxel;

  return readRaw3D(buffer.slice(byteOffset, byteOffset + slabBytes), {
    ...params,
    size: { x: size.x, y: size.y, z: actualDepth },
    skipBytes: 0,
  });
}

function packBatchRGBA(
  channels: Uint8Array[],
  size: { x: number; y: number; z: number }
): Uint8Array {
  const voxelCount = size.x * size.y * size.z;
  const out = new Uint8Array(voxelCount * 4);

  for (let i = 0; i < voxelCount; i++) {
    out[i * 4 + 0] = channels[0]?.[i] ?? 0;
    out[i * 4 + 1] = channels[1]?.[i] ?? 0;
    out[i * 4 + 2] = channels[2]?.[i] ?? 0;
    out[i * 4 + 3] = channels[3]?.[i] ?? 0;
  }

  return out;
}

function uploadBatch(
  device: GPUDevice,
  texture: GPUTexture,
  rgba: Uint8Array,
  size: { x: number; y: number; z: number },
  zOffset: number
) {
  if (zOffset + size.z > texture.depthOrArrayLayers) {
    throw new Error("Texture upload exceeds depth bounds");
  }

  const bytesPerRow = size.x * 4;
  const alignedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;
  const rowsPerImage = size.y;
  const sliceStride = alignedBytesPerRow * rowsPerImage;

  const padded = new Uint8Array(sliceStride * size.z);

  for (let z = 0; z < size.z; z++) {
    for (let y = 0; y < size.y; y++) {
      const src = (z * size.y * size.x + y * size.x) * 4;
      const dst = z * sliceStride + y * alignedBytesPerRow;
      padded.set(rgba.subarray(src, src + size.x * 4), dst);
    }
  }

  device.queue.writeTexture(
    { texture, origin: { x: 0, y: 0, z: zOffset } },
    padded,
    { bytesPerRow: alignedBytesPerRow, rowsPerImage },
    { width: size.x, height: size.y, depthOrArrayLayers: size.z }
  );
}

export async function streamVolumesToGPU(
  device: GPUDevice,
  texture: GPUTexture,
  descriptors: VolumeDescriptor[],
  batchSize = 8
): Promise<void> {
  if (!descriptors.length)
    throw new Error("At least one volume descriptor is required");
  if (descriptors.length > CONFIG.maxRenderedVolumes)
    throw new Error(
      `Number of volumes exceeds the maximum supported: ${CONFIG.maxRenderedVolumes}`
    );

  const settings = descriptors.map((d) => {
    if (!d.settings) throw new Error("Missing volume settings");
    return d.settings;
  });

  const size = {
    x: texture.width,
    y: texture.height,
    z: texture.depthOrArrayLayers,
  };

  for (const s of settings) {
    if (s.size.x !== size.x || s.size.y !== size.y || s.size.z !== size.z) {
      throw new Error("All volumes must have identical dimensions");
    }
  }

  const buffers = await Promise.all(
    descriptors.map((d) => d.volumeData.getVolumeData())
  );

  const channelStats = settings.map(() => ({ min: Infinity, max: -Infinity }));

  for (let z = 0; z < size.z; z += batchSize) {
    const depth = Math.min(batchSize, size.z - z);

    for (let c = 0; c < descriptors.length; c++) {
      const slab = readRawSlab(buffers[c], settings[c], z, depth);

      for (const v of slab) {
        if (v < channelStats[c].min) channelStats[c].min = v;
        if (v > channelStats[c].max) channelStats[c].max = v;
      }
    }
  }

  for (let z = 0; z < size.z; z += batchSize) {
    const depth = Math.min(batchSize, size.z - z);
    const channels: Uint8Array[] = [];

    for (let c = 0; c < descriptors.length; c++) {
      const slab = readRawSlab(buffers[c], settings[c], z, depth);
      const { min, max } = channelStats[c];
      channels.push(normalizeToUint8PerChannel(slab, min, max));
    }

    const rgba = packBatchRGBA(channels, { x: size.x, y: size.y, z: depth });
    uploadBatch(device, texture, rgba, { x: size.x, y: size.y, z: depth }, z);
  }
}
