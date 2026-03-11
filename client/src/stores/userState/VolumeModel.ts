import type { Instance, SnapshotIn } from "mobx-state-tree";
import { flow, isAlive, types, getParentOfType } from "mobx-state-tree";
import type { RawVolumeSnapshotIn } from "./RawVolumeModel";
import { RawVolume } from "./RawVolumeModel";
import type {
  SparseVolumeInstance,
  SparseVolumeSnapshotIn,
} from "./SparseVolumeModel";
import { SparseLabelVolume } from "./SparseVolumeModel";
import type {
  PseudoVolumeInstance,
  PseudoVolumeSnapshotIn,
} from "./PseudoVolumeModel";
import { PseudoLabelVolume } from "./PseudoVolumeModel";
import { VolumeResults } from "./ResultModel";
import * as Utils from "../../utils/helpers";
import {
  type FileTypeOptions,
  type VolumeDescriptorSettings,
  type VolumeSettings,
} from "@/utils/volumeDescriptor";
import type { rawVolumeDataSchema } from "@cocryovis/schemas/componentSchemas/raw-volume-data-schema";
import type z from "zod";
import type {
  volumeSchema,
  volumeUpdateSchema,
} from "@cocryovis/schemas/componentSchemas/volume-schema";
import type {
  deepVolumeSchema,
  volumesDeepSchemaRes,
} from "@cocryovis/schemas/volume-path-schema";
import type { sparseLabelVolumeDataSchema } from "@cocryovis/schemas/componentSchemas/sparse-label-volume-data-schema";
import type { pseudoLabelVolumeDataSchema } from "@cocryovis/schemas/componentSchemas/pseudo-label-volume-data-schema";
import { getVolumesFromProjectDeep } from "@/api/volume";
import * as volumeApi from "../../api/volume";
import {
  createFromFiles,
  createFromMrcFile,
  createFromUrl,
  deleteVolumeData,
  type VolumeDataMap,
} from "@/api/volumeData";
import ToastContainer from "../../utils/toastContainer";
import type { VolumeRenderer } from "@/renderer/renderer";
import { RootStore } from "@/stores/RootStore";
import type { volumeSettings } from "@cocryovis/schemas/componentSchemas/volume-settings-schema";
import type { ComboboxOption } from "@/components/shared/ComboboxSearch";

export type LabeledVolumeTypes =
  | "SparseLabeledVolumeData"
  | "PseudoLabeledVolumeData";

export interface VolumeComboboxOption extends ComboboxOption {
  description: string;
}

async function uploadLabeledVolume<T extends keyof VolumeDataMap>(
  id: number,
  files: FileList,
  type: T
): Promise<VolumeDataMap[T]> {
  const fileMap = await Utils.unpackAndcreateFileMap(files);

  const { rawFile, settings } = await Utils.validateRawFileUpload(fileMap);

  const volume = await createFromFiles(type, id, {
    rawFile,
    volumeSettings: settings,
  });

  return volume;
}

export const Volume = types
  .model({
    id: types.identifierNumber,
    name: types.string,
    description: types.string,
    physicalUnit: types.enumeration([
      "PIXEL",
      "UNIT",
      "ANGSTROM",
      "NANOMETER",
      "MICROMETER",
    ]),
    physicalSizeX: types.number,
    physicalSizeY: types.number,
    physicalSizeZ: types.number,
    creatorId: types.maybeNull(types.integer),
    rawData: types.maybeNull(RawVolume),
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
    editingSparseVolumeData: types.safeReference(SparseLabelVolume),
    editingPseudoVolumeData: types.safeReference(PseudoLabelVolume),
  })
  .volatile(() => ({
    volumeDataConfirmDeleteActiveRequest: false,
    updateVolumeActiveRequest: false,
  }))

  .views((self) => ({
    get sparseVolumeArray() {
      return Array.from(self.sparseVolumes.values());
    },
    get pseudoVolumeArray() {
      return Array.from(self.pseudoVolumes.values());
    },
    get renderer(): VolumeRenderer | null {
      const rootStore = getParentOfType<typeof RootStore>(self, RootStore);
      return rootStore.renderer;
    },
    get comboboxOption(): VolumeComboboxOption {
      return {
        value: self.id.toString(),
        description: self.description,
        children: self.name,
      };
    },
  }))
  .actions((self) => ({
    setEditingSparseVolumeData(volumeData: SparseVolumeInstance | undefined) {
      self.editingSparseVolumeData = volumeData;
      self.editingPseudoVolumeData = undefined;
    },
    setEditingPseudoVolumeData(volumeData: PseudoVolumeInstance | undefined) {
      self.editingPseudoVolumeData = volumeData;
      self.editingSparseVolumeData = undefined;
    },
    setVolumeDataConfirmDeleteActiveRequest(active: boolean) {
      self.volumeDataConfirmDeleteActiveRequest = active;
    },
    setRawVolume(volume: RawVolumeSnapshotIn | undefined) {
      if (!volume) return;

      self.rawData = RawVolume.create(volume);
    },
    addSparseVolume(volume: SparseVolumeSnapshotIn) {
      self.sparseVolumes.set(volume.id, volume);
    },
    addPseudoVolumes(volumes: PseudoVolumeSnapshotIn[] | undefined) {
      if (!volumes) return;

      volumes.forEach((volume) => {
        self.pseudoVolumes.set(volume.id, volume);
      });
    },
    setSparseLabelColor(index: number, color: string) {
      if (!self.renderer) return;
      self.sparseLabelColors[index] = color;

      const parsedColor = Utils.fromHexColor(color);
      self.renderer.annotationManager.annotationsDataBuffer.set(index, {
        color: [
          parsedColor.r / 255,
          parsedColor.g / 255,
          parsedColor.b / 255,
          1,
        ],
      });
    },
    setShownAnnotation(index: number, show: boolean) {
      if (!self.renderer) return;
      self.shownAnnotations[index] = show;

      self.renderer.annotationManager.annotationsDataBuffer.set(index, {
        enabled: show,
      });
    },
  }))
  .actions((self) => ({
    toggleShownAnnotation(index: number) {
      self.setShownAnnotation(index, !self.shownAnnotations[index]);
    },
    setSparseVolumes(volumes: SparseVolumeSnapshotIn[] | undefined) {
      if (!volumes) return;

      self.sparseVolumes.clear();
      volumes.forEach((volume) => {
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
      settings: VolumeSettings
    ) {
      const rawData = (yield createFromFiles("RawVolumeData", self.id, {
        rawFile,
        volumeSettings: settings,
      })) as z.infer<typeof rawVolumeDataSchema>;
      if (!isAlive(self)) {
        return;
      }
      self.setRawVolume(rawData);
    }),
    uploadMrcVolume: flow(function* uploadMrcVolume(mrcFile: File) {
      if (!mrcFile.name.endsWith(".mrc")) {
        const toastContainer = new ToastContainer();
        toastContainer.error(`No MRC file selected.`);
        throw new Error("Too many files selected.");
      }

      const formData = new FormData();
      formData.append("files", mrcFile);

      const rawData = (yield createFromMrcFile(self.id, formData)) as z.infer<
        typeof rawVolumeDataSchema
      >;

      if (!isAlive(self)) {
        return;
      }

      self.setRawVolume(rawData);
    }),
    uploadFromUrl: flow(function* uploadFromUrl(
      url: string,
      fileType: FileTypeOptions,
      settings?: VolumeDescriptorSettings
    ) {
      if (!Utils.isValidHttpUrl(url)) {
        throw new Error("Invalid URL.");
      }

      // TODO better unify server and client setting types
      const rawData = (yield createFromUrl(self.id, {
        url: url,
        fileType: fileType,
        volumeSettings: settings,
      })) as z.infer<typeof rawVolumeDataSchema>;
      if (!isAlive(self)) {
        return;
      }

      self.setRawVolume(rawData);
    }),
    uploadTiltSeries: flow(function* uploadTiltSeries(
      parsedSettings: z.infer<typeof volumeSettings>,
      fileData: ArrayBuffer
    ) {
      const rawFile = new File([fileData], parsedSettings.file, {
        type: "application/octet-stream",
      });

      const rawData = (yield createFromFiles("RawVolumeData", self.id, {
        rawFile,
        volumeSettings: parsedSettings,
      })) as z.infer<typeof rawVolumeDataSchema>;
      if (!isAlive(self)) {
        return;
      }

      self.setRawVolume(rawData);
    }),
    uploadSparseLabelVolume: flow(function* uploadSparseLabelVolume(
      files: FileList
    ) {
      const volume = (yield uploadLabeledVolume(
        self.id,
        files,
        "SparseLabeledVolumeData"
      )) as z.infer<typeof sparseLabelVolumeDataSchema>;
      if (!isAlive(self)) {
        return;
      }

      self.sparseVolumes.put(volume);
    }),
    uploadPseudoLabelVolume: flow(function* uploadPseudoLabelVolume(
      files: FileList
    ) {
      const volume = (yield uploadLabeledVolume(
        self.id,
        files,
        "PseudoLabeledVolumeData"
      )) as z.infer<typeof pseudoLabelVolumeDataSchema>;
      if (!isAlive(self)) {
        return;
      }

      self.addPseudoVolumes([volume]);
    }),
    deleteLabeledVolume: flow(function* deleteLabeledVolume(
      dataType: LabeledVolumeTypes,
      dataId: number
    ) {
      yield deleteVolumeData(dataType, dataId);
      if (!isAlive(self)) {
        return;
      }

      if (dataType == "SparseLabeledVolumeData") {
        self.sparseVolumes.delete(dataId.toString());
      } else {
        self.pseudoVolumes.delete(dataId.toString());
      }
    }),
    updateVolume: flow(function* updateVolume(
      changes: z.infer<typeof volumeUpdateSchema>
    ) {
      if (self.updateVolumeActiveRequest) {
        return;
      }
      try {
        self.updateVolumeActiveRequest = true;
        const volume = (yield volumeApi.updateVolume(
          self.id,
          changes
        )) as z.infer<typeof volumeSchema>;
        if (isAlive(self)) {
          self.updateVolumeActiveRequest = false;
        }

        self.name = volume.name;
        self.description = volume.description;
        self.physicalUnit = volume.physicalUnit;
        self.physicalSizeX = volume.physicalSizeX;
        self.physicalSizeY = volume.physicalSizeY;
        self.physicalSizeZ = volume.physicalSizeZ;
        return volume;
      } finally {
        if (isAlive(self)) {
          self.updateVolumeActiveRequest = false;
        }
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
  .volatile(() => ({
    removeVolumeActiveRequest: false,
    createVolumeActiveRequest: false,
  }))
  .views((self) => ({
    get volumeArray() {
      return Array.from(self.volumes.values());
    },
    get selectedVolume() {
      return self.selectedVolumeId
        ? self.volumes.get(self.selectedVolumeId)
        : undefined;
    },
    get volumeComboboxOptions(): VolumeComboboxOption[] {
      return this.volumeArray.map((volume) => volume.comboboxOption);
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
    setRemoveVolumeActiveRequest(active: boolean) {
      self.removeVolumeActiveRequest = active;
    },
    setCreateVolumeActiveRequest(active: boolean) {
      self.createVolumeActiveRequest = active;
    },

    setSelectedVolumeId(volumeId: number | undefined) {
      if (volumeId && !self.volumes.has(volumeId)) {
        throw new Error(`Volume with id ${volumeId} not found`);
      }
      if (self.selectedVolume) {
        self.selectedVolume.setEditingPseudoVolumeData(undefined);
        self.selectedVolume.setEditingSparseVolumeData(undefined);
      }
      self.selectedVolumeId = volumeId;
    },
    addVolume(volume: z.infer<typeof deepVolumeSchema>) {
      self.volumes.set(volume.id, {
        id: volume.id,
        name: volume.name,
        description: volume.description,
        physicalUnit: volume.physicalUnit,
        physicalSizeX: volume.physicalSizeX,
        physicalSizeY: volume.physicalSizeY,
        physicalSizeZ: volume.physicalSizeZ,
        creatorId: volume.creatorId,
        rawData: volume.rawData ?? null,
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
    setVolumes(volumes: z.infer<typeof deepVolumeSchema>[]) {
      self.volumes.clear();

      volumes.forEach((volume) => {
        self.addVolume(volume);
      });
    },
    createVolume: flow(function* createVolume(
      name: string,
      description: string
    ) {
      const volume = (yield volumeApi.createVolume(self.projectId, {
        name: name,
        description: description,
      })) as z.infer<typeof volumeSchema>;
      if (!isAlive(self)) {
        return;
      }

      self.volumes.set(volume.id, {
        id: volume.id,
        name: volume.name,
        description: volume.description,
        physicalUnit: volume.physicalUnit,
        physicalSizeX: volume.physicalSizeX,
        physicalSizeY: volume.physicalSizeY,
        physicalSizeZ: volume.physicalSizeZ,
        creatorId: volume.creatorId,
        rawData: null,
        sparseVolumes: {},
        pseudoVolumes: {},
        volumeResults: { volumeId: volume.id },
      });
      self.selectedVolumeId = volume.id;

      return volume;
    }),
    removeVolume: flow(function* removeVolume(volumeId: number) {
      yield volumeApi.deleteVolume(volumeId);
      if (!isAlive(self)) {
        return;
      }

      self.volumes.delete(volumeId.toString());
      if (self.selectedVolumeId === volumeId) {
        self.selectedVolumeId = undefined;
      }
    }),
  }))
  .actions((self) => ({
    refreshVolumes: flow(function* refreshVolumes() {
      const volumes = (yield getVolumesFromProjectDeep(
        self.projectId
      )) as z.infer<typeof volumesDeepSchemaRes>;
      if (!isAlive(self)) {
        return;
      }

      self.volumes.clear();
      self.setVolumes(volumes);

      if (self.selectedVolumeId && !self.volumes.has(self.selectedVolumeId)) {
        self.selectedVolumeId = undefined;
      }

      return self.selectedVolume;
    }),
  }));

export interface ProjectVolumesInstance extends Instance<
  typeof ProjectVolumes
> {}
