import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { VolumeSettings } from "../../functions/VolumeSettings";
import { set } from "mobx";

export const formatOptions = [
  "8-bit",
  "16-bit Unsigned",
  "16-bit Signed",
  "32-bit Signed",
  "32-bit Float",
  "64-bit Float",
];

export const endianOptions = ["Little Endian", "Big Endian"];

export const fileTypeOptions = ["raw", "mrc"];

function stringToPositiveInteger(value: string) {
  const parsedValue = parseInt(value);
  return isNaN(parsedValue) || parsedValue <= 0 ? undefined : parsedValue;
}

export const FileUploadInputs = types
  .model({
    pendingFile: types.frozen<File | null>(null),
    width: types.maybe(types.refinement(types.integer, (value) => value > 0)),
    height: types.maybe(types.refinement(types.integer, (value) => value > 0)),
    depth: types.maybe(types.refinement(types.integer, (value) => value > 0)),
    format: types.maybe(types.enumeration(formatOptions)),
    endian: types.optional(types.enumeration(endianOptions), "Little Endian"),
  })
  .views((self) => ({
    rawUpload() {
      return self.pendingFile?.name.toLowerCase().endsWith(".raw");
    },
    mrcUpload() {
      return self.pendingFile?.name.toLowerCase().endsWith(".mrc");
    },
    isValid() {
      return self.pendingFile && (!this.rawUpload() || this.validParameters());
    },
    validParameters() {
      return (
        self.width && self.height && self.depth && self.format && self.endian
      );
    },
  }))
  .actions((self) => ({
    setPendingFile(file: File | null) {
      if (!file) {
        self.pendingFile = null;
        return;
      }
      self.pendingFile = file;
    },
    getFile() {
      if (!self.pendingFile) throw new Error("No file uploaded.");
      return self.pendingFile as File;
    },
    setWidth(width: string) {
      self.width = stringToPositiveInteger(width);
    },
    setHeight(height: string) {
      self.height = stringToPositiveInteger(height);
    },
    setDepth(depth: string) {
      self.depth = stringToPositiveInteger(depth);
    },
    setFormat(format?: string) {
      if (!format || formatOptions.includes(format)) {
        self.format = format;
      }
    },
    setEndian(endian?: string) {
      self.endian =
        endian && endianOptions.includes(endian) ? endian : "Little Endian";
    },
    reset() {
      self.pendingFile = null;
      self.width = undefined;
      self.height = undefined;
      self.depth = undefined;
      self.format = undefined;
      self.endian = "Little Endian";
    },
    toVolumeSettings(): VolumeSettings {
      const usedBits = self.format
        ? parseInt(self.format.split("-")[0])
        : undefined;
      const bytesPerVoxel = usedBits ? Math.ceil(usedBits / 8) : undefined;

      const isSigned = self.format ? self.format.includes("Signed") : undefined;
      const isLittleEndian = self.endian === "Little Endian";

      if (!self.width || !self.height || !self.depth) {
        throw new Error("Missing width, height, or depth.");
      }

      return new VolumeSettings({
        file: self.pendingFile?.name,
        size: {
          x: self.width,
          y: self.height,
          z: self.depth,
        },
        isSigned: isSigned,
        isLittleEndian: isLittleEndian,
        bytesPerVoxel: bytesPerVoxel,
        usedBits: usedBits,
      });
    },
  }));

export interface FileUploadInputsInstance
  extends Instance<typeof FileUploadInputs> {}
export interface FileUploadInputsSnapshotIn
  extends SnapshotIn<typeof FileUploadInputs> {}

export const UrlUploadInputs = types
  .model({
    url: types.optional(types.string, ""),
    fileType: types.optional(types.enumeration(fileTypeOptions), "mrc"),
    width: types.maybe(types.refinement(types.integer, (value) => value > 0)),
    height: types.maybe(types.refinement(types.integer, (value) => value > 0)),
    depth: types.maybe(types.refinement(types.integer, (value) => value > 0)),
    format: types.maybe(types.enumeration(formatOptions)),
    endian: types.optional(types.enumeration(endianOptions), "Little Endian"),
  })
  .views((self) => ({
    rawUpload() {
      return self.fileType === "raw";
    },
    mrcUpload() {
      return self.fileType === "mrc";
    },
    isValid() {
      return (
        self.url.length > 0 && (!this.rawUpload() || this.validParameters())
      );
    },
    validParameters() {
      return (
        self.width && self.height && self.depth && self.format && self.endian
      );
    },
  }))
  .actions((self) => ({
    setUrl(url: string) {
      self.url = url;
    },
    setFileType(fileType: string) {
      self.fileType = fileTypeOptions.includes(fileType) ? fileType : "mrc";
    },
    setWidth(width: string) {
      self.width = stringToPositiveInteger(width);
    },
    setHeight(height: string) {
      self.height = stringToPositiveInteger(height);
    },
    setDepth(depth: string) {
      self.depth = stringToPositiveInteger(depth);
    },
    setFormat(format?: string) {
      if (!format || formatOptions.includes(format)) {
        self.format = format;
      }
    },
    setEndian(endian?: string) {
      self.endian =
        endian && endianOptions.includes(endian) ? endian : "Little Endian";
    },
    reset() {
      self.url = "";
      self.fileType = "mrc";
      self.width = undefined;
      self.height = undefined;
      self.depth = undefined;
      self.format = undefined;
      self.endian = "Little Endian";
    },
    toVolumeSettings(): VolumeSettings {
      const usedBits = self.format
        ? parseInt(self.format.split("-")[0])
        : undefined;
      const bytesPerVoxel = usedBits ? Math.ceil(usedBits / 8) : undefined;

      const isSigned = self.format ? self.format.includes("Signed") : undefined;
      const isLittleEndian = self.endian === "Little Endian";

      if (!self.width || !self.height || !self.depth) {
        throw new Error("Missing width, height, or depth.");
      }

      return new VolumeSettings({
        size: {
          x: self.width,
          y: self.height,
          z: self.depth,
        },
        isSigned: isSigned,
        isLittleEndian: isLittleEndian,
        bytesPerVoxel: bytesPerVoxel,
        usedBits: usedBits,
      });
    },
  }));

export interface UrlUploadInputsInstance
  extends Instance<typeof UrlUploadInputs> {}
export interface UrlUploadInputsSnapshotIn
  extends SnapshotIn<typeof UrlUploadInputs> {}

export const UploadDialog = types
  .model({
    tab: types.optional(types.enumeration(["fromFile", "fromUrl"]), "fromFile"),
    fileUploadInputs: types.optional(FileUploadInputs, {}),
    urlUploadInputs: types.optional(UrlUploadInputs, {}),
  })
  .actions((self) => ({
    setTab(tab: string) {
      self.tab = tab;
    },
    resetCurrentTab() {
      if (self.tab === "fromFile") {
        self.fileUploadInputs.reset();
      } else if (self.tab === "fromUrl") {
        self.urlUploadInputs.reset();
      }
    },
    isValid() {
      return self.tab === "fromFile"
        ? self.fileUploadInputs.isValid()
        : self.urlUploadInputs.isValid();
    },
  }));

export interface UploadDialogInstance extends Instance<typeof UploadDialog> {}
export interface UploadDialogSnapshotIn
  extends SnapshotIn<typeof UploadDialog> {}
