import { flow, Instance, isAlive, SnapshotIn, types } from "mobx-state-tree";
import { RawVolume, RawVolumeSnapshotIn } from "./RawVolumeModel";
import { SparseLabelVolume, SparseVolumeSnapshotIn } from "./SparseVolumeModel";
import { PseudoLabelVolume, PseudoVolumeSnapshotIn } from "./PseudoVolumeModel";
import { ResultSnapshotIn, VolumeResults } from "./ResultModel";
import Utils, { FileMap } from "../../functions/Utils";
import { toast } from "react-toastify";

export interface VolumeDB {
  id: number;
  name: string;
  description: string;
  creatorId: number | null;
  rawData: RawVolumeSnapshotIn | null | undefined;
  rawDataId: number | null;
  sparseVolumes: SparseVolumeSnapshotIn[] | undefined;
  pseudoVolumes: PseudoVolumeSnapshotIn[] | undefined;
  results: ResultSnapshotIn[] | undefined;
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
  }))
  .actions((self) => ({
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
    uploadRawVolume: flow(function* uploadRawVolume(files: FileList) {
      const fileMap = yield Utils.unpackAndcreateFileMap(files);
      if (!isAlive(self)) {
        return;
      }

      const validatedFiles = Utils.validateRawFileUpload(fileMap);

      const formData = new FormData();
      validatedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = yield Utils.sendRequestWithToast(
        `volume/${self.id}/volumeData/RawVolumeData/from-files`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
        { successText: "Volume Successfully Uploaded" }
      );
      if (!isAlive(self)) {
        return;
      }
      const rawData: RawVolumeSnapshotIn = yield response.json();
      if (!isAlive(self)) {
        return;
      }

      self.setRawVolume(rawData);
    }),
    uploadMrcVolume: flow(function* uploadMrcVolume(files: FileList) {
      if (!files || files.length == 0) {
        toast.error(`No files silected`);
        throw new Error("No files silected.");
      }

      const fileMap: FileMap = yield Utils.unpackAndcreateFileMap(files);

      if (fileMap.size > 1) {
        toast.error(`Too many files selected.`);
        throw new Error("Too many files selected.");
      }

      const mrcFile = fileMap.values().next().value;

      if (!mrcFile || !mrcFile.name.endsWith(".mrc")) {
        toast.error(`No MRC file selected.`);
        throw new Error("Too many files selected.");
      }

      const formData = new FormData();
      formData.append("files", mrcFile);
      const response = yield Utils.sendRequestWithToast(
        `volume/${self.id}/volumeData/RawVolumeData/from-mrc-file`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
        { successText: "Volume Successfully Uploaded" }
      );
      if (!isAlive(self)) {
        return;
      }
      const rawData: RawVolumeSnapshotIn = yield response.json();
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

      const response = yield Utils.sendReq(
        `volume/${self.id}/volumeData/RawVolumeData/from-files`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
        false
      );
      if (!isAlive(self)) {
        return;
      }

      const rawData: RawVolumeSnapshotIn = yield response.json();
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

      const response = yield Utils.sendRequestWithToast(
        `volume/${self.id}/volumeData/SparseLabeledVolumeData/from-files`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
        { successText: "Volume Successfully Uploaded" }
      );
      if (!isAlive(self)) {
        return;
      }
      const volume: SparseVolumeSnapshotIn = yield response.json();
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

      const response = yield Utils.sendRequestWithToast(
        `volume/${self.id}/volumeData/PseudoLabeledVolumeData/from-files`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
        { successText: "Volume Successfully Uploaded" }
      );
      if (!isAlive(self)) {
        return;
      }
      const volume: PseudoVolumeSnapshotIn = yield response.json();
      if (!isAlive(self)) {
        return;
      }

      self.addPseudoVolumes([volume]);
    }),
    deleteLabeledVolume: flow(function* deleteLabeledVolume(
      dataType: LabeledVolumeTypes,
      dataId: number
    ) {
      yield Utils.sendRequestWithToast(
        `volume/${self.id}/volumeData/${dataType}/${dataId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
        { successText: "Volume Data Successfuly Deleted" }
      );
      if (!isAlive(self)) {
        return;
      }

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
    get selectedVolume() {
      return self.selectedVolumeId
        ? self.volumes.get(self.selectedVolumeId)
        : undefined;
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
        const response = yield Utils.sendReq(
          `project/${self.projectId}/volumes`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name, description: description }),
          }
        );
        if (!isAlive(self)) {
          return;
        }
        const volume: VolumeDB = yield response.json();
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
        yield Utils.sendRequestWithToast(
          `project/${self.projectId}/volume/${volumeId}`,
          {
            method: "DELETE",
            credentials: "include",
          },
          { successText: "Volume Successfuly Removed From Project" }
        );
        if (!isAlive(self)) {
          return;
        }

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
        const response = yield Utils.sendReq(
          `project/${self.projectId}/volumes/deep`,
          {
            method: "GET",
            credentials: "include",
          }
        );
        if (!isAlive(self)) {
          return;
        }
        const volumes: VolumeDB[] = yield response.json();
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
