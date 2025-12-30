import {
  type VolumeDescriptor,
  type VolumeDescriptorSettings,
} from "../../utils/volumeSettings";
import { CONFIG } from "../../Constants";

function getVoxelRange(params: VolumeDescriptorSettings): {
  min: number;
  max: number;
} {
  const { usedBits, isSigned } = params;

  const maxValue = (1 << usedBits) - 1;
  if (isSigned) {
    const half = 1 << (usedBits - 1);
    return { min: -half, max: half - 1 };
  } else {
    return { min: 0, max: maxValue };
  }
}

function normalizeToUint8(
  data: Float32Array,
  params: VolumeDescriptorSettings
): Uint8Array {
  const { min, max } = getVoxelRange(params);
  const scale = 255 / (max - min);

  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    let v = data[i] + params.addValue; // apply addValue if any
    v = Math.min(max, Math.max(min, v)); // clamp
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
      `Buffer too small. Expected at least ${expectedBytes} bytes, got ${buffer.byteLength}`
    );
  }

  const view = new DataView(buffer, skipBytes);
  const output = new Float32Array(voxelCount);

  const bitMask = usedBits < bytesPerVoxel * 8 ? (1 << usedBits) - 1 : null;

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

    // Apply usedBits mask if needed
    if (bitMask !== null) {
      value &= bitMask;

      // Restore signed value if needed
      if (isSigned) {
        const signBit = 1 << (usedBits - 1);
        if (value & signBit) {
          value = value - (1 << usedBits);
        }
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

  const actualDepth = Math.min(slabDepth, size.z - zStart);

  const voxelsPerSlice = size.x * size.y;
  const slabVoxelCount = voxelsPerSlice * actualDepth;
  const slabBytes = slabVoxelCount * bytesPerVoxel;

  const byteOffset = skipBytes + zStart * voxelsPerSlice * bytesPerVoxel;

  const slabBuffer = buffer.slice(byteOffset, byteOffset + slabBytes);

  return readRaw3D(slabBuffer, {
    ...params,
    size: { x: size.x, y: size.y, z: actualDepth },
    skipBytes: 0,
  });
}

function packBatchRGBA(
  slabs: Uint8Array[],
  size: { x: number; y: number; z: number }
): Uint8Array {
  const voxelCount = size.x * size.y * size.z;
  const out = new Uint8Array(voxelCount * 4);

  for (let i = 0; i < voxelCount; i++) {
    out[i * 4 + 0] = slabs[0]?.[i] ?? 0;
    out[i * 4 + 1] = slabs[1]?.[i] ?? 0;
    out[i * 4 + 2] = slabs[2]?.[i] ?? 0;
    out[i * 4 + 3] =
      slabs.length === 4 ? slabs[3][i] : slabs.length === 3 ? 255 : 0;
  }

  return out;
}

function uploadBatch(
  device: GPUDevice,
  texture: GPUTexture,
  rgbaBatch: Uint8Array,
  batchSize: { x: number; y: number; z: number },
  zOffset: number
) {
  const bytesPerRow = batchSize.x * 4;
  const alignedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;

  const rowsPerImage = batchSize.y;
  const sliceStride = alignedBytesPerRow * rowsPerImage;

  const padded = new Uint8Array(sliceStride * batchSize.z);

  for (let z = 0; z < batchSize.z; z++) {
    for (let y = 0; y < batchSize.y; y++) {
      const srcOffset = (z * batchSize.y * batchSize.x + y * batchSize.x) * 4;
      const dstOffset = z * sliceStride + y * alignedBytesPerRow;

      padded.set(
        rgbaBatch.subarray(srcOffset, srcOffset + batchSize.x * 4),
        dstOffset
      );
    }
  }

  device.queue.writeTexture(
    {
      texture,
      origin: { x: 0, y: 0, z: zOffset },
    },
    padded,
    {
      bytesPerRow: alignedBytesPerRow,
      rowsPerImage,
    },
    {
      width: batchSize.x,
      height: batchSize.y,
      depthOrArrayLayers: batchSize.z,
    }
  );
}

export async function streamVolumesToGPU(
  device: GPUDevice,
  descriptors: VolumeDescriptor[],
  batchSize = 8
): Promise<GPUTexture> {
  if (descriptors.length < 1) {
    throw new Error("At least one volume descriptor is required");
  }

  if (descriptors.length > CONFIG.maxRenderedVolumes) {
    throw new Error(
      `Number of volumes exceeds the maximum supported: ${CONFIG.maxRenderedVolumes}`
    );
  }

  if (descriptors[0].settings === undefined) {
    throw new Error("Volume descriptor settings are missing");
  }

  const size = descriptors[0].settings.size;

  for (const d of descriptors) {
    if (d.settings === undefined) {
      throw new Error("Volume descriptor settings are missing");
    }
    const s = d.settings.size;
    if (s.x !== size.x || s.y !== size.y || s.z !== size.z) {
      throw new Error("All volumes must have identical dimensions");
    }
  }

  const texture = device.createTexture({
    size: {
      width: size.x,
      height: size.y,
      depthOrArrayLayers: size.z,
    },
    dimension: "3d",
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  for (let z = 0; z < size.z; z += batchSize) {
    const actualDepth = Math.min(batchSize, size.z - z);

    const channelSlabs: Uint8Array[] = [];

    for (const d of descriptors) {
      if (d.settings === undefined) {
        throw new Error("Volume descriptor settings are missing");
      }
      const arrayBuffer = await d.volumeData.getVolumeData();
      const floatSlab = readRawSlab(arrayBuffer, d.settings, z, batchSize);
      channelSlabs.push(normalizeToUint8(floatSlab, d.settings));
    }

    const rgbaSlab = packBatchRGBA(channelSlabs, {
      x: size.x,
      y: size.y,
      z: actualDepth,
    });

    uploadBatch(
      device,
      texture,
      rgbaSlab,
      { x: size.x, y: size.y, z: actualDepth },
      z
    );
  }

  return texture;
}
