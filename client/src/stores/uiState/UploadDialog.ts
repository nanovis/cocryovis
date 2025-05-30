import {
  flow,
  getParentOfType,
  Instance,
  isAlive,
  SnapshotIn,
  types,
} from "mobx-state-tree";
import { VolumeSettings } from "../../utils/VolumeSettings";
import { toast } from "react-toastify";
import * as Utils from "../../utils/Helpers";

export enum Tabs {
  fromFile = "fromFile",
  fromUrl = "fromUrl",
  fromCryoET = "fromCryoET",
}

export const formatOptions = [
  "8-bit",
  "16-bit Unsigned",
  "16-bit Signed",
  "32-bit Signed",
  "32-bit Float",
  "64-bit Float",
] as readonly string[];

export const endianOptions = [
  "Little Endian",
  "Big Endian",
] as readonly string[];

export const fileTypeOptions = ["raw", "mrc"] as readonly string[];

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
    get dialog(): UploadDialogInstance {
      return getParentOfType(self, UploadDialog);
    },
    get isRawUpload() {
      return !!self.pendingFile?.name.toLowerCase().endsWith(".raw");
    },
    get isMrcUpload() {
      return !!self.pendingFile?.name.toLowerCase().endsWith(".mrc");
    },
    get hasValidParameters() {
      return (
        self.width !== undefined &&
        self.height !== undefined &&
        self.depth !== undefined &&
        self.format !== undefined &&
        self.endian !== undefined
      );
    },
  }))
  .views((self) => ({
    get isValid() {
      return (
        self.pendingFile !== null &&
        (!self.isRawUpload || self.hasValidParameters)
      );
    },
    get canSetParameters(): boolean {
      return !self.dialog.isBusy && self.isRawUpload;
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
    get dialog(): UploadDialogInstance {
      return getParentOfType(self, UploadDialog);
    },
    get isRawUpload() {
      return self.fileType === "raw";
    },
    get isMrcUpload() {
      return self.fileType === "mrc";
    },
    get hasValidParameters() {
      return (
        self.width !== undefined &&
        self.height !== undefined &&
        self.depth !== undefined &&
        self.format !== undefined &&
        self.endian !== undefined
      );
    },
  }))
  .views((self) => ({
    get isValid() {
      return (
        self.url.length > 0 && (!self.isRawUpload || self.hasValidParameters)
      );
    },
    canSetParameters(): boolean {
      return !self.dialog.isBusy && self.isRawUpload;
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

export const CryoETUploadInputs = types
  .model({
    cryoETId: types.maybe(types.number),
    lastId: types.maybe(types.number),
    name: types.optional(types.string, ""),
    url: types.optional(types.string, ""),
    width: types.optional(types.string, ""),
    height: types.optional(types.string, ""),
    depth: types.optional(types.string, ""),
  })
  .views((self) => ({
    get isValid() {
      return self.url.length > 0;
    },
    get hasSameId() {
      return self.lastId !== undefined && self.cryoETId === self.lastId;
    },
    get hasDifferentId() {
      return self.lastId !== undefined && self.cryoETId !== self.lastId;
    },
  }))
  .actions((self) => ({
    setCryoETId(value: string) {
      const parsedValue = parseInt(value);
      self.cryoETId =
        isNaN(parsedValue) || parsedValue < 0 ? undefined : parsedValue;
    },
    setUrl(url: string) {
      self.url = url;
    },
    setWidth(width: string) {
      self.width = width;
    },
    setHeight(height: string) {
      self.height = height;
    },
    setDepth(depth: string) {
      self.depth = depth;
    },
    reset() {
      self.cryoETId = undefined;
      self.lastId = undefined;
      self.name = "";
      self.url = "";
      self.width = "";
      self.height = "";
      self.depth = "";
    },
  }))
  .actions((self) => ({
    fetchCryoETMetadata: flow(function* fetchCryoETMetadata() {
      if (!self.cryoETId) {
        return;
      }
      let toastId = null;
      try {
        toastId = toast.loading("Fetching CryoET metadata...");
        const response = yield Utils.sendReq(
          `cryoet/${self.cryoETId}`,
          {
            method: "GET",
            credentials: "include",
          },
          false
        );
        if (!isAlive(self)) {
          return;
        }
        const metadata = yield response.json();
        if (!isAlive(self)) {
          return;
        }

        if (
          !metadata ||
          !metadata.https_mrc_file ||
          !metadata.size_x ||
          !metadata.size_y ||
          !metadata.size_z
        ) {
          throw new Error(
            "CryoET metadata does not contain all required fields"
          );
        }

        self.setUrl(metadata.https_mrc_file);
        self.setWidth(metadata.size_x.toString());
        self.setHeight(metadata.size_y.toString());
        self.setDepth(metadata.size_z.toString());
        self.name = metadata.name;

        self.lastId = self.cryoETId;

        toast.update(toastId, {
          render: "CryoET metadata fetched successfully",
          type: "success",
          isLoading: false,
          autoClose: 2000,
          closeOnClick: true,
        });
      } catch (error) {
        Utils.updateToastWithErrorMsg(toastId, error);
        console.error("Error fetching CryoET metadata:", error);
      }
    }),
  }));

export interface CryoETUploadInputsInstance
  extends Instance<typeof CryoETUploadInputs> {}
export interface CryoETUploadInputsSnapshotIn
  extends SnapshotIn<typeof CryoETUploadInputs> {}

export const UploadDialog = types
  .model({
    tab: types.optional(types.enumeration(Object.values(Tabs)), Tabs.fromFile),
    fileUploadInputs: types.optional(FileUploadInputs, {}),
    urlUploadInputs: types.optional(UrlUploadInputs, {}),
    cryoETUploadInputs: types.optional(CryoETUploadInputs, {}),
  })
  .volatile(() => ({
    isBusy: false,
  }))
  .views((self) => ({
    get isValid() {
      if (self.tab === "fromFile") {
        return self.fileUploadInputs.isValid;
      } else if (self.tab === "fromUrl") {
        return self.urlUploadInputs.isValid;
      } else {
        return self.cryoETUploadInputs.isValid;
      }
    },
  }))
  .actions((self) => ({
    setTab(tab: Tabs) {
      self.tab = tab;
    },
    setIsBusy(isBusy: boolean) {
      self.isBusy = isBusy;
    },
    resetCurrentTab() {
      if (self.tab === "fromFile") {
        self.fileUploadInputs.reset();
      } else if (self.tab === "fromUrl") {
        self.urlUploadInputs.reset();
      } else {
        self.cryoETUploadInputs.reset();
      }
    },
  }));

export interface UploadDialogInstance extends Instance<typeof UploadDialog> {}
export interface UploadDialogSnapshotIn
  extends SnapshotIn<typeof UploadDialog> {}
