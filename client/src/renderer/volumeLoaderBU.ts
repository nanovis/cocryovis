// export interface VolumeDescriptor {
//   buffer: ArrayBuffer;
//   params: VolumeParams;
// }
//
// export interface VolumeParams {
//   bytesPerVoxel: number;
//   usedBits: number;
//   skipBytes: number;
//   littleEndian: boolean;
//   isSigned: boolean;
//   addValue: number;
//   size: { x: number; y: number; z: number };
//   ratio: { x: number; y: number; z: number };
// }
//
// function readRaw3D(buffer: ArrayBuffer, params: VolumeParams): Float32Array {
//   const {
//     bytesPerVoxel,
//     usedBits,
//     skipBytes,
//     littleEndian,
//     isSigned,
//     addValue,
//     size,
//   } = params;
//
//   const voxelCount = size.x * size.y * size.z;
//   const expectedBytes = skipBytes + voxelCount * bytesPerVoxel;
//
//   if (buffer.byteLength < expectedBytes) {
//     throw new Error(
//       `Buffer too small. Expected at least ${expectedBytes} bytes, got ${buffer.byteLength}`
//     );
//   }
//
//   const view = new DataView(buffer, skipBytes);
//   const output = new Float32Array(voxelCount);
//
//   const bitMask = usedBits < bytesPerVoxel * 8 ? (1 << usedBits) - 1 : null;
//
//   let offset = 0;
//
//   for (let i = 0; i < voxelCount; i++) {
//     let value: number;
//
//     switch (bytesPerVoxel) {
//       case 1:
//         value = isSigned ? view.getInt8(offset) : view.getUint8(offset);
//         break;
//
//       case 2:
//         value = isSigned
//           ? view.getInt16(offset, littleEndian)
//           : view.getUint16(offset, littleEndian);
//         break;
//
//       case 4:
//         value = isSigned
//           ? view.getInt32(offset, littleEndian)
//           : view.getUint32(offset, littleEndian);
//         break;
//
//       default:
//         throw new Error(`Unsupported bytesPerVoxel: ${bytesPerVoxel}`);
//     }
//
//     // Apply usedBits mask if needed
//     if (bitMask !== null) {
//       value &= bitMask;
//
//       // Restore signed value if needed
//       if (isSigned) {
//         const signBit = 1 << (usedBits - 1);
//         if (value & signBit) {
//           value = value - (1 << usedBits);
//         }
//       }
//     }
//
//     output[i] = value + addValue;
//     offset += bytesPerVoxel;
//   }
//
//   return output;
// }
//
// function normalizeToUint8(data: Float32Array): Uint8Array {
//   let min = Infinity;
//   let max = -Infinity;
//
//   for (const v of data) {
//     if (v < min) min = v;
//     if (v > max) max = v;
//   }
//
//   const range = max - min || 1;
//   const out = new Uint8Array(data.length);
//
//   for (let i = 0; i < data.length; i++) {
//     out[i] = Math.min(255, Math.max(0, ((data[i] - min) / range) * 255));
//   }
//
//   return out;
// }
//
// function readRawSlice(
//   buffer: ArrayBuffer,
//   params: VolumeParams,
//   z: number
// ): Float32Array {
//   const { size, bytesPerVoxel, skipBytes } = params;
//
//   const sliceVoxelCount = size.x * size.y;
//   const sliceBytes = sliceVoxelCount * bytesPerVoxel;
//
//   const sliceOffset = skipBytes + z * sliceBytes;
//
//   const sliceBuffer = buffer.slice(sliceOffset, sliceOffset + sliceBytes);
//
//   return readRaw3D(sliceBuffer, {
//     ...params,
//     size: { x: size.x, y: size.y, z: 1 },
//     skipBytes: 0,
//   });
// }
//
// function packSliceRGBA(
//   slices: Uint8Array[],
//   size: { x: number; y: number }
// ): Uint8Array {
//   const voxelCount = size.x * size.y;
//   const out = new Uint8Array(voxelCount * 4);
//
//   for (let i = 0; i < voxelCount; i++) {
//     out[i * 4 + 0] = slices[0]?.[i] ?? 0;
//     out[i * 4 + 1] = slices[1]?.[i] ?? 0;
//     out[i * 4 + 2] = slices[2]?.[i] ?? 0;
//     out[i * 4 + 3] =
//       slices.length === 4 ? slices[3][i] : slices.length === 3 ? 255 : 0;
//   }
//
//   return out;
// }
//
// function uploadSlice(
//   device: GPUDevice,
//   texture: GPUTexture,
//   rgbaSlice: Uint8Array,
//   size: { x: number; y: number },
//   z: number
// ) {
//   const bytesPerRow = size.x * 4;
//   const alignedBytesPerRow = Math.ceil(bytesPerRow / 256) * 256;
//
//   const padded = new Uint8Array(alignedBytesPerRow * size.y);
//
//   for (let y = 0; y < size.y; y++) {
//     padded.set(
//       rgbaSlice.subarray(y * bytesPerRow, y * bytesPerRow + bytesPerRow),
//       y * alignedBytesPerRow
//     );
//   }
//
//   device.queue.writeTexture(
//     {
//       texture,
//       origin: { x: 0, y: 0, z },
//     },
//     padded,
//     {
//       bytesPerRow: alignedBytesPerRow,
//       rowsPerImage: size.y,
//     },
//     {
//       width: size.x,
//       height: size.y,
//       depthOrArrayLayers: 1,
//     }
//   );
// }
//
// function streamVolumesToGPU(
//   device: GPUDevice,
//   descriptors: VolumeDescriptor[]
// ) {
//   const size = descriptors[0].params.size;
//
//   const texture = device.createTexture({
//     size: {
//       width: size.x,
//       height: size.y,
//       depthOrArrayLayers: size.z,
//     },
//     dimension: "3d",
//     format: "rgba8unorm",
//     usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
//   });
//
//   for (let z = 0; z < size.z; z++) {
//     const channelSlices: Uint8Array[] = [];
//
//     for (const d of descriptors) {
//       const slice = readRawSlice(d.buffer, d.params, z);
//       channelSlices.push(normalizeToUint8(slice));
//     }
//
//     const rgbaSlice = packSliceRGBA(channelSlices, { x: size.x, y: size.y });
//
//     uploadSlice(device, texture, rgbaSlice, size, z);
//   }
//
//   return texture;
// }
