import type { VolumeDescriptorSettings } from "./volumeDescriptor";
import { parseHeader, MRCDataType, type MRCHeader } from "@warpem/mrc-parser";

export async function readMRCHeader(mrcFile: File): Promise<MRCHeader> {
  const base = await mrcFile.slice(0, 1024).arrayBuffer();
  let header = parseHeader(base);
  if (header.extendedBytes > 0) {
    const fullHeaderBuffer = await mrcFile
      .slice(0, 1024 + header.extendedBytes)
      .arrayBuffer();
    header = parseHeader(fullHeaderBuffer);
  }

  return header;
}

export async function getDescriptorFromMrcHeaderOrFile(
  headerOrFile: MRCHeader | File
): Promise<VolumeDescriptorSettings> {
  let header: MRCHeader;
  if (headerOrFile instanceof File) {
    header = await readMRCHeader(headerOrFile);
  } else {
    header = headerOrFile;
  }

  const dimensions = header.dimensions;
  const mode = header.mode;

  let bytesPerVoxel: number;
  let usedBits: number;
  let isSigned: boolean;

  if (mode === MRCDataType.Byte) {
    bytesPerVoxel = 1;
    usedBits = 8;
    isSigned = true;
  } else if (mode === MRCDataType.Short) {
    bytesPerVoxel = 2;
    usedBits = 16;
    isSigned = true;
  } else if (mode === MRCDataType.UnsignedShort) {
    bytesPerVoxel = 2;
    usedBits = 16;
    isSigned = false;
  } else if (mode === MRCDataType.Float) {
    // Float will be converted to 8-bit unsigned for compatibility, so we set these values accordingly.
    bytesPerVoxel = 1;
    usedBits = 8;
    isSigned = false;
  } else {
    throw new Error("MRC file data is in an incompatible format.");
  }

  return {
    size: { x: dimensions.x, y: dimensions.y, z: dimensions.z },
    ratio: { x: 1.0, y: 1.0, z: 1.0 },
    bytesPerVoxel: bytesPerVoxel,
    usedBits: usedBits,
    skipBytes: 0,
    isLittleEndian: true,
    isSigned: isSigned,
    addValue: 0,
  };
}

export function createFloat32Decoder(): TransformStream<
  Uint8Array,
  Float32Array
> {
  let leftover = new Uint8Array(0);

  return new TransformStream<Uint8Array, Float32Array>({
    transform(chunk, controller) {
      const combined = new Uint8Array(leftover.length + chunk.length);
      combined.set(leftover);
      combined.set(chunk, leftover.length);

      const usable = combined.length - (combined.length % 4);

      if (usable > 0) {
        const floats = new Float32Array(
          combined.buffer,
          combined.byteOffset,
          usable / 4
        );

        controller.enqueue(new Float32Array(floats));
      }

      leftover = combined.slice(usable);
    },

    flush() {
      leftover = new Uint8Array(0);
    },
  });
}

export function createFloatNormalizer(
  min: number,
  max: number
): TransformStream<Float32Array, Uint8Array> {
  const scale = max > min ? 255 / (max - min) : 0;

  return new TransformStream<Float32Array, Uint8Array>({
    transform(floats, controller) {
      const out = new Uint8Array(floats.length);

      for (let i = 0; i < floats.length; i++) {
        const v = (floats[i] - min) * scale;
        out[i] = Math.min(255, Math.max(0, v)) | 0;
      }

      controller.enqueue(out);
    },
  });
}

export async function convertMRCToRaw(
  mrcFile: File
): Promise<{ rawFile: File; settings: VolumeDescriptorSettings }> {
  //Read header (first 1024 bytes)
  const header: MRCHeader = await readMRCHeader(mrcFile);

  if (
    header.mapOrder.x !== 1 ||
    header.mapOrder.y !== 2 ||
    header.mapOrder.z !== 3
  ) {
    throw new Error(
      `Unsupported MRC map order: ${header.mapOrder.x}, ${header.mapOrder.y}, ${header.mapOrder.z}`
    );
  }

  // The rest of the file contains the data.
  const dataBlob = mrcFile.slice(1024 + header.extendedBytes);

  let outputStream: ReadableStream<Uint8Array>;

  // No conversion required
  if (header.mode === 0 || header.mode === 1 || header.mode === 6) {
    outputStream = dataBlob.stream();
  }

  // Float normalization
  else if (header.mode === 2 || header.mode === 12) {
    const min = header.minValue;
    const max = header.maxValue;

    console.log(`MRC Float Data: min=${min}, max=${max}`);

    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      throw new Error("Invalid MRC header statistics");
    }

    outputStream = dataBlob
      .stream()
      .pipeThrough(createFloat32Decoder())
      .pipeThrough(createFloatNormalizer(min, max));
  } else {
    throw new Error(`Unsupported MRC mode: ${header.mode}`);
  }

  const rawBlob = await new Response(outputStream).blob();

  // Create a new RAW File (renaming .mrc to .raw)
  const rawFileName = mrcFile.name.replace(/\.mrc$/i, ".raw");
  const rawFile = new File([rawBlob], rawFileName, {
    type: "application/octet-stream",
  });

  const settings = await getDescriptorFromMrcHeaderOrFile(header);
  console.log(
    `Converted MRC to RAW with settings: ${JSON.stringify(settings)}`
  );

  return { rawFile, settings: settings };
}
