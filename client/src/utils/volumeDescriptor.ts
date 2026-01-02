import {
  type transferFunctionSchema,
  volumeSettings,
} from "#schemas/componentSchemas/volume-settings-schema.mjs";
import type z from "zod";
import * as Utils from "./helpers";
import { fileTypeSchema } from "#schemas/volume-data-path-schema.mjs";
import type { FileMap } from "./helpers";

export const BIT_OPTIONS = [8, 16, 32, 64] as const;
export type BitOptions = (typeof BIT_OPTIONS)[number];

export const BYTES_PER_VOXEL_OPTIONS = [1, 2, 4, 8] as const;
export type BytesPerVoxelOptions = (typeof BYTES_PER_VOXEL_OPTIONS)[number];

export type VolumeSettings = z.output<typeof volumeSettings>;

export type FileTypeOptions = z.infer<typeof fileTypeSchema>;
export const fileTypeOptions =
  fileTypeSchema.options as readonly FileTypeOptions[];

export const volumeDescriptorSettingsSchema = volumeSettings.omit({
  file: true,
});
export type VolumeDescriptorSettings = z.output<
  typeof volumeDescriptorSettingsSchema
>;
export type TransferFunction = z.infer<typeof transferFunctionSchema>;

export function volumeSettingsFromJson(json: string): VolumeSettings {
  const data = JSON.parse(json);
  const volumeSettingsObject = volumeSettings.parse(data);

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

type VolumeDataInput =
  | {
      file: File;
    }
  | {
      url: string;
      fileType: FileTypeOptions;
    }
  | {
      arrayBuffer: ArrayBuffer;
    };

export class VolumeData {
  file: File | undefined;
  url: string | undefined;
  fileType: FileTypeOptions | undefined;

  private arrayBuffer?: ArrayBuffer | undefined;

  constructor(input: VolumeDataInput) {
    Object.assign(this, input);
    if (this.fileType) {
      if (!(fileTypeOptions as readonly string[]).includes(this.fileType)) {
        throw new Error("Invalid file type.");
      }
    }
    if (!this.url && !this.file && !this.arrayBuffer) {
      throw new Error("VolumeData must have either url, file, or data.");
    }
  }

  async getVolumeData(): Promise<ArrayBuffer> {
    if (this.arrayBuffer) return this.arrayBuffer;
    if (this.file) {
      this.arrayBuffer = await this.file.arrayBuffer();
      return this.arrayBuffer;
    }
    if (this.url) {
      if (!this.fileType) throw new Error("Missing file type.");
      this.file = await fetchVolumeFromUrl(this.url, this.fileType);
      this.arrayBuffer = await this.file.arrayBuffer();
      return this.arrayBuffer;
    }
    throw new Error("Missing volume data or file.");
  }
}

export class VolumeDescriptor {
  volumeData: VolumeData;
  readonly settings?: VolumeDescriptorSettings;
  readonly transferFunction?: TransferFunction;

  constructor(
    volumeData: VolumeData,
    settings?: VolumeDescriptorSettings,
    transferFunction?: TransferFunction
  ) {
    this.settings = settings;
    this.volumeData = volumeData;
    this.transferFunction = transferFunction;
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
      new VolumeData({ file: rawFile }),
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
