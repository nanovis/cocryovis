import {
  type transferFunctionSchema,
  type volumeDescriptorSettingsSchema,
  volumeSettings,
} from "@cocryovis/schemas/componentSchemas/volume-settings-schema";
import type z from "zod";
import * as Utils from "./helpers";
import { fileTypeSchema } from "@cocryovis/schemas/volume-data-path-schema";
import { type FileMap, isMrcFile, isRawFile } from "./helpers";
import {
  convertMRCToRaw,
  getDescriptorFromMrcHeaderOrFile,
} from "@/utils/mrcParser";

export const BIT_OPTIONS = [8, 16, 32, 64] as const;
export type BitOptions = (typeof BIT_OPTIONS)[number];

export const BYTES_PER_VOXEL_OPTIONS = [1, 2, 4, 8] as const;
export type BytesPerVoxelOptions = (typeof BYTES_PER_VOXEL_OPTIONS)[number];

export type VolumeSettings = z.output<typeof volumeSettings>;

export type FileTypeOptions = z.infer<typeof fileTypeSchema>;
export const fileTypeOptions =
  fileTypeSchema.options as readonly FileTypeOptions[];

export type VolumeDescriptorSettings = z.output<
  typeof volumeDescriptorSettingsSchema
>;
export type TransferFunction = z.infer<typeof transferFunctionSchema>;

export function volumeSettingsFromJson(json: string): VolumeSettings {
  const volumeSettingsObject = volumeSettings.parse(JSON.parse(json));

  if (
    !BYTES_PER_VOXEL_OPTIONS.some(
      (v) => v === volumeSettingsObject.bytesPerVoxel
    )
  ) {
    throw new Error(`Invalid VolumeSettings JSON: 'bytesPerVoxel' must be one of 
        ${BYTES_PER_VOXEL_OPTIONS.join(", ")}.`);
  }

  if (!BIT_OPTIONS.some((v) => v === volumeSettingsObject.usedBits)) {
    throw new Error(
      `Invalid VolumeSettings JSON: 'usedBits' must be one of ${BIT_OPTIONS.join(", ")}`
    );
  }

  return volumeSettingsObject;
}

export function volumeSettingsToJson(volumeSettingsObject: VolumeSettings) {
  return JSON.stringify(volumeSettingsObject);
}

export function volumeSettingsToFile(volumeSettingsObject: VolumeSettings) {
  return new File(
    [volumeSettingsToJson(volumeSettingsObject)],
    Utils.removeExtensionFromPath(volumeSettingsObject.file) + ".json",
    { type: "application/json" }
  );
}
//
// type VolumeDataInput =
//   | {
//       file: File;
//     }
//   | {
//       url: string;
//       fileType: FileTypeOptions;
//     }
//   | {
//       arrayBuffer: ArrayBuffer;
//     };
//
// export class VolumeData {
//   file: File | undefined;
//   url: string | undefined;
//   fileType: FileTypeOptions | undefined;
//
//   private arrayBuffer?: ArrayBuffer | undefined;
//
//   constructor(input: VolumeDataInput) {
//     Object.assign(this, input);
//     if (this.fileType) {
//       if (!(fileTypeOptions as readonly string[]).includes(this.fileType)) {
//         throw new Error("Invalid file type.");
//       }
//     }
//     if (!this.url && !this.file && !this.arrayBuffer) {
//       throw new Error("VolumeData must have either url, file, or data.");
//     }
//   }
//
//   async getVolumeData(): Promise<ArrayBuffer> {
//     if (this.arrayBuffer) return this.arrayBuffer;
//     if (this.file) {
//       this.arrayBuffer = await this.file.arrayBuffer();
//       return this.arrayBuffer;
//     }
//     if (this.url) {
//       if (!this.fileType) throw new Error("Missing file type.");
//       this.file = await fetchVolumeFromUrl(this.url, this.fileType);
//       this.arrayBuffer = await this.file.arrayBuffer();
//       return this.arrayBuffer;
//     }
//     throw new Error("Missing volume data or file.");
//   }
// }

export abstract class VolumeData {
  abstract getVolumeData(): ArrayBuffer | Promise<ArrayBuffer>;
}

export abstract class MrcVolumeData extends VolumeData {
  abstract getSettings(): Promise<VolumeDescriptorSettings>;
}

export class BufferVolumeData extends VolumeData {
  private readonly arrayBuffer: ArrayBuffer;

  constructor(arrayBuffer: ArrayBuffer) {
    super();
    this.arrayBuffer = arrayBuffer;
  }

  override getVolumeData(): ArrayBuffer {
    return this.arrayBuffer;
  }
}

export class RawFileVolumeData extends VolumeData {
  private arrayBuffer: ArrayBuffer | undefined;
  readonly file: File;

  constructor(file: File) {
    super();
    if (!isRawFile(file.name)) {
      throw new Error("Invalid raw file.");
    }
    this.file = file;
  }

  override async getVolumeData(): Promise<ArrayBuffer> {
    if (!this.arrayBuffer) {
      this.arrayBuffer = await this.file.arrayBuffer();
    }
    return this.arrayBuffer;
  }
}

export class MrcFileVolumeData extends MrcVolumeData {
  readonly file: File;

  private arrayBuffer: ArrayBuffer | undefined;
  private settings: VolumeDescriptorSettings | undefined;

  constructor(file: File) {
    super();
    if (!isMrcFile(file.name)) {
      throw new Error("Invalid mrc file.");
    }
    this.file = file;
  }

  override async getVolumeData(): Promise<ArrayBuffer> {
    if (!this.arrayBuffer) {
      const { rawFile, settings } = await convertMRCToRaw(this.file);
      this.arrayBuffer = await rawFile.arrayBuffer();
      this.settings = settings;
    }
    return this.arrayBuffer;
  }

  async getSettings(): Promise<VolumeDescriptorSettings> {
    if (!this.settings) {
      this.settings = await getDescriptorFromMrcHeaderOrFile(this.file);
    }
    return this.settings;
  }
}

export class RawUrlVolumeData extends VolumeData {
  private arrayBuffer: ArrayBuffer | undefined;
  readonly url: string;

  constructor(url: string) {
    super();
    this.url = url;
  }

  override async getVolumeData(): Promise<ArrayBuffer> {
    if (!this.arrayBuffer) {
      const file = await fetchVolumeFromUrl(this.url, "raw");
      this.arrayBuffer = await file.arrayBuffer();
    }
    return this.arrayBuffer;
  }
}

export class MrcUrlVolumeData extends MrcVolumeData {
  readonly url: string;

  private arrayBuffer: ArrayBuffer | undefined;
  private settings: VolumeDescriptorSettings | undefined;

  constructor(url: string) {
    super();
    this.url = url;
  }

  private async getData() {
    if (!this.arrayBuffer || !this.settings) {
      const file = await fetchVolumeFromUrl(this.url, "mrc");
      const { rawFile, settings } = await convertMRCToRaw(file);
      this.arrayBuffer = await rawFile.arrayBuffer();
      this.settings = settings;
    }
    return { arrayBuffer: this.arrayBuffer, settings: this.settings };
  }

  override async getVolumeData(): Promise<ArrayBuffer> {
    const { arrayBuffer } = await this.getData();
    return arrayBuffer;
  }

  async getSettings(): Promise<VolumeDescriptorSettings> {
    const { settings } = await this.getData();
    return settings;
  }
}

export class VolumeDescriptor {
  readonly volumeData: VolumeData;
  private readonly settings: VolumeDescriptorSettings | undefined;
  readonly transferFunction?: TransferFunction;

  constructor(
    volumeData: VolumeData,
    settings?: VolumeDescriptorSettings,
    transferFunction?: TransferFunction
  ) {
    this.volumeData = volumeData;
    this.transferFunction = transferFunction;
    this.settings = settings;
  }

  async getSettings(): Promise<VolumeDescriptorSettings> {
    if (this.volumeData instanceof MrcVolumeData) {
      return await this.volumeData.getSettings();
    }

    if (!this.settings) {
      throw new Error("Missing volume settings.");
    }
    return this.settings;
  }

  static async fromFileMap(
    fileMap: FileMap,
    transferFunction?: TransferFunction
  ): Promise<VolumeDescriptor> {
    let settingsFile: File | undefined;
    for (const file of fileMap.values()) {
      if (!settingsFile && file.name.endsWith(".json")) {
        settingsFile = file;
        break;
      }
    }
    if (!settingsFile) {
      throw new Error("Missing volume settings file.");
    }
    const settingFileContent = await settingsFile.text();
    const settings = volumeSettingsFromJson(settingFileContent);
    const rawFile = fileMap.get(settings.file);
    if (!rawFile) {
      throw new Error("Missing volume data file.");
    }
    return new VolumeDescriptor(
      new RawFileVolumeData(rawFile),
      settings,
      transferFunction
    );
  }
}

export async function fetchVolumeFromUrl(
  url: string,
  fileType: FileTypeOptions
): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  let filename = Utils.getFilenameFromHeader(response);
  if (!filename) {
    filename = new Date().toISOString();
  }
  filename = Utils.removeExtensionFromPath(filename) + "." + fileType;

  return new File([blob], filename);
}
