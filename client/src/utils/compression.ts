import { unzipSync, zipSync, type ZipOptions } from "fflate";
import { toBlobSafeUint8Array } from "./helpers";

export interface OptionalCompressionConfig {
  compress?: boolean;
  thresholdBytes?: number;
  zipOptions?: ZipOptions;
}

export const DEFAULT_COMPRESSION_THRESHOLD_BYTES = 128 * 1024 * 1024;

function removeFileExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

export async function compressFileToZip(file: File, options?: ZipOptions) {
  if (file.name.toLowerCase().endsWith(".zip")) {
    return file;
  }

  const fileData = new Uint8Array(await file.arrayBuffer());
  const zippedData = toBlobSafeUint8Array(
    zipSync({ [file.name]: fileData }, options)
  );

  const zipName = `${removeFileExtension(file.name)}.zip`;
  return new File([zippedData], zipName, { type: "application/zip" });
}

export async function maybeCompressFileToZip(
  file: File,
  config?: OptionalCompressionConfig
) {
  const enabled = config?.compress ?? true;
  if (!enabled) {
    return file;
  }

  const thresholdBytes =
    config?.thresholdBytes ?? DEFAULT_COMPRESSION_THRESHOLD_BYTES;
  if (file.size > thresholdBytes) {
    return file;
  }

  return await compressFileToZip(file, config?.zipOptions);
}

export async function uncompressZipToFileMap(archive: Blob) {
  const archiveData = new Uint8Array(await archive.arrayBuffer());
  const entries = unzipSync(archiveData);
  const fileMap = new Map<string, File>();

  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith("/")) {
      continue;
    }
    fileMap.set(path, new File([toBlobSafeUint8Array(data)], path));
  }

  return fileMap;
}
