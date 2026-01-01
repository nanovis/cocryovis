import { volumeSettings } from "#schemas/componentSchemas/volume-settings-schema.mjs";
import type z from "zod";
import * as Utils from "./Helpers";
import { fileTypeSchema } from "#schemas/volume-data-path-schema.mjs";

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

export function volumeSettingsFromJson(json: string) {
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

  constructor(volumeData: VolumeData, settings?: VolumeDescriptorSettings) {
    this.settings = settings;
    this.volumeData = volumeData;
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
