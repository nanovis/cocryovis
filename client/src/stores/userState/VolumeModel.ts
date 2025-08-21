import { flow, Instance, isAlive, SnapshotIn, types } from "mobx-state-tree";
import { RawVolume, RawVolumeSnapshotIn } from "./RawVolumeModel";
import { SparseLabelVolume, SparseVolumeSnapshotIn } from "./SparseVolumeModel";
import { PseudoLabelVolume, PseudoVolumeSnapshotIn } from "./PseudoVolumeModel";
import { ResultSnapshotIn, VolumeResults } from "./ResultModel";
import * as Utils from "../../utils/Helpers";
import { toast } from "react-toastify";
import { VolumeSettings } from "../../utils/VolumeSettings";
import { rawVolumeDataSchema } from "#schemas/componentSchemas/raw-volume-data-schema.mjs";
import z from "zod";
import { volumeSchema } from "#schemas/componentSchemas/volume-schema.mjs";
import { volumesDeepSchemaRes } from "#schemas/volume-path-schema.mjs";
import { sparseLabelVolumeDataSchema } from "#schemas/componentSchemas/sparse-label-volume-data-schema.mjs";
import { pseudoLabelVolumeDataSchema } from "#schemas/componentSchemas/pseudo-label-volume-data-schema.mjs";
import { getVolumesFromProjectDeep } from "../../api/volume";
import * as volumeApi from "../../api/volume";
import { createFromFiles, createFromMrcFile, createFromUrl, removeFromVolume } from "../../api/volumeData";

export interface VolumeDB {
  id: number;
  name: string;
  description: string;
  creatorId: number | null;
  rawData?: RawVolumeSnapshotIn | null;
  rawDataId: number | null;
  sparseVolumes?: SparseVolumeSnapshotIn[];
  pseudoVolumes?: PseudoVolumeSnapshotIn[];
  results?: ResultSnapshotIn[];
}

export type LabeledVolumeTypes =
  | "SparseLabeledVolumeData"
  | "PseudoLabeledVolumeData";

export const Volume = types
  .model({
    id: types.identifierNumber,
    name: types.string,
    description: types.string,
    creatorId: types.maybeNull(types.integer),
    rawData: types.maybeNull(RawVolume),
    rawDataId: types.maybeNull(types.integer),
    sparseVolumes: types.map(SparseLabelVolume),
    pseudoVolumes: types.map(PseudoLabelVolume),
    volumeResults: VolumeResults,
    sparseLabelColors: types.optional(
      types.array(types.string),
      new Array(4).fill("#ffffff")
    ),
    shownAnnotations: types.optional(
      types.array(types.boolean),
      new Array(4).fill(false)
    ),
  })
  .views((self) => ({
    get sparseVolumeArray() {
      return Array.from(self.sparseVolumes.values());
    },
    get pseudoVolumeArray() {
      return Array.from(self.pseudoVolumes.values());
    },
  }))
  .actions((self) => ({
    setRawVolume(volume: RawVolumeSnapshotIn | undefined) {
      if (!volume) return;

      self.rawData = RawVolume.create(volume);
    },
    addSparseVolume(volume: SparseVolumeSnapshotIn) {
      self.sparseVolumes.set(volume.id, volume);
    },
    addPseudoVolumes(volumes: PseudoVolumeSnapshotIn[] | undefined) {
      if (!volumes) return;

      volumes?.forEach((volume) => {
        self.pseudoVolumes.set(volume.id, volume);
      });
    },
    setSparseLabelColor(index: number, color: string) {
      self.sparseLabelColors[index] = color;

      if (window.WasmModule) {
        const parsedColor = Utils.fromHexColor(color);
        window.WasmModule.set_annotation_color(
          index,
          parsedColor.r / 255,
          parsedColor.g / 255,
          parsedColor.b / 255
        );
      }
    },
    setShownAnnotation(index: number, show: boolean) {
      self.shownAnnotations[index] = show;

      if (window.WasmModule) {
        window.WasmModule.show_annotation(index, self.shownAnnotations[index]);
      }
    },
  }))
  .actions((self) => ({
    toggleShownAnnotation(index: number) {
      self.setShownAnnotation(index, !self.shownAnnotations[index]);
    },
    setSparseVolumes(volumes: SparseVolumeSnapshotIn[] | undefined) {
      if (!volumes) return;

      self.sparseVolumes.clear();
      volumes?.forEach((volume) => {
        self.addSparseVolume(volume);
      });
    },
    setPseudoVolumes(volumes: PseudoVolumeSnapshotIn[] | undefined) {
      if (!volumes) return;

      self.pseudoVolumes.clear();
      self.addPseudoVolumes(volumes);
    },
    uploadRawVolume: flow(function* uploadRawVolume(
      rawFile: File,
      settingsFile: File
    ) {
      const formData = new FormData();
      formData.append("files", rawFile);
      formData.append("files", settingsFile);

      const rawData: z.infer<typeof rawVolumeDataSchema> =
        yield createFromFiles("RawVolumeData", self.id, formData);
      if (!isAlive(self)) {
        return;
      }
      self.setRawVolume(rawData);
    }),
    uploadMrcVolume: flow(function* uploadMrcVolume(mrcFile: File) {
      if (!mrcFile || !mrcFile.name.endsWith(".mrc")) {
        toast.error(`No MRC file selected.`);
        throw new Error("Too many files selected.");
      }

      const formData = new FormData();
      formData.append("files", mrcFile);

      const rawData: z.infer<typeof rawVolumeDataSchema> =
        yield createFromMrcFile(self.id, formData);

      if (!isAlive(self)) {
        return;
      }

      self.setRawVolume(rawData);
    }),
    uploadFromUrl: flow(function* uploadFromUrl(
      url: string,
      fileType: "mrc" | "raw",
      volumeSettings?: VolumeSettings
    ) {
      if (!Utils.isValidHttpUrl(url)) {
        toast.error(`Invalid URL.`);
        throw new Error("Invalid URL.");
      }
      if (volumeSettings !== undefined && volumeSettings.file === undefined) {
        toast.error(`Invalid URL.`);
        throw new Error("Missing VolumeSettings");
      }
      //TODO uros fix
      const rawData: z.infer<typeof rawVolumeDataSchema> = yield createFromUrl(
        self.id,
        { url: url, fileType: fileType, volumeSettings: volumeSettings }
      );
      if (!isAlive(self)) {
        return;
      }

      self.setRawVolume(rawData);
    }),
    uploadMrcUrl: flow(function* uploadMrcVolume(url: string) {
      if (!Utils.isValidHttpUrl(url)) {
        toast.error(`Invalid URL.`);
        throw new Error("Invalid URL.");
      }
      //TODO fix
      const response = yield Utils.sendRequestWithToast(
        `volume/${self.id}/volumeData/RawVolumeData/from-mrc-url`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: url,
          }),
        }
      );
      if (!isAlive(self)) {
        return;
      }
      const rawData: z.infer<typeof rawVolumeDataSchema> =
        yield response.json();
      if (!isAlive(self)) {
        return;
      }

      self.setRawVolume(rawData);
    }),
    uploadTiltSeries: flow(function* uploadMrcVolume(
      parsedSettings: any,
      fileData: ArrayBuffer
    ) {
      const formData = new FormData();
      formData.append(
        "files",
        new Blob([fileData], {
          type: "application/octet-stream",
        }),
        parsedSettings.file
      );

      formData.append(
        "files",
        new Blob([JSON.stringify(parsedSettings)], {
          type: "application/json",
        }),
        "settings.json"
      );

      const rawData: z.infer<typeof rawVolumeDataSchema> =
        yield createFromFiles("RawVolumeData", self.id, formData);
      if (!isAlive(self)) {
        return;
      }

      self.setRawVolume(rawData);
    }),
    uploadSparseLabelVolume: flow(function* uploadSparseLabelVolume(
      files: FileList
    ) {
      const fileMap = yield Utils.unpackAndcreateFileMap(files);
      if (!isAlive(self)) {
        return;
      }

      const validatedFiles = Utils.validateRawFileUpload(fileMap);

      const formData = new FormData();
      validatedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const volume: z.infer<typeof sparseLabelVolumeDataSchema> =
        yield createFromFiles("SparseLabeledVolumeData", self.id, formData);
      if (!isAlive(self)) {
        return;
      }

      self.sparseVolumes.put(volume);
    }),
    uploadPseudoLabelVolume: flow(function* uploadPseudoLabelVolume(
      files: FileList
    ) {
      const fileMap = yield Utils.unpackAndcreateFileMap(files);
      if (!isAlive(self)) {
        return;
      }

      const validatedFiles = Utils.validateRawFileUpload(fileMap);

      const formData = new FormData();
      validatedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const volume: z.infer<typeof pseudoLabelVolumeDataSchema> =
        yield createFromFiles("PseudoLabeledVolumeData", self.id, formData);
      if (!isAlive(self)) {
        return;
      }

      self.addPseudoVolumes([volume]);
    }),
    deleteLabeledVolume: flow(function* deleteLabeledVolume(
      dataType: LabeledVolumeTypes,
      dataId: number
    ) {
      removeFromVolume(dataType, self.id, dataId)
      
      if (dataType == "SparseLabeledVolumeData") {
        self.sparseVolumes.delete(dataId.toString());
      } else if (dataType == "PseudoLabeledVolumeData") {
        self.pseudoVolumes.delete(dataId.toString());
      }
    }),
  }));

export interface VolumeInstance extends Instance<typeof Volume> {}
export interface VolumeSnapshotIn extends SnapshotIn<typeof Volume> {}

export const ProjectVolumes = types
  .model({
    projectId: types.identifierNumber,
    volumes: types.map(Volume),
    selectedVolumeId: types.maybe(types.integer),
  })
  .views((self) => ({
    get volumeArray() {
      return Array.from(self.volumes.values());
    },
    get selectedVolume() {
      return self.selectedVolumeId
        ? self.volumes.get(self.selectedVolumeId)
        : undefined;
    },
  }))
  .views((self) => ({
    get canVisualizeSparseLabels() {
      return (
        self.selectedVolume !== undefined &&
        self.selectedVolume.sparseVolumes.size > 0
      );
    },
    get canVisualizePseudoLabels() {
      return (
        self.selectedVolume !== undefined &&
        self.selectedVolume.pseudoVolumes.size > 0
      );
    },
  }))
  .actions((self) => ({
    setSelectedVolumeId(volumeId: number | undefined) {
      if (volumeId && !self.volumes.has(volumeId)) {
        throw new Error(`Volume with id ${volumeId} not found`);
      }
      self.selectedVolumeId = volumeId;
    },
    addVolume(volume: VolumeDB) {
      self.volumes.set(volume.id, {
        id: volume.id,
        name: volume.name,
        description: volume.description,
        creatorId: volume.creatorId,
        rawData: volume.rawData ?? null,
        rawDataId: volume.rawDataId,
        sparseVolumes: {},
        pseudoVolumes: {},
        volumeResults: { volumeId: volume.id },
      });
      const newVolume = self.volumes.get(volume.id);
      newVolume?.setSparseVolumes(volume.sparseVolumes);
      newVolume?.setPseudoVolumes(volume.pseudoVolumes);
      newVolume?.volumeResults.setResults(volume.results);
    },
  }))
  .actions((self) => ({
    setVolumes(volumes: VolumeDB[]) {
      self.volumes.clear();

      volumes.forEach((volume) => {
        self.addVolume(volume);
      });
    },
    createVolume: flow(function* createVolume(
      name: string,
      description: string
    ) {
      try {
        const volume: z.infer<typeof volumeSchema> =
          yield volumeApi.createVolume(self.projectId, {
            name: name,
            description: description,
          });
        if (!isAlive(self)) {
          return;
        }

        self.addVolume(volume);
        self.selectedVolumeId = volume.id;

        return volume;
      } catch (error) {
        console.error(error);
      }
    }),
    removeVolume: flow(function* removeVolume(volumeId: number) {
      try {
        volumeApi.removeFromProject(self.projectId, volumeId);
        self.volumes.delete(volumeId.toString());
        if (self.selectedVolumeId === volumeId) {
          self.selectedVolumeId = undefined;
        }
      } catch (error) {
        console.error(error);
      }
    }),
  }))
  .actions((self) => ({
    refreshVolumes: flow(function* refreshVolumes() {
      try {
        const volumes: z.infer<typeof volumesDeepSchemaRes> =
          yield getVolumesFromProjectDeep(self.projectId);
        if (!isAlive(self)) {
          return;
        }

        self.volumes.clear();
        self.setVolumes(volumes);

        if (self.selectedVolumeId && !self.volumes.has(self.selectedVolumeId)) {
          self.selectedVolumeId = undefined;
        }

        return self.selectedVolume;
      } catch (error) {
        console.error(error);
      }
    }),
  }));

export interface ProjectVolumesInstance
  extends Instance<typeof ProjectVolumes> {}
