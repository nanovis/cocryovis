import {
  flow,
  getParentOfType,
  Instance,
  SnapshotIn,
  types,
  isAlive,
} from "mobx-state-tree";
import { Volume, VolumeInstance } from "./VolumeModel";
import { Checkpoint, CheckpointInstance } from "./CheckpointModel";
import { User } from "./UserModel";
import { Model, ModelInstance } from "./ModelModel";
import Utils from "../../functions/Utils";

export const ModelTraining = types
  .model({
    model: types.maybe(types.reference(Model)),
    checkpoint: types.maybe(types.reference(Checkpoint)),
    trainingVolumes: types.optional(types.array(types.reference(Volume)), []),
    validationVolumes: types.optional(types.array(types.reference(Volume)), []),
    testingVolumes: types.optional(types.array(types.reference(Volume)), []),
  })
  .volatile(() => ({
    isBusy: false,
  }))
  .views((self) => ({
    get volumes(): VolumeInstance[] {
      const userProjects = getParentOfType(self, User)?.userProjects;
      return userProjects?.activeProject?.projectVolumes.volumeArray || [];
    },
    get canDoTraining() {
      return (
        self.model !== undefined &&
        self.trainingVolumes.length > 0 &&
        self.validationVolumes.length > 0 &&
        self.testingVolumes.length > 0
      );
    },
  }))
  .views((self) => ({
    get trainingVolumeOptions() {
      return self.volumes.filter(
        (volume) =>
          !self.validationVolumes.includes(volume) &&
          !self.testingVolumes.includes(volume),
      );
    },
    get trainingVolumeNames() {
      return self.trainingVolumes.map((volume) => volume.name);
    },
    get trainingVolumeIds() {
      return self.trainingVolumes.map((volume) => volume.id.toString());
    },
    get validationVolumeOptions() {
      return self.volumes.filter(
        (volume) =>
          !self.trainingVolumes.includes(volume) &&
          !self.testingVolumes.includes(volume),
      );
    },
    get validationVolumeNames() {
      return self.validationVolumes.map((volume) => volume.name);
    },
    get validationVolumeIds() {
      return self.validationVolumes.map((volume) => volume.id.toString());
    },
    get testingVolumeOptions() {
      return self.volumes.filter(
        (volume) =>
          !self.trainingVolumes.includes(volume) &&
          !self.validationVolumes.includes(volume),
      );
    },
    get testingVolumeNames() {
      return self.testingVolumes.map((volume) => volume.name);
    },
    get testingVolumeIds() {
      return self.testingVolumes.map((volume) => volume.id.toString());
    },
  }))
  .actions((self) => ({
    setModel(model: ModelInstance) {
      self.model = model;
    },
    setCheckpoint(checkpoint: CheckpointInstance) {
      self.checkpoint = checkpoint;
    },
    addTrainingVolume(volume: VolumeInstance) {
      if (!self.trainingVolumes.includes(volume)) {
        self.trainingVolumes.push(volume);
      }
    },
    removeTrainingVolume(volume: VolumeInstance) {
      const index = self.trainingVolumes.findIndex((v) => v.id === volume.id);
      if (index !== -1) {
        self.trainingVolumes.splice(index, 1);
      }
    },
    removeTrainingVolumeByIndex(index: number) {
      if (index < 0 || index >= self.trainingVolumes.length) {
        return;
      }
      self.trainingVolumes.splice(index, 1);
    },
    addValidationVolume(volume: VolumeInstance) {
      if (!self.validationVolumes.includes(volume)) {
        self.validationVolumes.push(volume);
      }
    },
    removeValidationVolume(volume: VolumeInstance) {
      const index = self.validationVolumes.findIndex((v) => v.id === volume.id);
      if (index !== -1) {
        self.validationVolumes.splice(index, 1);
      }
    },
    removeValidationVolumeByIndex(index: number) {
      if (index < 0 || index >= self.validationVolumes.length) {
        return;
      }
      self.validationVolumes.splice(index, 1);
    },
    addTestingVolume(volume: VolumeInstance) {
      if (!self.testingVolumes.includes(volume)) {
        self.testingVolumes.push(volume);
      }
    },
    removeTestingVolume(volume: VolumeInstance) {
      const index = self.testingVolumes.findIndex((v) => v.id === volume.id);
      if (index !== -1) {
        self.testingVolumes.splice(index, 1);
      }
    },
    removeTestingVolumeByIndex(index: number) {
      if (index < 0 || index >= self.testingVolumes.length) {
        return;
      }
      self.testingVolumes.splice(index, 1);
    },
  }))
  .actions((self) => ({
    startTraining: flow(function* () {
      if (!self.canDoTraining) {
        return;
      }
      try {
        var trainData = {
          modelId: self.model?.id,
          trainingVolumes: self.trainingVolumeIds,
          validationVolumes: self.validationVolumeIds,
          testingVolumes: self.testingVolumeIds,
        };

        yield Utils.sendRequestWithToast(
          `queue-training`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trainData),
          },
          { successText: "Training successfuly queued!" },
        );
        if (!isAlive(self)) {
          return;
        }
      } catch (error) {
        console.error("startTraining Error:", error);
      }
    }),
  }));

export interface ModelTrainingInstance extends Instance<typeof ModelTraining> {}
export interface ModelTrainingSnapshotIn
  extends SnapshotIn<typeof ModelTraining> {}
