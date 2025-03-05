import { VolumeSettings } from "./VolumeSettings";

/**
 * MRC file into a RAW and JSON file using streaming/chunked.
 * Read the header separately and then processes the data blob in chunks.
 * Float modes (2 and 12), two passes are performed: one to compute min/max and a second to normalize data.
 */
export async function convertMRCToRaw(
  mrcFile: File
): Promise<{ rawFile: File; settings: VolumeSettings }> {
  //Read header (first 1024 bytes)
  const headerBuffer = await mrcFile.slice(0, 1024).arrayBuffer();
  const headerView = new DataView(headerBuffer);

  // Extract header info
  const nx = headerView.getInt32(0, true);
  const ny = headerView.getInt32(4, true);
  const nz = headerView.getInt32(8, true);
  const mode = headerView.getInt32(12, true);

  let bytesPerVoxel: number;
  let usedBits: number;
  let isSigned: boolean;
  let rawDataBlob: Blob;

  // The rest of the file contains the data.
  const dataBlob = mrcFile.slice(1024);

  if (mode === 0 || mode === 1 || mode === 6) {
    // Modes 0, 1, 6: Data can be used directly.
    if (mode === 0) {
      bytesPerVoxel = 1;
      usedBits = 8;
      isSigned = true;
    } else if (mode === 1) {
      bytesPerVoxel = 2;
      usedBits = 16;
      isSigned = true;
    } else {
      // mode === 6
      bytesPerVoxel = 2;
      usedBits = 16;
      isSigned = false;
    }
    // Read the data stream and collect the chunks.
    const chunks: Uint8Array[] = [];
    const reader = dataBlob.stream().getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    rawDataBlob = new Blob(chunks);
  } else if (mode === 2 || mode === 12) {
    bytesPerVoxel = 1;
    usedBits = 8;
    isSigned = false;

    // --- First Pass: Determine min and max ---
    let minVal = Infinity;
    let maxVal = -Infinity;

    {
      const reader = dataBlob.stream().getReader();
      let leftover = new Uint8Array(0);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const combined = new Uint8Array(leftover.length + value.length);
        combined.set(leftover);
        combined.set(value, leftover.length);
        const completeLength = combined.length - (combined.length % 4);
        if (completeLength > 0) {
          //Float32Array
          const floatChunk = new Float32Array(
            combined.buffer,
            combined.byteOffset,
            completeLength / 4
          );
          for (let i = 0; i < floatChunk.length; i++) {
            const v = floatChunk[i];
            if (v < minVal) minVal = v;
            if (v > maxVal) maxVal = v;
          }
        }
        leftover = combined.slice(completeLength);
      }
    }

    // --- Second Pass: Normalize and convert float values to 8-bit ---
    const chunks: Uint8Array[] = [];
    const range = maxVal - minVal;
    {
      const reader = dataBlob.stream().getReader();
      let leftover = new Uint8Array(0);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const combined = new Uint8Array(leftover.length + value.length);
        combined.set(leftover);
        combined.set(value, leftover.length);
        const completeLength = combined.length - (combined.length % 4);
        if (completeLength > 0) {
          const floatChunk = new Float32Array(
            combined.buffer,
            combined.byteOffset,
            completeLength / 4
          );
          // Prepare an output chunk with one 8-bit value per float.
          const outChunk = new Uint8Array(completeLength / 4);
          if (range === 0) {
            outChunk.fill(0);
          } else {
            for (let i = 0; i < floatChunk.length; i++) {
              outChunk[i] = Math.round(
                ((floatChunk[i] - minVal) / range) * 255
              );
            }
          }
          chunks.push(outChunk);
        }
        leftover = combined.slice(completeLength);
      }
    }
    rawDataBlob = new Blob(chunks);
  } else {
    throw new Error("MRC file data is in an incompatible format.");
  }

  // Create a new RAW File (renaming .mrc to .raw)
  const rawFileName = mrcFile.name.replace(/\.mrc$/i, ".raw");
  const rawFile = new File([rawDataBlob], rawFileName, {
    type: "application/octet-stream",
  });

  // Generate the settings object.
  const settings = new VolumeSettings({
    file: rawFileName,
    size: { x: nx, y: ny, z: nz },
    ratio: { x: 1.0, y: 1.0, z: 1.0 },
    bytesPerVoxel: bytesPerVoxel,
    usedBits: usedBits,
    skipBytes: 0,
    isLittleEndian: true,
    isSigned: isSigned,
    addValue: 0,
  });

  return { rawFile, settings };
}
